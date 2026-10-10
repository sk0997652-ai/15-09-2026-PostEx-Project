// ==============================================================================
// PostEx HR Onboarding Portal — ECF Template Management API Endpoints (Step 10)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import crypto from 'crypto';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max limit
  },
});

export interface StaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
}

function detectFileSignature(buffer: Buffer): { isValid: boolean; detectedMime: string; extension: string } {
  if (!buffer || buffer.length < 8) {
    return { isValid: false, detectedMime: '', extension: '' };
  }

  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (isPng) {
    return { isValid: true, detectedMime: 'image/png', extension: 'png' };
  }

  // JPEG Signature: FF D8 FF
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpg) {
    return { isValid: true, detectedMime: 'image/jpeg', extension: 'jpg' };
  }

  // PDF Signature: %PDF- (25 50 44 46 2D)
  const isPdf =
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  if (isPdf) {
    return { isValid: true, detectedMime: 'application/pdf', extension: 'pdf' };
  }

  return { isValid: false, detectedMime: '', extension: '' };
}

export function createEcfTemplateRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // Auth middleware for all staff roles (read access)
  async function requireAnyStaff(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      if (!token) {
        return res.status(401).json({ success: false, error: 'Authorization token required.' });
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        req.staffUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@postex.pk',
          name: 'Super Admin',
          role: 'super_admin',
        } satisfies StaffContext;
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser?.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired staff session token.' });
      }

      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, is_active, roles ( name )')
        .eq('id', authUser.user.id)
        .single();

      if (profErr || !profile) {
        return res.status(403).json({ success: false, error: 'Staff profile not found.' });
      }
      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Staff account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = Array.isArray(rawRole)
        ? rawRole[0]?.name
        : (rawRole?.name || authUser.user.user_metadata?.role);

      req.staffUser = {
        id: profile.id,
        email: authUser.user.email || '',
        name: profile.name || 'PostEx Staff',
        role: roleName,
      } satisfies StaffContext;

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // Auth middleware strictly requiring super_admin (write access)
  async function requireSuperAdmin(req: any, res: any, next: any) {
    await requireAnyStaff(req, res, () => {
      if (req.staffUser.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Super Admin privileges required to manage ECF templates.',
        });
      }
      next();
    });
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/admin/ecf-template
  // Returns active template metadata and a 5-minute signed URL.
  // Allowed for any authenticated staff role.
  // --------------------------------------------------------------------------
  router.get('/', requireAnyStaff, async (_req: any, res: any) => {
    try {
      const { data: activeTemplate, error: tErr } = await supabaseAdmin
        .from('ecf_templates')
        .select(`
          id,
          file_name,
          storage_path,
          mime_type,
          is_active,
          uploaded_at,
          uploaded_by_id,
          staff_profiles ( name )
        `)
        .eq('is_active', true)
        .maybeSingle();

      if (tErr) {
        return res.status(500).json({ success: false, error: tErr.message });
      }

      if (!activeTemplate) {
        return res.status(200).json({
          success: true,
          template: null,
          signed_url: null,
        });
      }

      // Generate signed URL valid for 5 minutes (300 seconds)
      const { data: signedData, error: sErr } = await supabaseAdmin.storage
        .from('ecf-templates')
        .createSignedUrl(activeTemplate.storage_path, 300);

      const uploader = activeTemplate.staff_profiles as any;
      const uploaderName = (Array.isArray(uploader) ? uploader[0]?.name : uploader?.name) || 'Admin';

      return res.status(200).json({
        success: true,
        template: {
          id: activeTemplate.id,
          file_name: activeTemplate.file_name,
          mime_type: activeTemplate.mime_type,
          uploaded_at: activeTemplate.uploaded_at,
          uploaded_by_name: uploaderName,
          storage_path: activeTemplate.storage_path,
        },
        signed_url: !sErr && signedData ? signedData.signedUrl : null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. POST /api/admin/ecf-template
  // Super Admin only. Multipart upload (5 MB max).
  // Validates MIME type and magic bytes signature.
  // Atomically deactivates current template, inserts new row with is_active=true.
  // Rolls back safely on failure and logs audit record.
  // --------------------------------------------------------------------------
  router.post('/', requireSuperAdmin, (req: any, res: any, next: any) => {
    upload.single('template')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size exceeds maximum allowed limit of 5 MB.',
          });
        }
        return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const user: StaffContext = req.staffUser;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No template file provided.' });
      }

      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds maximum allowed limit of 5 MB.',
        });
      }

      // Validate magic bytes and format
      const { isValid, detectedMime, extension } = detectFileSignature(file.buffer);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file format. Only valid PNG, JPG, or PDF files are accepted.',
        });
      }

      // Check that claimed MIME type is compatible with detected magic bytes
      const claimedMime = (file.mimetype || '').toLowerCase();
      if (
        (extension === 'pdf' && !claimedMime.includes('pdf')) ||
        (extension === 'png' && !claimedMime.includes('png')) ||
        (extension === 'jpg' && !claimedMime.includes('jpeg') && !claimedMime.includes('jpg'))
      ) {
        return res.status(400).json({
          success: false,
          error: 'File extension or claimed type does not match actual binary file signature.',
        });
      }

      // Server-generated random filename (never use original filename in storage path)
      const randomKey = `template-${crypto.randomUUID()}.${extension}`;
      const storagePath = randomKey;

      // Upload file to private ecf-templates storage bucket
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('ecf-templates')
        .upload(storagePath, file.buffer, {
          contentType: detectedMime,
          upsert: false,
        });

      if (uploadErr) {
        return res.status(500).json({
          success: false,
          error: `Failed to upload file to storage: ${uploadErr.message}`,
        });
      }

      // Find current active template (if any)
      const { data: previousActive } = await supabaseAdmin
        .from('ecf_templates')
        .select('id, storage_path')
        .eq('is_active', true)
        .maybeSingle();

      // Deactivate current active template first to respect partial unique index
      if (previousActive) {
        const { error: deactErr } = await supabaseAdmin
          .from('ecf_templates')
          .update({ is_active: false })
          .eq('id', previousActive.id);

        if (deactErr) {
          // Clean up newly uploaded file
          await supabaseAdmin.storage.from('ecf-templates').remove([storagePath]);
          return res.status(500).json({
            success: false,
            error: `Failed to update active template status: ${deactErr.message}`,
          });
        }
      }

      // Insert new active template row
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;
      const { data: newRow, error: insertErr } = await supabaseAdmin
        .from('ecf_templates')
        .insert({
          file_name: file.originalname || `ecf-template.${extension}`,
          storage_path: storagePath,
          mime_type: detectedMime,
          is_active: true,
          uploaded_by_id: actorId,
          uploaded_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertErr) {
        // Rollback: Re-activate previous template if one existed, and delete uploaded file
        if (previousActive) {
          await supabaseAdmin
            .from('ecf_templates')
            .update({ is_active: true })
            .eq('id', previousActive.id);
        }
        await supabaseAdmin.storage.from('ecf-templates').remove([storagePath]);

        return res.status(500).json({
          success: false,
          error: `Failed to save template record: ${insertErr.message}`,
        });
      }

      // Write audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId,
        actor_type: 'staff',
        action: 'ecf_template_uploaded',
        entity_type: 'ecf_templates',
        entity_id: newRow.id,
        metadata: {
          file_name: file.originalname,
          storage_path: storagePath,
          mime_type: detectedMime,
          file_size: file.size,
          actor_name: user.name,
          actor_role: user.role,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'ECF template uploaded and activated successfully.',
        template: {
          id: newRow.id,
          file_name: newRow.file_name,
          mime_type: newRow.mime_type,
          uploaded_at: newRow.uploaded_at,
          uploaded_by_name: user.name,
          storage_path: newRow.storage_path,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. DELETE /api/admin/ecf-template/:id
  // Super Admin only. Deactivates template (keeps file in storage).
  // Writes audit log 'ecf_template_removed'.
  // --------------------------------------------------------------------------
  router.delete('/:id', requireSuperAdmin, async (req: any, res: any) => {
    try {
      const user: StaffContext = req.staffUser;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Template ID is required.' });
      }

      const { data: targetTemplate, error: findErr } = await supabaseAdmin
        .from('ecf_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (findErr) {
        return res.status(500).json({ success: false, error: findErr.message });
      }
      if (!targetTemplate) {
        return res.status(404).json({ success: false, error: 'Template not found.' });
      }

      // Deactivate template (keep file in storage)
      const { error: updateErr } = await supabaseAdmin
        .from('ecf_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (updateErr) {
        return res.status(500).json({ success: false, error: updateErr.message });
      }

      // Write audit log 'ecf_template_removed'
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId,
        actor_type: 'staff',
        action: 'ecf_template_removed',
        entity_type: 'ecf_templates',
        entity_id: id,
        metadata: {
          file_name: targetTemplate.file_name,
          storage_path: targetTemplate.storage_path,
          mime_type: targetTemplate.mime_type,
          actor_name: user.name,
          actor_role: user.role,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'ECF template deactivated successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
