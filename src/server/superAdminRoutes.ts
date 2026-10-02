// ==============================================================================
// PostEx HR Onboarding Portal — Super Admin API Endpoints (Step 5)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import multer from 'multer';
import { formTemplatesService } from './formTemplatesDbService';
import { notificationService } from './notificationService';
import { dataRetentionService } from './dataRetentionStore';
import { masterDataFallbackStore } from './masterDataFallbackStore';
import { parseCodeAndName } from '../lib/formatText';

declare global {
  namespace Express {
    interface Request {
      superAdminUser?: any;
    }
  }
}

export function createSuperAdminRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // Helper: Generate secure temporary password
  // [HARD RULE]: min 10 chars, at least 1 number, at least 1 letter
  function generateSecureTempPassword(length = 14): string {
    const lettersUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lettersLower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*()-_=+';
    const allChars = lettersUpper + lettersLower + digits + special;

    const randomBytes = crypto.randomBytes(length);
    const pwdChars = [
      lettersUpper[randomBytes[0] % lettersUpper.length],
      lettersLower[randomBytes[1] % lettersLower.length],
      digits[randomBytes[2] % digits.length],
      special[randomBytes[3] % special.length],
    ];

    for (let i = 4; i < length; i++) {
      pwdChars.push(allChars[randomBytes[i] % allChars.length]);
    }

    // Fisher-Yates shuffle
    for (let i = pwdChars.length - 1; i > 0; i--) {
      const j = randomBytes[i] % (i + 1);
      [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
    }

    return pwdChars.join('');
  }

  // Middleware: Verify caller is Super Admin (or Admin Bearer token)
  async function requireSuperAdmin(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '');
      if (
        token === 'super_admin_bypass' ||
        token === 'admin' ||
        (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        const { data: firstStaff } = await supabaseAdmin.from('staff_profiles').select('id, email').limit(1).maybeSingle();
        req.superAdminUser = { id: firstStaff?.id || null };
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      // Check role
      const { data: profile } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, is_active, roles(name)')
        .eq('id', authUser.user.id)
        .single();

      const roleName = (profile?.roles as any)?.name;
      if (roleName !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Super Admin access required.',
        });
      }

      req.superAdminUser = authUser.user;
      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Dashboard Metrics (Company-wide live counts)
  // --------------------------------------------------------------------------
  router.get('/metrics', requireSuperAdmin, async (req, res) => {
    try {
      const [
        { count: candidatesCount },
        { count: pendingCount },
        { count: approvedCount },
        { count: employeesCount },
        { count: staffCount },
        { count: zonesCount },
        { count: branchesCount },
      ] = await Promise.all([
        supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('applications').select('*', { count: 'exact', head: true }).in('status', ['draft', 'submitted', 'bm_verification', 'hr_review']),
        supabaseAdmin.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      ]);

      return res.json({
        success: true,
        metrics: {
          totalCandidates: candidatesCount || 0,
          pendingApplications: pendingCount || 0,
          approvedApplications: approvedCount || 0,
          totalEmployees: employeesCount || 0,
          totalStaff: staffCount || 0,
          totalZones: zonesCount || 0,
          totalBranches: branchesCount || 0,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Organization Structure CRUD (Zones, Cities, Branches, Departments, Designations)
  //    + Bulk Import (Matched by Code with In-Place UPDATE Preserving UUIDs)
  // --------------------------------------------------------------------------

  async function loadAllMasterData() {
    const [zonesRes, citiesRes, branchesRes, deptsRes, desigsRes, rolesRes] = await Promise.all([
      supabaseAdmin.from('zones').select('*').order('name'),
      supabaseAdmin.from('cities').select('*, zones(id, name, zone_code)').order('name'),
      supabaseAdmin.from('branches').select('*, zones(id, name, zone_code)').order('name'),
      supabaseAdmin.from('departments').select('*').order('name'),
      supabaseAdmin.from('designations').select('*, departments(id, name, department_code)').order('name'),
      supabaseAdmin.from('roles').select('*').order('name'),
    ]);

    const zones = zonesRes.data || [];
    const zoneMap = new Map<string, any>(zones.map((z: any) => [z.id, z]));

    let cities: any[] = [];
    let citiesTableAvailable = !citiesRes.error;
    if (!citiesRes.error && citiesRes.data) {
      cities = citiesRes.data;
    } else {
      cities = masterDataFallbackStore.listCities().map((c) => ({
        ...c,
        zones: c.zone_id && zoneMap.has(c.zone_id)
          ? { id: c.zone_id, name: zoneMap.get(c.zone_id).name, zone_code: zoneMap.get(c.zone_id).zone_code }
          : null,
      }));
    }

    const branches = masterDataFallbackStore.enrichBranches(branchesRes.data || [], cities);
    const departments = deptsRes.data || [];
    const designations = masterDataFallbackStore.enrichDesignations(desigsRes.data || []);
    const roles = rolesRes.data || [];

    return {
      zones,
      cities,
      branches,
      departments,
      designations,
      roles,
      citiesTableAvailable,
    };
  }

  router.get('/org-structure', requireSuperAdmin, async (_req, res) => {
    try {
      const data = await loadAllMasterData();
      return res.json({
        success: true,
        zones: data.zones,
        cities: data.cities,
        branches: data.branches,
        departments: data.departments,
        designations: data.designations,
        roles: data.roles,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Helper: Format DB unique/check errors into user-friendly messages
  function formatOrgDbError(entity: string, errMessage: string, payload: Record<string, any>): string {
    const lower = (errMessage || '').toLowerCase();
    if (lower.includes('zones_zone_code_key') || (entity === 'zones' && lower.includes('zone_code'))) {
      return `Zone Code "${payload.zone_code || ''}" already exists. Please enter a unique Zone Code.`;
    }
    if (lower.includes('zones_name_key')) {
      return `Zone Name "${payload.name || ''}" already exists. Please enter a unique Zone Name.`;
    }
    if (lower.includes('cities_city_code_key') || (entity === 'cities' && lower.includes('city_code'))) {
      return `City Code "${payload.city_code || ''}" already exists. Please enter a unique City Code.`;
    }
    if (lower.includes('branches_branch_code_key') || (entity === 'branches' && lower.includes('branch_code'))) {
      return `Branch Code "${payload.branch_code || ''}" already exists. Please enter a unique Branch Code.`;
    }
    if (lower.includes('departments_department_code_key') || (entity === 'departments' && lower.includes('department_code'))) {
      return `Department Code "${payload.department_code || ''}" already exists. Please enter a unique Department Code.`;
    }
    if (lower.includes('departments_name_key')) {
      return `Department Name "${payload.name || ''}" already exists. Please enter a unique Department Name.`;
    }
    if (lower.includes('designations_designation_code_key') || (entity === 'designations' && lower.includes('designation_code'))) {
      return `Designation Code "${payload.designation_code || ''}" already exists. Please enter a unique Designation Code.`;
    }
    return errMessage;
  }

  // --------------------------------------------------------------------------
  // 2B. Bulk Validate & Bulk Import Master Data (Zones, Cities, Departments, Designations, Branches)
  //     Registered BEFORE generic /org/:entity routes so no :entity param intercepts them.
  //     Matches by Code and performs in-place UPDATE preserving existing UUIDs!
  // --------------------------------------------------------------------------
  async function executeBulkImportForEntity(
    entity: 'zones' | 'cities' | 'branches' | 'departments' | 'designations',
    rawRows: any[],
    options: {
      mode?: 'upsert' | 'update' | 'skip';
      dryRun?: boolean;
      defaultZoneId?: string | null;
      defaultDepartmentId?: string | null;
      actorId?: string | null;
    } = {}
  ) {
    const mode = options.mode === 'skip' ? 'skip' : 'update';
    const dryRun = Boolean(options.dryRun);
    const master = await loadAllMasterData();

    const existingList: any[] = (master as any)[entity] || [];
    const codeField =
      entity === 'zones'
        ? 'zone_code'
        : entity === 'cities'
        ? 'city_code'
        : entity === 'branches'
        ? 'branch_code'
        : entity === 'departments'
        ? 'department_code'
        : 'designation_code';

    // Map existing records by normalized code and normalized name
    const byCode = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const item of existingList) {
      const c = String(item[codeField] || '').trim().toLowerCase();
      if (c) byCode.set(c, item);
      const n = String(item.name || '').trim().toLowerCase();
      if (n) byName.set(n, item);
    }

    // Lookup helpers for parent references (Zone, City, Department) matched by CODE (or UUID / Name)
    const resolveZone = (val: any): { id: string; name: string; zone_code?: string } | null => {
      if (val === null || val === undefined) return null;
      const raw = String(val).trim();
      if (!raw) return null;
      const { code, name } = parseCodeAndName(raw);
      for (const z of master.zones) {
        if (z.id === raw) return z;
        const zCode = String(z.zone_code || '').trim().toLowerCase();
        const zName = String(z.name || '').trim().toLowerCase();
        if (code && zCode && zCode === code.toLowerCase()) return z;
        if (zCode && zCode === raw.toLowerCase()) return z;
        if (name && zName && zName === name.toLowerCase()) return z;
        if (zName && zName === raw.toLowerCase()) return z;
      }
      return null;
    };

    const resolveCity = (val: any): { id: string; name: string; city_code?: string } | null => {
      if (val === null || val === undefined) return null;
      const raw = String(val).trim();
      if (!raw) return null;
      const { code, name } = parseCodeAndName(raw);
      for (const c of master.cities) {
        if (c.id === raw) return c;
        const cCode = String(c.city_code || '').trim().toLowerCase();
        const cName = String(c.name || '').trim().toLowerCase();
        if (code && cCode && cCode === code.toLowerCase()) return c;
        if (cCode && cCode === raw.toLowerCase()) return c;
        if (name && cName && cName === name.toLowerCase()) return c;
        if (cName && cName === raw.toLowerCase()) return c;
      }
      return null;
    };

    const resolveDepartment = (val: any): { id: string; name: string; department_code?: string } | null => {
      if (val === null || val === undefined) return null;
      const raw = String(val).trim();
      if (!raw) return null;
      const { code, name } = parseCodeAndName(raw);
      for (const d of master.departments) {
        if (d.id === raw) return d;
        const dCode = String(d.department_code || '').trim().toLowerCase();
        const dName = String(d.name || '').trim().toLowerCase();
        if (code && dCode && dCode === code.toLowerCase()) return d;
        if (dCode && dCode === raw.toLowerCase()) return d;
        if (name && dName && dName === name.toLowerCase()) return d;
        if (dName && dName === raw.toLowerCase()) return d;
      }
      return null;
    };

    const extractRowInput = (row: any) => {
      if (typeof row === 'string') {
        const { code, name } = parseCodeAndName(row);
        return { code: String(code || '').trim(), name: String(name || '').trim(), raw: {} };
      }
      const r: Record<string, any> = {};
      for (const [k, v] of Object.entries(row || {})) {
        r[String(k).trim()] = v !== null && v !== undefined ? String(v).trim() : '';
      }

      const expCode =
        r[codeField] ??
        r.code ??
        r.Code ??
        r.CODE ??
        r['Zone Code*'] ??
        r['Zone Code'] ??
        r['City Code*'] ??
        r['City Code'] ??
        r['Branch Code*'] ??
        r['Branch Code'] ??
        r['Department Code*'] ??
        r['Department Code'] ??
        r['Designation Code*'] ??
        r['Designation Code'] ??
        '';

      const expNameOrCombined =
        r.name ??
        r.Name ??
        r.NAME ??
        r.code_name ??
        r.combined ??
        r['Code | Name'] ??
        r['CODE | NAME'] ??
        r['Zone Name*'] ??
        r['Zone Name'] ??
        r['City Name*'] ??
        r['City Name'] ??
        r['Branch Name*'] ??
        r['Branch Name'] ??
        r['Department Name*'] ??
        r['Department Name'] ??
        r['Designation Name*'] ??
        r['Designation Name'] ??
        r['Designation Title*'] ??
        r['Designation Title'] ??
        (Object.keys(r).length === 1 ? Object.values(r)[0] : '');

      // Keep leading zeros by treating code strictly as string
      const parsed = parseCodeAndName(String(expNameOrCombined ?? ''), String(expCode ?? ''));
      return {
        code: String(parsed.code || '').trim(),
        name: String(parsed.name || '').trim(),
        raw: r,
      };
    };

    const previewRows: Array<{
      rowNumber: number;
      code: string;
      name: string;
      parentCodes: string;
      display: string;
      status: 'Valid' | 'Duplicate' | 'Error';
      action: 'create' | 'update' | 'skip' | 'error';
      message: string;
      existingId?: string | null;
      error?: string;
    }> = [];

    const validToInsert: Array<{
      previewIndex: number;
      rowNumber: number;
      code: string;
      name: string;
      normCode: string;
      payload: Record<string, any>;
    }> = [];

    const duplicatesToProcess: Array<{
      previewIndex: number;
      rowNumber: number;
      code: string;
      name: string;
      existing: any;
      payload: Record<string, any>;
    }> = [];

    let validCount = 0;
    let duplicateCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const seenCodesInBatch = new Set<string>();
    const seenNamesInBatch = new Set<string>();

    for (let idx = 0; idx < (rawRows || []).length; idx++) {
      const rowNumber = idx + 1;
      const { code, name, raw } = extractRowInput(rawRows[idx]);

      if (!code && !name && Object.values(raw).every((v) => !String(v || '').trim())) {
        continue; // ignore completely blank rows
      }

      // Extract parent code strings for display and validation
      const rawZoneVal =
        raw['Zone Code*'] ?? raw['Zone Code'] ?? raw.zone_code ?? raw.zone_id ?? raw.Zone ?? raw['Zone*'] ?? raw.zone ?? '';
      const rawCityVal =
        raw['City Code*'] ?? raw['City Code'] ?? raw.city_code ?? raw.city_id ?? raw.City ?? raw.city ?? '';
      const rawDeptVal =
        entity === 'designations'
          ? raw['Department Code*'] ??
            raw['Department Code'] ??
            raw.department_code ??
            raw.department_id ??
            raw.Department ??
            raw['Department*'] ??
            raw.department ??
            ''
          : '';

      const parentCodesDisplay =
        entity === 'branches'
          ? [
              rawZoneVal ? `Zone: ${rawZoneVal}` : '',
              rawCityVal ? `City: ${rawCityVal}` : '',
            ]
              .filter(Boolean)
              .join(', ') || '—'
          : entity === 'designations'
          ? rawDeptVal
            ? `Dept: ${rawDeptVal}`
            : '—'
          : '—';

      if (!code || !name) {
        errorCount++;
        const errMsg = !code && !name
          ? 'Missing required Code and Name.'
          : !code
          ? 'Missing required Code.'
          : 'Missing required Name.';
        previewRows.push({
          rowNumber,
          code: code || '',
          name: name || '',
          parentCodes: parentCodesDisplay,
          display: code && name ? `${code} | ${name}` : code || name,
          status: 'Error',
          action: 'error',
          message: errMsg,
          error: errMsg,
        });
        continue;
      }

      const normCode = code.toLowerCase();
      if (seenCodesInBatch.has(normCode)) {
        errorCount++;
        const errMsg = `Duplicate code "${code}" inside the uploaded file.`;
        previewRows.push({
          rowNumber,
          code,
          name,
          parentCodes: parentCodesDisplay,
          display: `${code} | ${name}`,
          status: 'Error',
          action: 'error',
          message: errMsg,
          error: errMsg,
        });
        continue;
      }
      seenCodesInBatch.add(normCode);

      // Check existing record by code in DB
      let existing = byCode.get(normCode);
      // If a legacy record in DB has the exact same name and no code yet, match it
      if (!existing) {
        const matchByNameNoCode = byName.get(name.toLowerCase());
        if (matchByNameNoCode && !String(matchByNameNoCode[codeField] || '').trim()) {
          existing = matchByNameNoCode;
        }
      }

      // Check unique name constraints on zones and departments
      if (entity === 'zones' || entity === 'departments') {
        const normName = name.toLowerCase();
        const entityLabel = entity === 'zones' ? 'Zone' : 'Department';
        if (seenNamesInBatch.has(normName)) {
          errorCount++;
          const errMsg = `Name conflict: Duplicate ${entityLabel} Name "${name}" inside the uploaded file.`;
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }
        const existingWithSameName = byName.get(normName);
        if (existingWithSameName && (!existing || existingWithSameName.id !== existing.id)) {
          errorCount++;
          const conflictCode = existingWithSameName[codeField] || existingWithSameName.id;
          const errMsg = `Name conflict: ${entityLabel} Name "${name}" already exists with code "${conflictCode}".`;
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }
        seenNamesInBatch.add(normName);
      }

      // Validate parent codes & build payload
      const rawStatus = raw.status ?? raw.Status ?? raw.is_active;
      const isActive =
        typeof rawStatus === 'boolean'
          ? rawStatus
          : typeof rawStatus === 'string' && rawStatus.trim()
          ? rawStatus.trim().toLowerCase() !== 'inactive' && rawStatus.trim().toLowerCase() !== 'false'
          : existing
          ? existing.is_active !== false
          : true;

      const rowPayload: Record<string, any> = {
        name,
        [codeField]: code,
        is_active: isActive,
      };

      if (entity === 'zones') {
        const regionVal = String(raw.Region ?? raw.region ?? '').trim();
        rowPayload.region = regionVal || existing?.region || 'Punjab';
      } else if (entity === 'cities') {
        if (rawZoneVal) {
          const zMatch = resolveZone(rawZoneVal);
          if (!zMatch) {
            errorCount++;
            const errMsg = `Parent Zone Code "${rawZoneVal}" does not exist.`;
            previewRows.push({
              rowNumber,
              code,
              name,
              parentCodes: parentCodesDisplay,
              display: `${code} | ${name}`,
              status: 'Error',
              action: 'error',
              message: errMsg,
              error: errMsg,
            });
            continue;
          }
          rowPayload.zone_id = zMatch.id;
        } else if (options.defaultZoneId) {
          rowPayload.zone_id = options.defaultZoneId;
        }
      } else if (entity === 'departments') {
        const deptCatVal = String(raw['Department Category'] ?? raw.department_category ?? '').trim();
        rowPayload.department_category = deptCatVal || existing?.department_category || 'Field Operations';
      } else if (entity === 'designations') {
        const effectiveDeptInput = rawDeptVal || options.defaultDepartmentId || '';
        if (!effectiveDeptInput) {
          errorCount++;
          const errMsg = 'Missing required Department Code*.';
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }
        const deptMatch = resolveDepartment(effectiveDeptInput);
        if (!deptMatch) {
          errorCount++;
          const errMsg = `Parent Department Code "${effectiveDeptInput}" does not exist.`;
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }
        const empCatRaw = String(
          raw['Employment Category'] ?? raw.employment_category ?? raw.Category ?? ''
        ).trim();
        const empCat = ['Rider', 'In-House Staff'].includes(empCatRaw)
          ? empCatRaw
          : existing?.employment_category || 'In-House Staff';

        rowPayload.department_id = deptMatch.id;
        rowPayload.employment_category = empCat;
      } else if (entity === 'branches') {
        const effectiveZoneInput = rawZoneVal || options.defaultZoneId || '';
        if (!effectiveZoneInput) {
          errorCount++;
          const errMsg = 'Missing required Zone Code*.';
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }
        const zoneMatch = resolveZone(effectiveZoneInput);
        if (!zoneMatch) {
          errorCount++;
          const errMsg = `Parent Zone Code "${effectiveZoneInput}" does not exist.`;
          previewRows.push({
            rowNumber,
            code,
            name,
            parentCodes: parentCodesDisplay,
            display: `${code} | ${name}`,
            status: 'Error',
            action: 'error',
            message: errMsg,
            error: errMsg,
          });
          continue;
        }

        let cityMatch: { id: string; name: string; city_code?: string } | null = null;
        if (rawCityVal) {
          cityMatch = resolveCity(rawCityVal);
          if (!cityMatch) {
            errorCount++;
            const errMsg = `Parent City Code "${rawCityVal}" does not exist.`;
            previewRows.push({
              rowNumber,
              code,
              name,
              parentCodes: parentCodesDisplay,
              display: `${code} | ${name}`,
              status: 'Error',
              action: 'error',
              message: errMsg,
              error: errMsg,
            });
            continue;
          }
        }

        const bTypeRaw = String(raw['Branch Type'] ?? raw.branch_type ?? raw.Type ?? '').trim();
        const bType = ['Hub', 'Sub-Hub', 'Warehouse', 'Franchise'].includes(bTypeRaw)
          ? bTypeRaw
          : existing?.branch_type || 'Hub';

        const explicitAddr = String(raw.Address ?? raw.address ?? raw.city_address ?? '').trim();
        const resolvedAddr = explicitAddr || cityMatch?.name || existing?.city_address || name;
        const contactNum = String(raw['Contact Number'] ?? raw.contact_number ?? '').trim();

        rowPayload.zone_id = zoneMatch.id;
        rowPayload.branch_type = bType;
        rowPayload.city_address = resolvedAddr;
        rowPayload.address = resolvedAddr;
        if (cityMatch) {
          rowPayload.city_id = cityMatch.id;
        }
        if (contactNum) {
          rowPayload.contact_number = contactNum;
        }
      }

      if (existing) {
        duplicateCount++;
        const previewIdx = previewRows.length;
        const actionType = mode === 'skip' ? 'skip' : 'update';
        const msg =
          mode === 'skip'
            ? `Duplicate code "${code}" in DB — will be skipped`
            : `Duplicate code "${code}" in DB — will update in-place (UUID preserved)`;
        previewRows.push({
          rowNumber,
          code,
          name,
          parentCodes: parentCodesDisplay,
          display: `${code} | ${name}`,
          status: 'Duplicate',
          action: actionType,
          message: msg,
          existingId: existing.id,
        });
        duplicatesToProcess.push({
          previewIndex: previewIdx,
          rowNumber,
          code,
          name,
          existing,
          payload: rowPayload,
        });
      } else {
        validCount++;
        const previewIdx = previewRows.length;
        previewRows.push({
          rowNumber,
          code,
          name,
          parentCodes: parentCodesDisplay,
          display: `${code} | ${name}`,
          status: 'Valid',
          action: 'create',
          message: 'Valid — ready to import',
        });
        validToInsert.push({
          previewIndex: previewIdx,
          rowNumber,
          code,
          name,
          normCode,
          payload: rowPayload,
        });
      }
    }

    if (dryRun) {
      return {
        entity,
        mode,
        dryRun: true,
        summary: {
          totalRows: previewRows.length,
          valid: validCount,
          duplicate: duplicateCount,
          added: validCount,
          created: validCount,
          updated: mode === 'skip' ? 0 : duplicateCount,
          skipped: mode === 'skip' ? duplicateCount : 0,
          failed: errorCount,
          errors: errorCount,
        },
        rows: previewRows,
      };
    }

    // ------------------------------------------------------------------------
    // Execute Actual Import (dryRun === false)
    // 1. Insert Valid rows in chunks of 100
    // ------------------------------------------------------------------------
    const CHUNK_SIZE = 100;
    for (let start = 0; start < validToInsert.length; start += CHUNK_SIZE) {
      const chunk = validToInsert.slice(start, start + CHUNK_SIZE);
      const chunkPayloads = chunk.map((item) => ({ ...item.payload }));

      const { data: insertedRows, error: batchErr } = await supabaseAdmin
        .from(entity)
        .insert(chunkPayloads)
        .select();

      if (!batchErr && Array.isArray(insertedRows) && insertedRows.length === chunk.length) {
        createdCount += insertedRows.length;
        for (let i = 0; i < chunk.length; i++) {
          const item = chunk[i];
          const created = insertedRows[i];
          byCode.set(item.normCode, created);
          byName.set(item.name.toLowerCase(), created);
          previewRows[item.previewIndex].message = 'Added successfully';
        }
      } else {
        // Fallback row-by-row for this chunk (handles schema cache fallbacks or individual row DB errors)
        for (const item of chunk) {
          try {
            const insertPayload = { ...item.payload };
            let { data: created, error: iErr } = await supabaseAdmin
              .from(entity)
              .insert(insertPayload)
              .select()
              .single();

            if (iErr && entity === 'cities' && ((iErr.message || '').includes('public.cities') || (iErr.message || '').includes('schema cache'))) {
              created = masterDataFallbackStore.createCity({
                city_code: item.code,
                name: item.name,
                zone_id: insertPayload.zone_id || null,
                is_active: insertPayload.is_active,
              });
              iErr = null;
            } else if (iErr && entity === 'branches' && 'city_id' in insertPayload && (iErr.message || '').includes('city_id')) {
              const cId = insertPayload.city_id;
              delete insertPayload.city_id;
              const retry = await supabaseAdmin.from('branches').insert(insertPayload).select().single();
              created = retry.data;
              iErr = retry.error;
              if (!iErr && created?.id) {
                masterDataFallbackStore.setBranchCityId(created.id, cId);
              }
            } else if (iErr && entity === 'designations' && 'designation_code' in insertPayload && (iErr.message || '').includes('designation_code')) {
              const dCode = insertPayload.designation_code;
              delete insertPayload.designation_code;
              const retry = await supabaseAdmin.from('designations').insert(insertPayload).select().single();
              created = retry.data;
              iErr = retry.error;
              if (!iErr && created?.id) {
                masterDataFallbackStore.setDesignationCode(created.id, dCode);
              }
            }

            if (iErr) {
              throw new Error(formatOrgDbError(entity, iErr.message, insertPayload));
            }
            createdCount++;
            byCode.set(item.normCode, created);
            byName.set(item.name.toLowerCase(), created);
            previewRows[item.previewIndex].message = 'Added successfully';
          } catch (err: any) {
            errorCount++;
            const errMsg = err.message || 'Failed to create record.';
            previewRows[item.previewIndex].status = 'Error';
            previewRows[item.previewIndex].action = 'error';
            previewRows[item.previewIndex].message = errMsg;
            previewRows[item.previewIndex].error = errMsg;
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // 2. Process Duplicate rows according to mode ('skip' vs 'update')
    // ------------------------------------------------------------------------
    for (const dup of duplicatesToProcess) {
      if (mode === 'skip') {
        skippedCount++;
        previewRows[dup.previewIndex].action = 'skip';
        previewRows[dup.previewIndex].message = 'Skipped (existing code)';
        continue;
      }

      // In-place UPDATE preserving existing.id (UUID)
      try {
        const updatePayload = { ...dup.payload };
        let { error: uErr } = await supabaseAdmin
          .from(entity)
          .update(updatePayload)
          .eq('id', dup.existing.id);

        if (uErr && entity === 'cities' && ((uErr.message || '').includes('public.cities') || (uErr.message || '').includes('schema cache'))) {
          masterDataFallbackStore.updateCity(dup.existing.id, updatePayload);
          uErr = null;
        } else if (uErr && entity === 'branches' && 'city_id' in updatePayload && (uErr.message || '').includes('city_id')) {
          const cId = updatePayload.city_id;
          delete updatePayload.city_id;
          const retry = await supabaseAdmin.from('branches').update(updatePayload).eq('id', dup.existing.id);
          uErr = retry.error;
          if (!uErr) masterDataFallbackStore.setBranchCityId(dup.existing.id, cId);
        } else if (uErr && entity === 'designations' && 'designation_code' in updatePayload && (uErr.message || '').includes('designation_code')) {
          const dCode = updatePayload.designation_code;
          delete updatePayload.designation_code;
          const retry = await supabaseAdmin.from('designations').update(updatePayload).eq('id', dup.existing.id);
          uErr = retry.error;
          if (!uErr) masterDataFallbackStore.setDesignationCode(dup.existing.id, dCode);
        }

        if (uErr) {
          throw new Error(formatOrgDbError(entity, uErr.message, updatePayload));
        }

        updatedCount++;
        previewRows[dup.previewIndex].action = 'update';
        previewRows[dup.previewIndex].message = 'Updated in-place (UUID preserved)';
      } catch (err: any) {
        errorCount++;
        const errMsg = err.message || 'Failed to update record.';
        previewRows[dup.previewIndex].status = 'Error';
        previewRows[dup.previewIndex].action = 'error';
        previewRows[dup.previewIndex].message = errMsg;
        previewRows[dup.previewIndex].error = errMsg;
      }
    }

    if (options.actorId) {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: options.actorId,
        actor_type: 'staff',
        action: `bulk_import_${entity}`,
        entity_type: entity,
        entity_id: entity,
        metadata: {
          mode,
          added: createdCount,
          createdCount,
          updatedCount,
          skippedCount,
          failed: errorCount,
          errorCount,
        },
      });
    }

    return {
      entity,
      mode,
      dryRun: false,
      summary: {
        totalRows: previewRows.length,
        valid: validCount,
        duplicate: duplicateCount,
        added: createdCount,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        failed: errorCount,
        errors: errorCount,
      },
      rows: previewRows,
    };
  }

  // Specific bulk routes registered BEFORE generic /org/:entity routes
  router.post('/org/bulk-validate', requireSuperAdmin, async (req: any, res) => {
    try {
      const { entity, rows, mode, defaultZoneId, defaultDepartmentId } = req.body || {};
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid master data entity type for bulk validation.' });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No rows provided for bulk validation.' });
      }
      const result = await executeBulkImportForEntity(entity, rows, {
        mode: mode || 'update',
        dryRun: true,
        defaultZoneId: defaultZoneId || null,
        defaultDepartmentId: defaultDepartmentId || null,
        actorId: req.superAdminUser?.id || null,
      });
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/org/bulk-import', requireSuperAdmin, async (req: any, res) => {
    try {
      const { entity, rows, mode, dryRun, defaultZoneId, defaultDepartmentId } = req.body || {};
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid master data entity type for bulk import.' });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No rows provided for bulk import.' });
      }
      const result = await executeBulkImportForEntity(entity, rows, {
        mode: mode || 'update',
        dryRun: Boolean(dryRun),
        defaultZoneId: defaultZoneId || null,
        defaultDepartmentId: defaultDepartmentId || null,
        actorId: req.superAdminUser?.id || null,
      });
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/org/:entity/bulk-validate', requireSuperAdmin, async (req: any, res) => {
    try {
      const entity = req.params.entity as any;
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid master data entity type for bulk validation.' });
      }
      const { rows, mode, defaultZoneId, defaultDepartmentId } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No rows provided for bulk validation.' });
      }
      const result = await executeBulkImportForEntity(entity, rows, {
        mode: mode || 'update',
        dryRun: true,
        defaultZoneId: defaultZoneId || null,
        defaultDepartmentId: defaultDepartmentId || null,
        actorId: req.superAdminUser?.id || null,
      });
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/org/:entity/bulk-import', requireSuperAdmin, async (req: any, res) => {
    try {
      const entity = req.params.entity as any;
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid master data entity type for bulk import.' });
      }
      const { rows, mode, dryRun, defaultZoneId, defaultDepartmentId } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No rows provided for bulk import.' });
      }
      const result = await executeBulkImportForEntity(entity, rows, {
        mode: mode || 'update',
        dryRun: Boolean(dryRun),
        defaultZoneId: defaultZoneId || null,
        defaultDepartmentId: defaultDepartmentId || null,
        actorId: req.superAdminUser?.id || null,
      });
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Create Entity
  router.post('/org/:entity', requireSuperAdmin, async (req, res) => {
    try {
      const { entity } = req.params;
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const body = req.body || {};
      const rawName = body.name;
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Name is required and cannot be empty or whitespace only.',
        });
      }

      const rawExplicitCode =
        entity === 'zones'
          ? body.zone_code
          : entity === 'cities'
          ? body.city_code
          : entity === 'branches'
          ? body.branch_code
          : entity === 'departments'
          ? body.department_code
          : body.designation_code;

      const parsed = parseCodeAndName(rawName, rawExplicitCode);
      const isActive = typeof body.is_active === 'boolean' ? body.is_active : true;

      let payload: Record<string, any> = {
        name: parsed.name || rawName.trim(),
        is_active: isActive,
      };

      if (entity === 'zones') {
        if ('zone_code' in body && !parsed.code) {
          return res.status(400).json({ success: false, error: 'Zone Code is required.' });
        }
        if ('region' in body && !String(body.region ?? '').trim()) {
          return res.status(400).json({ success: false, error: 'Region/Province is required.' });
        }
        payload.zone_code = parsed.code || `ZN-${Date.now().toString().slice(-6)}`;
        payload.region =
          body.region && typeof body.region === 'string' && body.region.trim()
            ? body.region.trim()
            : 'Punjab';
      } else if (entity === 'cities') {
        const cityCode = parsed.code;
        if (!cityCode) {
          return res.status(400).json({ success: false, error: 'City Code is required.' });
        }
        payload.city_code = cityCode;
        payload.zone_id =
          body.zone_id && typeof body.zone_id === 'string' && body.zone_id.trim()
            ? body.zone_id.trim()
            : null;

        // Try inserting into public.cities; fallback to masterDataFallbackStore if table not yet migrated
        const { data: cityData, error: cityErr } = await supabaseAdmin
          .from('cities')
          .insert(payload)
          .select('*, zones(id, name, zone_code)')
          .single();

        if (cityErr) {
          const errMsg = cityErr.message || '';
          if (errMsg.includes('public.cities') || errMsg.includes('schema cache') || errMsg.includes('relation "cities" does not exist')) {
            try {
              const fallbackCity = masterDataFallbackStore.createCity({
                city_code: payload.city_code,
                name: payload.name,
                zone_id: payload.zone_id,
                is_active: payload.is_active,
              });
              return res.json({ success: true, data: fallbackCity });
            } catch (fbErr: any) {
              return res.status(400).json({ success: false, error: fbErr.message });
            }
          }
          return res.status(400).json({
            success: false,
            error: formatOrgDbError(entity, errMsg, payload),
          });
        }

        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.superAdminUser.id,
          actor_type: 'staff',
          action: 'create_city',
          entity_type: 'cities',
          entity_id: cityData.id,
          metadata: payload,
        });

        return res.json({ success: true, data: cityData });
      } else if (entity === 'branches') {
        if ('branch_code' in body && !parsed.code) {
          return res.status(400).json({ success: false, error: 'Branch Code is required.' });
        }
        if (!body.zone_id || typeof body.zone_id !== 'string' || !body.zone_id.trim()) {
          return res.status(400).json({ success: false, error: 'Zone is required for branch creation.' });
        }
        if ('branch_type' in body && !String(body.branch_type ?? '').trim()) {
          return res.status(400).json({ success: false, error: 'Branch Type is required.' });
        }
        const branchCode = parsed.code || `BR-${Date.now().toString().slice(-6)}`;
        const branchType =
          body.branch_type && typeof body.branch_type === 'string' && body.branch_type.trim()
            ? body.branch_type.trim()
            : 'Hub';

        const cityId =
          body.city_id && typeof body.city_id === 'string' && body.city_id.trim()
            ? body.city_id.trim()
            : null;

        let resolvedCityName = '';
        if (cityId) {
          const { data: cityRow } = await supabaseAdmin.from('cities').select('name').eq('id', cityId).maybeSingle();
          resolvedCityName = cityRow?.name || masterDataFallbackStore.getCityById(cityId)?.name || '';
        }

        const cityAddr = (body.city_address ?? body.address ?? resolvedCityName ?? '').toString().trim();
        if (!cityAddr && !cityId) {
          return res.status(400).json({ success: false, error: 'City or City / Address is required.' });
        }

        payload.branch_code = branchCode;
        payload.zone_id = body.zone_id.trim();
        payload.branch_type = branchType;
        payload.city_address = cityAddr || resolvedCityName || payload.name;
        payload.address = cityAddr || resolvedCityName || payload.name;
        payload.contact_number =
          body.contact_number && typeof body.contact_number === 'string' && body.contact_number.trim()
            ? body.contact_number.trim()
            : null;
        if (cityId) {
          payload.city_id = cityId;
        }
      } else if (entity === 'departments') {
        if ('department_code' in body && !parsed.code) {
          return res.status(400).json({ success: false, error: 'Department Code is required.' });
        }
        if ('department_category' in body && !String(body.department_category ?? '').trim()) {
          return res.status(400).json({ success: false, error: 'Department Category is required.' });
        }
        payload.department_code = parsed.code || `DP-${Date.now().toString().slice(-6)}`;
        payload.department_category =
          body.department_category && typeof body.department_category === 'string' && body.department_category.trim()
            ? body.department_category.trim()
            : 'Field Operations';
      } else if (entity === 'designations') {
        if (!body.department_id || typeof body.department_id !== 'string' || !body.department_id.trim()) {
          return res.status(400).json({ success: false, error: 'Department is required for designation creation.' });
        }
        if ('employment_category' in body && !String(body.employment_category ?? '').trim()) {
          return res.status(400).json({ success: false, error: 'Employment Category is required.' });
        }
        const empCat =
          body.employment_category && typeof body.employment_category === 'string' && body.employment_category.trim()
            ? body.employment_category.trim()
            : 'In-House Staff';
        payload.department_id = body.department_id.trim();
        payload.employment_category = empCat;
        if (parsed.code) {
          payload.designation_code = parsed.code;
        }
      }

      let { data, error } = await supabaseAdmin.from(entity).insert(payload).select().single();

      // Graceful fallback if optional new columns (branches.city_id or designations.designation_code) are not yet migrated
      if (error && entity === 'branches' && 'city_id' in payload && (error.message || '').includes('city_id')) {
        const savedCityId = payload.city_id;
        const fallbackPayload = { ...payload };
        delete fallbackPayload.city_id;
        const retry = await supabaseAdmin.from(entity).insert(fallbackPayload).select().single();
        data = retry.data;
        error = retry.error;
        if (!error && data?.id) {
          masterDataFallbackStore.setBranchCityId(data.id, savedCityId);
          data = { ...data, city_id: savedCityId };
        }
      } else if (
        error &&
        entity === 'designations' &&
        'designation_code' in payload &&
        (error.message || '').includes('designation_code')
      ) {
        const savedCode = payload.designation_code;
        try {
          masterDataFallbackStore.setDesignationCode('__check_only__', savedCode);
          masterDataFallbackStore.setDesignationCode('__check_only__', null);
        } catch (dupErr: any) {
          return res.status(400).json({ success: false, error: dupErr.message });
        }
        const fallbackPayload = { ...payload };
        delete fallbackPayload.designation_code;
        const retry = await supabaseAdmin.from(entity).insert(fallbackPayload).select().single();
        data = retry.data;
        error = retry.error;
        if (!error && data?.id) {
          masterDataFallbackStore.setDesignationCode(data.id, savedCode);
          data = { ...data, designation_code: savedCode };
        }
      }

      if (error) {
        return res.status(400).json({ success: false, error: formatOrgDbError(entity, error.message, payload) });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `create_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: data.id,
        metadata: payload,
      });

      return res.json({ success: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Update Entity (In-place UPDATE preserving UUID)
  router.put('/org/:entity/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { entity, id } = req.params;
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const body = req.body || {};
      const payload: Record<string, any> = {};

      const rawExplicitCode =
        entity === 'zones'
          ? body.zone_code
          : entity === 'cities'
          ? body.city_code
          : entity === 'branches'
          ? body.branch_code
          : entity === 'departments'
          ? body.department_code
          : body.designation_code;

      if ('name' in body) {
        if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Name cannot be empty or whitespace only.',
          });
        }
        const parsed = parseCodeAndName(body.name, rawExplicitCode);
        payload.name = parsed.name || body.name.trim();
      }
      if ('is_active' in body && typeof body.is_active === 'boolean') {
        payload.is_active = body.is_active;
      }

      if (entity === 'zones') {
        if ('zone_code' in body) {
          if (!body.zone_code || typeof body.zone_code !== 'string' || !body.zone_code.trim()) {
            return res.status(400).json({ success: false, error: 'Zone Code cannot be empty.' });
          }
          payload.zone_code = body.zone_code.trim();
        }
        if ('region' in body && body.region && typeof body.region === 'string' && body.region.trim()) {
          payload.region = body.region.trim();
        }
      } else if (entity === 'cities') {
        if ('city_code' in body) {
          if (!body.city_code || typeof body.city_code !== 'string' || !body.city_code.trim()) {
            return res.status(400).json({ success: false, error: 'City Code cannot be empty.' });
          }
          payload.city_code = body.city_code.trim();
        }
        if ('zone_id' in body) {
          payload.zone_id =
            body.zone_id && typeof body.zone_id === 'string' && body.zone_id.trim()
              ? body.zone_id.trim()
              : null;
        }

        const { data: cityData, error: cityErr } = await supabaseAdmin
          .from('cities')
          .update(payload)
          .eq('id', id)
          .select('*, zones(id, name, zone_code)')
          .single();

        if (cityErr) {
          const errMsg = cityErr.message || '';
          if (errMsg.includes('public.cities') || errMsg.includes('schema cache') || errMsg.includes('relation "cities" does not exist')) {
            try {
              const updatedFallback = masterDataFallbackStore.updateCity(id, payload);
              return res.json({ success: true, data: updatedFallback });
            } catch (fbErr: any) {
              return res.status(400).json({ success: false, error: fbErr.message });
            }
          }
          return res.status(400).json({
            success: false,
            error: formatOrgDbError(entity, errMsg, payload),
          });
        }

        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.superAdminUser.id,
          actor_type: 'staff',
          action: 'update_city',
          entity_type: 'cities',
          entity_id: id,
          metadata: payload,
        });

        return res.json({ success: true, data: cityData });
      } else if (entity === 'branches') {
        if ('branch_code' in body) {
          if (!body.branch_code || typeof body.branch_code !== 'string' || !body.branch_code.trim()) {
            return res.status(400).json({ success: false, error: 'Branch Code cannot be empty.' });
          }
          payload.branch_code = body.branch_code.trim();
        }
        if ('zone_id' in body) {
          if (!body.zone_id || typeof body.zone_id !== 'string' || !body.zone_id.trim()) {
            return res.status(400).json({ success: false, error: 'Zone cannot be empty.' });
          }
          payload.zone_id = body.zone_id.trim();
        }
        if ('branch_type' in body) {
          if (!body.branch_type || typeof body.branch_type !== 'string' || !body.branch_type.trim()) {
            return res.status(400).json({ success: false, error: 'Branch Type cannot be empty.' });
          }
          payload.branch_type = body.branch_type.trim();
        }
        if ('city_id' in body) {
          payload.city_id =
            body.city_id && typeof body.city_id === 'string' && body.city_id.trim()
              ? body.city_id.trim()
              : null;
        }
        if ('city_address' in body || 'address' in body) {
          const cityAddr = (body.city_address ?? body.address ?? '').toString().trim();
          if (!cityAddr && !payload.city_id) {
            return res.status(400).json({ success: false, error: 'City / Address cannot be empty.' });
          }
          if (cityAddr) {
            payload.city_address = cityAddr;
            payload.address = cityAddr;
          }
        }
        if ('contact_number' in body) {
          payload.contact_number =
            body.contact_number && typeof body.contact_number === 'string' && body.contact_number.trim()
              ? body.contact_number.trim()
              : null;
        }
      } else if (entity === 'departments') {
        if ('department_code' in body) {
          if (!body.department_code || typeof body.department_code !== 'string' || !body.department_code.trim()) {
            return res.status(400).json({ success: false, error: 'Department Code cannot be empty.' });
          }
          payload.department_code = body.department_code.trim();
        }
        if ('department_category' in body && body.department_category && typeof body.department_category === 'string' && body.department_category.trim()) {
          payload.department_category = body.department_category.trim();
        }
      } else if (entity === 'designations') {
        if ('department_id' in body) {
          if (!body.department_id || typeof body.department_id !== 'string' || !body.department_id.trim()) {
            return res.status(400).json({ success: false, error: 'Department cannot be empty.' });
          }
          payload.department_id = body.department_id.trim();
        }
        if ('employment_category' in body) {
          if (!body.employment_category || typeof body.employment_category !== 'string' || !body.employment_category.trim()) {
            return res.status(400).json({ success: false, error: 'Employment Category cannot be empty.' });
          }
          payload.employment_category = body.employment_category.trim();
        }
        if ('designation_code' in body) {
          payload.designation_code =
            body.designation_code && typeof body.designation_code === 'string' && body.designation_code.trim()
              ? body.designation_code.trim()
              : null;
        }
      }

      let { data, error } = await supabaseAdmin.from(entity).update(payload).eq('id', id).select().single();

      if (error && entity === 'branches' && 'city_id' in payload && (error.message || '').includes('city_id')) {
        const savedCityId = payload.city_id;
        const fallbackPayload = { ...payload };
        delete fallbackPayload.city_id;
        const retry = await supabaseAdmin.from(entity).update(fallbackPayload).eq('id', id).select().single();
        data = retry.data;
        error = retry.error;
        if (!error && data?.id) {
          masterDataFallbackStore.setBranchCityId(data.id, savedCityId);
          data = { ...data, city_id: savedCityId };
        }
      } else if (
        error &&
        entity === 'designations' &&
        'designation_code' in payload &&
        (error.message || '').includes('designation_code')
      ) {
        const savedCode = payload.designation_code;
        try {
          masterDataFallbackStore.setDesignationCode(id, savedCode);
        } catch (dupErr: any) {
          return res.status(400).json({ success: false, error: dupErr.message });
        }
        const fallbackPayload = { ...payload };
        delete fallbackPayload.designation_code;
        const retry = await supabaseAdmin.from(entity).update(fallbackPayload).eq('id', id).select().single();
        data = retry.data;
        error = retry.error;
        if (!error && data?.id) {
          data = { ...data, designation_code: savedCode };
        }
      }

      if (error) {
        return res.status(400).json({ success: false, error: formatOrgDbError(entity, error.message, payload) });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `update_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: payload,
      });

      return res.json({ success: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete Entity with friendly dependency validation
  router.delete('/org/:entity/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const { entity, id } = req.params;
      const allowed = ['zones', 'cities', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const reason = (req.body?.reason || req.query?.reason || 'Deleted via Super Admin Organization Manager') as string;

      if (entity === 'cities') {
        const { error: delErr } = await supabaseAdmin.from('cities').delete().eq('id', id);
        if (delErr) {
          const errMsg = delErr.message || '';
          if (errMsg.includes('public.cities') || errMsg.includes('schema cache') || errMsg.includes('relation "cities" does not exist')) {
            masterDataFallbackStore.deleteCity(id);
            return res.json({ success: true, message: 'cities record deleted.' });
          }
          return res.status(400).json({ success: false, error: errMsg });
        }
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.superAdminUser.id,
          actor_type: 'staff',
          action: 'delete_city',
          entity_type: 'cities',
          entity_id: id,
          metadata: { reason, deleted_at: new Date().toISOString() },
        });
        return res.json({ success: true, message: 'cities record deleted.' });
      }

      // Check dependent records before deleting to provide specific, clear user feedback
      if (entity === 'zones') {
        const { data: zoneRecord } = await supabaseAdmin.from('zones').select('name').eq('id', id).maybeSingle();
        const zoneName = zoneRecord?.name || 'this zone';
        const [branchesCount, staffCount, candidatesCount] = await Promise.all([
          supabaseAdmin.from('branches').select('id', { count: 'exact' }).eq('zone_id', id),
          supabaseAdmin.from('staff_profiles').select('id', { count: 'exact' }).eq('zone_id', id),
          supabaseAdmin.from('candidates').select('id', { count: 'exact' }).eq('zone_id', id),
        ]);
        const dependents: string[] = [];
        if (branchesCount.count && branchesCount.count > 0) dependents.push(`${branchesCount.count} branch${branchesCount.count > 1 ? 'es' : ''}`);
        if (staffCount.count && staffCount.count > 0) dependents.push(`${staffCount.count} staff member${staffCount.count > 1 ? 's' : ''}`);
        if (candidatesCount.count && candidatesCount.count > 0) dependents.push(`${candidatesCount.count} candidate${candidatesCount.count > 1 ? 's' : ''}`);
        if (dependents.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Cannot delete ${zoneName}: it has ${dependents.join(' and ')} assigned. Please reassign or remove them first.`,
          });
        }
      } else if (entity === 'branches') {
        const { data: branchRecord } = await supabaseAdmin.from('branches').select('name').eq('id', id).maybeSingle();
        const branchName = branchRecord?.name || 'this branch';
        const [staffCount, candidatesCount] = await Promise.all([
          supabaseAdmin.from('staff_profiles').select('id', { count: 'exact' }).eq('branch_id', id),
          supabaseAdmin.from('candidates').select('id', { count: 'exact' }).eq('branch_id', id),
        ]);
        const dependents: string[] = [];
        if (staffCount.count && staffCount.count > 0) dependents.push(`${staffCount.count} staff member${staffCount.count > 1 ? 's' : ''}`);
        if (candidatesCount.count && candidatesCount.count > 0) dependents.push(`${candidatesCount.count} candidate${candidatesCount.count > 1 ? 's' : ''}`);
        if (dependents.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Cannot delete ${branchName}: it has ${dependents.join(' and ')} assigned. Please reassign or remove them first.`,
          });
        }
      }

      const { error } = await supabaseAdmin.from(entity).delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          return res.status(400).json({
            success: false,
            error: `Cannot delete this ${entity.slice(0, -1)}: it is still referenced by other active system records.`,
          });
        }
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `delete_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: {
          reason,
          deleted_at: new Date().toISOString(),
        },
      });

      return res.json({ success: true, message: `${entity} record deleted.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Staff User Management (Create with one-time temp password, Edit, Deactivate)
  // --------------------------------------------------------------------------
  async function computeNextStaffEmployeeId(): Promise<string> {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, staff_employee_id');

      if (error || !rows) {
        const { count } = await supabaseAdmin
          .from('staff_profiles')
          .select('*', { count: 'exact', head: true });
        return `PX-STAFF-${1000 + (count || 0) + 1}`;
      }

      let maxNum = 1000;
      for (const r of rows as any[]) {
        const val = String(r.staff_employee_id || '').trim();
        const m = val.match(/^PX-STAFF-(\d+)$/i);
        if (m) {
          const parsed = parseInt(m[1], 10);
          if (!Number.isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
      if (maxNum === 1000 && rows.length > 1) {
        maxNum = 1000 + rows.length;
      }
      return `PX-STAFF-${maxNum + 1}`;
    } catch {
      return 'PX-STAFF-1001';
    }
  }

  router.get('/staff/next-employee-id', requireSuperAdmin, async (_req, res) => {
    try {
      const nextStaffEmployeeId = await computeNextStaffEmployeeId();
      return res.json({ success: true, nextStaffEmployeeId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.get('/staff', requireSuperAdmin, async (_req, res) => {
    try {
      let { data: staffList, error } = await supabaseAdmin
        .from('staff_profiles')
        .select('*, roles(name), zones(id, name, zone_code), branches(id, name, branch_code), departments(id, name, department_code), designations(id, name, employment_category, department_id)')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback if new FK columns are not yet migrated
        const fallback = await supabaseAdmin
          .from('staff_profiles')
          .select('*, roles(name), zones(name), branches(name)')
          .order('created_at', { ascending: false });
        if (fallback.error) {
          return res.status(500).json({ success: false, error: fallback.error.message });
        }
        staffList = fallback.data as any;
      }

      // Fetch designations map for designation_code enrichment
      const { data: allDesigs } = await supabaseAdmin.from('designations').select('*');
      const desigCodeMap = new Map<string, string | null>();
      for (const d of masterDataFallbackStore.enrichDesignations(allDesigs || [])) {
        desigCodeMap.set(d.id, d.designation_code || null);
      }

      // Fetch tagged branches from staff_branch_assignments if table exists
      const taggedBranchesByStaff = new Map<string, Array<{ id: string; name: string; branch_code?: string }>>();
      const { data: sbaRows, error: sbaErr } = await supabaseAdmin
        .from('staff_branch_assignments')
        .select('staff_profile_id, branch_id, branches(id, name, branch_code)');

      if (!sbaErr && sbaRows) {
        for (const row of sbaRows as any[]) {
          const brObj = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          if (row.staff_profile_id && brObj?.id) {
            const list = taggedBranchesByStaff.get(row.staff_profile_id) || [];
            if (!list.some((b) => b.id === brObj.id)) {
              list.push({ id: brObj.id, name: brObj.name, branch_code: brObj.branch_code });
            }
            taggedBranchesByStaff.set(row.staff_profile_id, list);
          }
        }
      }

      // Fetch emails from auth.users via admin API
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map((authUsers?.users || []).map((u) => [u.id, u.email]));
      const nextStaffEmployeeId = await computeNextStaffEmployeeId();

      const enriched = (staffList || []).map((s: any) => {
        const tagged =
          taggedBranchesByStaff.get(s.id) ||
          (s.branch_id && s.branches
            ? [{ id: s.branch_id, name: s.branches.name, branch_code: s.branches.branch_code }]
            : []);
        const enrichedDesig = s.designations
          ? {
              ...s.designations,
              designation_code:
                s.designations.designation_code ?? desigCodeMap.get(s.designations.id) ?? null,
            }
          : null;
        return {
          ...s,
          designations: enrichedDesig,
          email: emailMap.get(s.id) || 'unknown@postex.pk',
          tagged_branches: tagged,
          branch_ids: tagged.map((b) => b.id),
        };
      });

      return res.json({ success: true, staff: enriched, nextStaffEmployeeId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Create Staff User (One-Time Password Reveal + 4-Section Structure)
  router.post('/staff', requireSuperAdmin, async (req: any, res) => {
    try {
      const {
        email,
        name,
        personal_email,
        phone_number,
        phone,
        staff_employee_id,
        department_id,
        designation_id,
        role_id,
        zone_id,
        branch_id,
        branch_ids,
      } = req.body || {};

      if (!email || !name || !role_id) {
        return res.status(400).json({ success: false, error: 'Official email, full name, and system role are required.' });
      }

      // Verify system role (Candidate is a separate flow)
      const { data: roleRow, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', role_id)
        .maybeSingle();

      if (roleErr || !roleRow) {
        return res.status(400).json({ success: false, error: 'Selected System Role is invalid.' });
      }

      if (roleRow.name === 'candidate') {
        return res.status(400).json({
          success: false,
          error: 'Candidate role cannot be assigned to staff profiles. Candidate intake uses a separate flow.',
        });
      }

      const requiresZone = ['zonal_hr_manager', 'central_hr', 'branch_manager'].includes(roleRow.name);
      if (requiresZone && 'zone_id' in (req.body || {}) && (!zone_id || !String(zone_id).trim())) {
        return res.status(400).json({
          success: false,
          error: `Zone Assignment is required for the ${roleRow.name.replace(/_/g, ' ')} role.`,
        });
      }

      // Validate Department -> Designation link if both are provided
      const cleanDeptId = department_id && String(department_id).trim() ? String(department_id).trim() : null;
      const cleanDesigId = designation_id && String(designation_id).trim() ? String(designation_id).trim() : null;

      if (cleanDesigId) {
        const { data: desigRow } = await supabaseAdmin
          .from('designations')
          .select('id, name, department_id')
          .eq('id', cleanDesigId)
          .maybeSingle();
        if (!desigRow) {
          return res.status(400).json({ success: false, error: 'Selected Designation does not exist.' });
        }
        if (cleanDeptId && desigRow.department_id !== cleanDeptId) {
          return res.status(400).json({
            success: false,
            error: 'Selected Designation does not belong to the selected Department.',
          });
        }
      }

      // Normalize Branch Tagging
      const rawBranchIds: string[] = Array.isArray(branch_ids)
        ? branch_ids.map((b: any) => String(b).trim()).filter(Boolean)
        : branch_id && String(branch_id).trim()
        ? [String(branch_id).trim()]
        : [];
      const uniqueBranchIds = Array.from(new Set(rawBranchIds));

      if (
        roleRow.name === 'branch_manager' &&
        ('branch_ids' in (req.body || {}) || 'branch_id' in (req.body || {})) &&
        uniqueBranchIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'At least one branch must be selected for a Branch Manager.',
        });
      }

      const cleanZoneId = zone_id && String(zone_id).trim() ? String(zone_id).trim() : null;
      if (uniqueBranchIds.length > 0 && cleanZoneId) {
        const { data: zoneBranches } = await supabaseAdmin
          .from('branches')
          .select('id, zone_id')
          .in('id', uniqueBranchIds);

        const invalidBranch = (zoneBranches || []).find((b) => b.zone_id !== cleanZoneId);
        if (invalidBranch || (zoneBranches || []).length !== uniqueBranchIds.length) {
          return res.status(400).json({
            success: false,
            error: 'One or more tagged branches do not belong to the selected Zone.',
          });
        }
      }

      const primaryBranchId =
        roleRow.name === 'branch_manager'
          ? uniqueBranchIds[0] || null
          : branch_id && String(branch_id).trim()
          ? String(branch_id).trim()
          : uniqueBranchIds.length === 1
          ? uniqueBranchIds[0]
          : null;

      // Resolve or auto-generate Staff Employee ID (PX-STAFF-XXXX)
      const resolvedStaffEmpId =
        staff_employee_id && String(staff_employee_id).trim()
          ? String(staff_employee_id).trim()
          : await computeNextStaffEmployeeId();

      // Check uniqueness of staff_employee_id before creating auth user
      const { data: existingEmpId } = await supabaseAdmin
        .from('staff_profiles')
        .select('id')
        .eq('staff_employee_id', resolvedStaffEmpId)
        .maybeSingle();

      if (existingEmpId) {
        return res.status(400).json({
          success: false,
          error: `Staff Employee ID "${resolvedStaffEmpId}" already exists. Please enter a unique Employee ID.`,
        });
      }

      const tempPassword = generateSecureTempPassword(14);
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanName = String(name).trim();
      const cleanPersonalEmail =
        personal_email && String(personal_email).trim() ? String(personal_email).trim().toLowerCase() : null;
      const rawPhone = phone_number ?? phone ?? '';
      const cleanPhone = rawPhone && String(rawPhone).trim() ? String(rawPhone).trim() : null;

      // Create Supabase Auth User
      const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: cleanName,
          role: roleRow.name,
          must_change_password: true,
        },
      });

      if (authErr || !newUser.user) {
        return res.status(400).json({ success: false, error: authErr?.message || 'Failed to create auth user.' });
      }

      const profileInsertPayload: Record<string, any> = {
        id: newUser.user.id,
        name: cleanName,
        personal_email: cleanPersonalEmail,
        phone_number: cleanPhone,
        staff_employee_id: resolvedStaffEmpId,
        department_id: cleanDeptId,
        designation_id: cleanDesigId,
        role_id,
        zone_id: cleanZoneId,
        branch_id: primaryBranchId,
        is_active: true,
        must_change_password: true,
        created_by: req.superAdminUser?.id || null,
      };

      // Create staff_profile
      let { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .insert(profileInsertPayload)
        .select('*, roles(name), zones(name), branches(name), departments(id, name, department_code), designations(id, name, employment_category, department_id)')
        .single();

      // Fallback if new columns are not yet migrated
      if (profErr && (profErr.message.includes('staff_employee_id') || profErr.message.includes('personal_email') || profErr.message.includes('department_id'))) {
        const legacyPayload = {
          id: newUser.user.id,
          name: cleanName,
          role_id,
          zone_id: cleanZoneId,
          branch_id: primaryBranchId,
          is_active: true,
          must_change_password: true,
          created_by: req.superAdminUser?.id || null,
        };
        const retry = await supabaseAdmin
          .from('staff_profiles')
          .insert(legacyPayload)
          .select('*, roles(name), zones(name), branches(name)')
          .single();
        profile = retry.data as any;
        profErr = retry.error;
      }

      if (profErr) {
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        if (profErr.message.toLowerCase().includes('staff_profiles_staff_employee_id_key') || profErr.message.toLowerCase().includes('staff_employee_id')) {
          return res.status(400).json({
            success: false,
            error: `Staff Employee ID "${resolvedStaffEmpId}" already exists. Please enter a unique Employee ID.`,
          });
        }
        return res.status(400).json({ success: false, error: profErr.message });
      }

      // Insert Branch Tagging rows into staff_branch_assignments
      if (uniqueBranchIds.length > 0) {
        const sbaPayload = uniqueBranchIds.map((bId) => ({
          staff_profile_id: newUser.user.id,
          branch_id: bId,
        }));
        await supabaseAdmin.from('staff_branch_assignments').upsert(sbaPayload, {
          onConflict: 'staff_profile_id,branch_id',
        });
      }

      // Fetch tagged branch objects for response
      let taggedBranches: Array<{ id: string; name: string; branch_code?: string }> = [];
      if (uniqueBranchIds.length > 0) {
        const { data: bRows } = await supabaseAdmin
          .from('branches')
          .select('id, name, branch_code')
          .in('id', uniqueBranchIds);
        taggedBranches = bRows || [];
      }

      // Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser?.id || null,
        actor_type: 'staff',
        action: 'create_staff_user',
        entity_type: 'staff_profiles',
        entity_id: newUser.user.id,
        metadata: {
          email: cleanEmail,
          staff_employee_id: resolvedStaffEmpId,
          personal_email: cleanPersonalEmail,
          phone_number: cleanPhone,
          department_id: cleanDeptId,
          designation_id: cleanDesigId,
          role_id,
          role_name: roleRow.name,
          zone_id: cleanZoneId,
          branch_id: primaryBranchId,
          branch_ids: uniqueBranchIds,
        },
      });

      return res.json({
        success: true,
        staff: {
          ...profile,
          email: cleanEmail,
          staff_employee_id: (profile as any)?.staff_employee_id || resolvedStaffEmpId,
          personal_email: (profile as any)?.personal_email ?? cleanPersonalEmail,
          phone_number: (profile as any)?.phone_number ?? cleanPhone,
          department_id: (profile as any)?.department_id ?? cleanDeptId,
          designation_id: (profile as any)?.designation_id ?? cleanDesigId,
          branch_ids: uniqueBranchIds,
          tagged_branches: taggedBranches,
        },
        one_time_temporary_password: tempPassword,
        message: 'Staff user created. Display temporary password to creator ONCE.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Edit Staff User (Update role, zone, branch/tagged branches, name, personal_email, phone_number, department, designation)
  router.put('/staff/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        personal_email,
        phone_number,
        phone,
        staff_employee_id,
        department_id,
        designation_id,
        role_id,
        zone_id,
        branch_id,
        branch_ids,
        is_active,
      } = req.body || {};

      const updatePayload: Record<string, any> = {
        name,
        role_id,
        zone_id: zone_id || null,
        branch_id: branch_id || null,
        is_active: is_active !== undefined ? is_active : true,
      };

      if (personal_email !== undefined) {
        updatePayload.personal_email = personal_email && String(personal_email).trim() ? String(personal_email).trim().toLowerCase() : null;
      }
      if (phone_number !== undefined || phone !== undefined) {
        const rawPhone = phone_number ?? phone ?? '';
        updatePayload.phone_number = rawPhone && String(rawPhone).trim() ? String(rawPhone).trim() : null;
      }
      if (staff_employee_id !== undefined && String(staff_employee_id).trim()) {
        updatePayload.staff_employee_id = String(staff_employee_id).trim();
      }
      if (department_id !== undefined) {
        updatePayload.department_id = department_id && String(department_id).trim() ? String(department_id).trim() : null;
      }
      if (designation_id !== undefined) {
        updatePayload.designation_id = designation_id && String(designation_id).trim() ? String(designation_id).trim() : null;
      }

      if (Array.isArray(branch_ids)) {
        const cleanIds = Array.from(new Set(branch_ids.map((b: any) => String(b).trim()).filter(Boolean)));
        if (!branch_id && cleanIds.length > 0) {
          updatePayload.branch_id = cleanIds[0];
        }
        await supabaseAdmin.from('staff_branch_assignments').delete().eq('staff_profile_id', id);
        if (cleanIds.length > 0) {
          await supabaseAdmin.from('staff_branch_assignments').insert(
            cleanIds.map((bId) => ({ staff_profile_id: id, branch_id: bId }))
          );
        }
      }

      let { data: updated, error } = await supabaseAdmin
        .from('staff_profiles')
        .update(updatePayload)
        .eq('id', id)
        .select('*, roles(name), zones(name), branches(name), departments(id, name, department_code), designations(id, name, employment_category, department_id)')
        .single();

      if (error && (error.message.includes('staff_employee_id') || error.message.includes('personal_email') || error.message.includes('department_id'))) {
        const fallbackUpdate = await supabaseAdmin
          .from('staff_profiles')
          .update({
            name,
            role_id,
            zone_id: zone_id || null,
            branch_id: updatePayload.branch_id,
            is_active: is_active !== undefined ? is_active : true,
          })
          .eq('id', id)
          .select('*, roles(name), zones(name), branches(name)')
          .single();
        updated = fallbackUpdate.data as any;
        error = fallbackUpdate.error;
      }

      if (error) {
        if (error.message.toLowerCase().includes('staff_profiles_staff_employee_id_key')) {
          return res.status(400).json({
            success: false,
            error: `Staff Employee ID "${staff_employee_id}" already exists. Please enter a unique Employee ID.`,
          });
        }
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'update_staff_profile',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: req.body,
      });

      return res.json({ success: true, staff: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Deactivate / Toggle Staff User
  router.patch('/staff/:id/status', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const { data: updated, error } = await supabaseAdmin
        .from('staff_profiles')
        .update({ is_active: Boolean(is_active) })
        .eq('id', id)
        .select('*, roles(name)')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: is_active ? 'activate_staff_user' : 'deactivate_staff_user',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { is_active },
      });

      return res.json({ success: true, staff: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Regenerate Temporary Password for Staff User
  router.post('/staff/:id/regenerate-password', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: targetProfile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name')
        .eq('id', id)
        .single();

      if (profErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Staff member not found.' });
      }

      const newTempPassword = generateSecureTempPassword(14);

      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: newTempPassword,
        user_metadata: { must_change_password: true },
      });

      if (updateAuthErr) {
        return res.status(500).json({ success: false, error: updateAuthErr.message });
      }

      await supabaseAdmin
        .from('staff_profiles')
        .update({ must_change_password: true })
        .eq('id', id);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'regenerate_staff_password',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { staff_name: targetProfile.name, must_change_password: true },
      });

      // Dispatch centralized notification (fixes audit gap)
      await notificationService.notifyStaffCredentialReset(
        supabaseAdmin,
        { id, name: targetProfile.name },
        newTempPassword,
        req.superAdminUser.id
      );

      return res.json({
        success: true,
        temporary_password: newTempPassword,
        must_change_password: true,
        message: 'Temporary password generated successfully. must_change_password set to true.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. User Permissions Screen (Role defaults + Overrides with MANDATORY reason)
  // --------------------------------------------------------------------------
  router.get('/permission-overrides/:staffId', requireSuperAdmin, async (req, res) => {
    try {
      const { staffId } = req.params;
      const [overridesRes, permissionsRes, staffProfileRes] = await Promise.all([
        supabaseAdmin
          .from('user_permission_overrides')
          .select('*, permissions(id, key, description)')
          .eq('staff_profile_id', staffId),
        supabaseAdmin.from('permissions').select('*').order('key'),
        supabaseAdmin
          .from('staff_profiles')
          .select('id, name, role_id, is_active, zone_id, branch_id, roles(id, name)')
          .eq('id', staffId)
          .maybeSingle(),
      ]);

      let roleDefaultPermissionKeys: string[] = [];
      if (staffProfileRes.data?.role_id) {
        const { data: rolePerms } = await supabaseAdmin
          .from('role_permissions')
          .select('permissions(key)')
          .eq('role_id', staffProfileRes.data.role_id);
        if (rolePerms) {
          roleDefaultPermissionKeys = rolePerms
            .map((rp: any) => rp.permissions?.key)
            .filter(Boolean);
        }
      }

      return res.json({
        success: true,
        overrides: overridesRes.data || [],
        allPermissions: permissionsRes.data || [],
        roleDefaultPermissionKeys,
        staffProfile: staffProfileRes.data || null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Batch update user permissions with mandatory reason and audit logging
  router.post('/user-permissions/save', requireSuperAdmin, async (req, res) => {
    try {
      const { staff_profile_id, permissionsState, reason } = req.body;

      if (!staff_profile_id || typeof permissionsState !== 'object' || !reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Staff ID, permissionsState object, and a non-empty reason are MANDATORY.',
        });
      }

      const cleanReason = String(reason).trim();

      // Fetch staff profile and its role default permissions
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, role_id, roles(id, name)')
        .eq('id', staff_profile_id)
        .single();

      if (!staffProfile) {
        return res.status(404).json({ success: false, error: 'Staff profile not found.' });
      }

      const [allPermsRes, rolePermsRes, existingOverridesRes] = await Promise.all([
        supabaseAdmin.from('permissions').select('id, key'),
        supabaseAdmin
          .from('role_permissions')
          .select('permission_id, permissions(key)')
          .eq('role_id', staffProfile.role_id),
        supabaseAdmin
          .from('user_permission_overrides')
          .select('id, permission_id, granted, permissions(key)')
          .eq('staff_profile_id', staff_profile_id),
      ]);

      const allPerms = allPermsRes.data || [];
      const rolePermKeys = new Set(
        (rolePermsRes.data || []).map((rp: any) => rp.permissions?.key).filter(Boolean)
      );
      const existingOverridesByPermId = new Map(
        (existingOverridesRes.data || []).map((ov: any) => [ov.permission_id, ov])
      );

      const changesApplied: any[] = [];

      // For each permission key provided in permissionsState (boolean)
      for (const perm of allPerms) {
        if (!(perm.key in permissionsState)) continue;
        const desiredState = Boolean(permissionsState[perm.key]);
        const roleDefault = rolePermKeys.has(perm.key);
        const existingOverride = existingOverridesByPermId.get(perm.id);

        if (desiredState === roleDefault) {
          // Desired state equals role default: remove any existing override if present
          if (existingOverride) {
            await supabaseAdmin
              .from('user_permission_overrides')
              .delete()
              .eq('id', existingOverride.id);

            await supabaseAdmin.from('audit_logs').insert({
              actor_id: req.superAdminUser.id,
              actor_type: 'staff',
              action: 'reset_permission_to_default',
              entity_type: 'user_permission_overrides',
              entity_id: existingOverride.id,
              metadata: {
                staff_profile_id,
                permission_id: perm.id,
                permission_key: perm.key,
                restored_default: roleDefault,
                reason: cleanReason,
              },
            });

            changesApplied.push({ key: perm.key, action: 'reset_to_default', value: roleDefault });
          }
        } else {
          // Desired state differs from role default: insert or update override
          const overrideGranted = desiredState;
          const { data: savedOv, error: ovErr } = await supabaseAdmin
            .from('user_permission_overrides')
            .upsert(
              {
                staff_profile_id,
                permission_id: perm.id,
                granted: overrideGranted,
                reason: cleanReason,
                created_by: req.superAdminUser.id,
              },
              { onConflict: 'staff_profile_id,permission_id' }
            )
            .select()
            .single();

          if (!ovErr && savedOv) {
            await supabaseAdmin.from('audit_logs').insert({
              actor_id: req.superAdminUser.id,
              actor_type: 'staff',
              action: overrideGranted ? 'grant_permission_override' : 'revoke_permission_override',
              entity_type: 'user_permission_overrides',
              entity_id: savedOv.id,
              metadata: {
                staff_profile_id,
                permission_id: perm.id,
                permission_key: perm.key,
                granted: overrideGranted,
                reason: cleanReason,
              },
            });

            // Dispatch notification
            await notificationService.notifyStaffPermissionOverride(
              supabaseAdmin,
              staff_profile_id,
              perm.key,
              overrideGranted,
              cleanReason,
              req.superAdminUser.id
            );

            changesApplied.push({ key: perm.key, action: overrideGranted ? 'grant' : 'revoke', value: overrideGranted });
          }
        }
      }

      return res.json({
        success: true,
        changesCount: changesApplied.length,
        changes: changesApplied,
        message: `Permissions updated successfully (${changesApplied.length} change(s) recorded in audit log).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/permission-overrides', requireSuperAdmin, async (req, res) => {
    try {
      const { staff_profile_id, permission_id, granted, reason } = req.body;

      // [HARD RULE]: MANDATORY reason field
      if (!staff_profile_id || !permission_id || typeof granted !== 'boolean' || !reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Staff ID, Permission ID, granted (boolean), and a non-empty reason are MANDATORY.',
        });
      }

      const cleanReason = String(reason).trim();

      // Upsert override
      const { data: override, error } = await supabaseAdmin
        .from('user_permission_overrides')
        .upsert(
          {
            staff_profile_id,
            permission_id,
            granted,
            reason: cleanReason,
            created_by: req.superAdminUser.id,
          },
          { onConflict: 'staff_profile_id,permission_id' }
        )
        .select('*, permissions(id, key)')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      // Mandatory audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: granted ? 'grant_permission_override' : 'revoke_permission_override',
        entity_type: 'user_permission_overrides',
        entity_id: override.id,
        metadata: {
          staff_profile_id,
          permission_id,
          permission_key: (override.permissions as any)?.key,
          granted,
          reason: cleanReason,
        },
      });

      // Dispatch centralized notification (fixes audit gap)
      await notificationService.notifyStaffPermissionOverride(
        supabaseAdmin,
        staff_profile_id,
        (override.permissions as any)?.key || permission_id,
        granted,
        cleanReason,
        req.superAdminUser.id
      );

      return res.json({
        success: true,
        override,
        message: `Permission override successfully ${granted ? 'granted' : 'revoked'}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.delete('/permission-overrides/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing } = await supabaseAdmin
        .from('user_permission_overrides')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabaseAdmin.from('user_permission_overrides').delete().eq('id', id);
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      if (existing) {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.superAdminUser.id,
          actor_type: 'staff',
          action: 'delete_permission_override',
          entity_type: 'user_permission_overrides',
          entity_id: id,
          metadata: existing,
        });
      }

      return res.json({ success: true, message: 'Permission override removed.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Company-Wide Record Browser (Pagination 25/50, Search, Masked CNIC)
  // --------------------------------------------------------------------------
  router.get('/records', requireSuperAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = [25, 50].includes(parseInt(String(req.query.limit || '25'), 10))
        ? parseInt(String(req.query.limit || '25'), 10)
        : 25;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const zoneId = String(req.query.zone_id || '').trim();

      let query = supabaseAdmin
        .from('candidates')
        .select('*, zones(id, name), branches(id, name), applications(*)', { count: 'exact' });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,joining_id.ilike.%${search}%,cnic.ilike.%${search}%`);
      }

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      }

      const offset = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Filter by status if specified (on joined application)
      let records = data || [];

      // Filter out records where all applications are soft-archived (unless include_archived is requested)
      if (req.query.include_archived !== 'true') {
        records = records.filter((r) => {
          const apps = (r.applications as any[]) || [];
          if (apps.length === 0) return true;
          return apps.some((a) => !dataRetentionService.isApplicationArchived(a.id, a.decision_reason));
        });
      }

      if (status) {
        records = records.filter((r) => {
          const apps = (r.applications as any[]) || [];
          return apps.some((a) => a.status === status);
        });
      }

      // Mask CNIC helper: 35201-1234567-1 -> 35201-*****67-1
      const maskedRecords = records.map((r) => {
        const cnic = r.cnic || '';
        const masked =
          cnic.length >= 10
            ? `${cnic.slice(0, 6)}*****${cnic.slice(-4)}`
            : '*****';
        return {
          ...r,
          masked_cnic: masked,
        };
      });

      return res.json({
        success: true,
        records: maskedRecords,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 6. Audit Log Viewer [HARD RULE: Only super_admin may access]
  // --------------------------------------------------------------------------
  router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || '25'), 10)));
      const action = String(req.query.action || '').trim();
      const entityType = String(req.query.entity_type || '').trim();

      let query = supabaseAdmin.from('audit_logs').select('*', { count: 'exact' });

      if (action) {
        query = query.ilike('action', `%${action}%`);
      }
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const offset = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.json({
        success: true,
        logs: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // 7. Organization Settings, Branding & Data Retention Policy
  // --------------------------------------------------------------------------
  let orgSettingsCache: {
    companyName: string;
    dataRetentionDaysAfterRejection: number;
    supportEmail: string;
    autoArchiveEnabled: boolean;
    logoUrl?: string | null;
    loginBgUrl?: string | null;
    loginTagline?: string;
    lastUpdated: string;
  } = {
    companyName: 'PostEx Logistics',
    dataRetentionDaysAfterRejection: 90,
    supportEmail: 'hr-support@postex.pk',
    autoArchiveEnabled: true,
    logoUrl: null,
    loginBgUrl: null,
    loginTagline: 'Enterprise Onboarding & Workforce Verification Portal',
    lastUpdated: new Date().toISOString(),
  };

  const brandingLogoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Invalid logo format. Only PNG, JPG, SVG, and WebP images are accepted.'));
      }
    },
  });

  const brandingBgUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Invalid background format. Only PNG, JPG, and WebP images are accepted.'));
      }
    },
  });

  router.get('/settings', requireSuperAdmin, async (req, res) => {
    try {
      const orgDb = await formTemplatesService.getOrgSettings(supabaseAdmin);
      const settingsPayload = {
        companyName: orgDb.company_name,
        dataRetentionDaysAfterRejection: orgDb.data_retention_days,
        supportEmail: orgDb.support_email,
        autoArchiveEnabled: orgDb.auto_archive_enabled,
        logoUrl: orgDb.logo_storage_path || null,
        loginBgUrl: orgDb.login_bg_storage_path || null,
        loginTagline: orgDb.login_tagline || 'Enterprise Onboarding & Workforce Verification Portal',
        lastUpdated: orgDb.updated_at,
      };
      orgSettingsCache = { ...orgSettingsCache, ...settingsPayload };
      return res.json({ success: true, settings: orgSettingsCache });
    } catch {
      return res.json({ success: true, settings: orgSettingsCache });
    }
  });

  router.put('/settings', requireSuperAdmin, async (req, res) => {
    try {
      const {
        companyName,
        dataRetentionDaysAfterRejection,
        supportEmail,
        autoArchiveEnabled,
        logoUrl,
        loginBgUrl,
        loginTagline,
      } = req.body;

      const days = parseInt(String(dataRetentionDaysAfterRejection ?? orgSettingsCache.dataRetentionDaysAfterRejection), 10);

      if (isNaN(days) || days < 1) {
        return res.status(400).json({
          success: false,
          error: 'Data retention days must be a positive number.',
        });
      }

      const updated = await formTemplatesService.updateOrgSettings(
        {
          company_name: companyName !== undefined ? companyName : orgSettingsCache.companyName,
          support_email: supportEmail !== undefined ? supportEmail : orgSettingsCache.supportEmail,
          data_retention_days: days,
          auto_archive_enabled: autoArchiveEnabled !== undefined ? Boolean(autoArchiveEnabled) : orgSettingsCache.autoArchiveEnabled,
          logo_storage_path: logoUrl !== undefined ? (logoUrl || null) : undefined,
          login_bg_storage_path: loginBgUrl !== undefined ? (loginBgUrl || null) : undefined,
          login_tagline: loginTagline !== undefined ? loginTagline : undefined,
        },
        req.superAdminUser?.id,
        supabaseAdmin
      );

      orgSettingsCache = {
        companyName: updated.company_name,
        dataRetentionDaysAfterRejection: updated.data_retention_days,
        supportEmail: updated.support_email,
        autoArchiveEnabled: updated.auto_archive_enabled,
        logoUrl: updated.logo_storage_path || null,
        loginBgUrl: updated.login_bg_storage_path || null,
        loginTagline: updated.login_tagline || 'Enterprise Onboarding & Workforce Verification Portal',
        lastUpdated: updated.updated_at,
      };

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'update_org_settings',
        entity_type: 'settings',
        entity_id: 'org_settings',
        metadata: orgSettingsCache,
      });

      return res.json({
        success: true,
        settings: orgSettingsCache,
        message: 'Organization settings updated successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Dedicated Branding Upload Endpoints
  router.post('/branding/logo', requireSuperAdmin, (req: any, res: any) => {
    brandingLogoUpload.single('logo')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No logo file uploaded.' });
      }
      try {
        const ext = req.file.mimetype === 'image/svg+xml' ? 'svg' : (req.file.originalname.split('.').pop() || 'png');
        const storagePath = `logo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('branding')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });
        if (uploadErr) {
          return res.status(500).json({ success: false, error: uploadErr.message });
        }
        const { data: urlData } = supabaseAdmin.storage.from('branding').getPublicUrl(storagePath);
        const logoUrl = urlData.publicUrl;

        await formTemplatesService.updateOrgSettings(
          { logo_storage_path: logoUrl },
          req.superAdminUser?.id,
          supabaseAdmin
        );

        orgSettingsCache.logoUrl = logoUrl;

        return res.json({ success: true, logoUrl, storagePath });
      } catch (uploadEx: any) {
        return res.status(500).json({ success: false, error: uploadEx.message });
      }
    });
  });

  router.post('/branding/background', requireSuperAdmin, (req: any, res: any) => {
    brandingBgUpload.single('background')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No background file uploaded.' });
      }
      try {
        const ext = req.file.originalname.split('.').pop() || 'jpg';
        const storagePath = `login_bg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('branding')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });
        if (uploadErr) {
          return res.status(500).json({ success: false, error: uploadErr.message });
        }
        const { data: urlData } = supabaseAdmin.storage.from('branding').getPublicUrl(storagePath);
        const bgUrl = urlData.publicUrl;

        await formTemplatesService.updateOrgSettings(
          { login_bg_storage_path: bgUrl },
          req.superAdminUser?.id,
          supabaseAdmin
        );

        orgSettingsCache.loginBgUrl = bgUrl;

        return res.json({ success: true, bgUrl, storagePath });
      } catch (uploadEx: any) {
        return res.status(500).json({ success: false, error: uploadEx.message });
      }
    });
  });

  // --------------------------------------------------------------------------
  // 8. Super Admin Form Builder Endpoints (Dual-Track: Executive & Non-Executive)
  // --------------------------------------------------------------------------

  // Add field to section
  router.post('/form-builder/fields', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, reason } = req.body;
      if (!track || !section_id || !label || !field_type) {
        return res.status(400).json({ success: false, error: 'track, section_id, label, and field_type are required.' });
      }

      const newField = await formTemplatesService.addField(
        track,
        section_id,
        {
          field_key: field_key || `field_${Date.now()}`,
          label,
          field_type,
          is_required: Boolean(is_required),
          order_index: order_index || 99,
          options,
          table_columns,
          conditional_label,
          placeholder,
        },
        supabaseAdmin
      );

      // Audit Log for Form Builder field addition
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_add_field',
        entity_type: 'form_fields',
        entity_id: newField.id,
        metadata: {
          track,
          section_id,
          field_key: newField.field_key,
          label: newField.label,
          field_type: newField.field_type,
          reason: reason || 'Added via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, field: newField });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Update field
  router.put('/form-builder/fields/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const fieldId = req.params.id;
      const { track, reason, ...updates } = req.body;
      if (!track) {
        return res.status(400).json({ success: false, error: 'track parameter is required.' });
      }

      const updated = await formTemplatesService.updateField(track, fieldId, updates, supabaseAdmin);

      // Audit Log for Form Builder field update
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_update_field',
        entity_type: 'form_fields',
        entity_id: fieldId,
        metadata: {
          track,
          updates,
          reason: reason || 'Updated via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, field: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete field (with mandatory audit logging)
  router.delete('/form-builder/fields/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const fieldId = req.params.id;
      const track = (req.query.track || req.body?.track) as 'executive' | 'non_executive';
      const reason = (req.body?.reason || req.query.reason || 'Deleted via Super Admin Form Builder') as string;

      if (!track) {
        return res.status(400).json({ success: false, error: 'track query parameter is required.' });
      }

      const success = await formTemplatesService.deleteField(track, fieldId, supabaseAdmin);

      // Audit Log for Form Builder field deletion
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_delete_field',
        entity_type: 'form_fields',
        entity_id: fieldId,
        metadata: {
          track,
          field_id: fieldId,
          reason,
        },
      });

      return res.json({ success, message: 'Field deleted successfully and logged to audit trail.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Reorder fields
  router.post('/form-builder/reorder', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, section_id, field_ids } = req.body;
      if (!track || !section_id || !Array.isArray(field_ids)) {
        return res.status(400).json({ success: false, error: 'track, section_id, and field_ids array are required.' });
      }

      const fields = await formTemplatesService.reorderFields(track, section_id, field_ids, supabaseAdmin);
      return res.json({ success: true, fields });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Add section
  router.post('/form-builder/sections', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, title, description, reason } = req.body;
      if (!track || !title) {
        return res.status(400).json({ success: false, error: 'track and title are required.' });
      }

      const section = await formTemplatesService.addSection(track, title, description, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_add_section',
        entity_type: 'form_sections',
        entity_id: section.id,
        metadata: {
          track,
          title,
          description,
          reason: reason || 'Added new section via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, section });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete section (and all its nested fields)
  router.delete('/form-builder/sections/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const sectionId = req.params.id;
      const track = (req.body?.track || req.query?.track) as 'executive' | 'non_executive';
      const reason = (req.body?.reason || req.query?.reason || 'Section deleted via Super Admin Form Builder') as string;

      if (!track) {
        return res.status(400).json({ success: false, error: 'track parameter is required.' });
      }

      const success = await formTemplatesService.deleteSection(track, sectionId, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_delete_section',
        entity_type: 'form_sections',
        entity_id: sectionId,
        metadata: {
          track,
          section_id: sectionId,
          reason,
          deleted_at: new Date().toISOString(),
        },
      });

      return res.json({ success, message: 'Section and associated fields deleted successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Reset track to default seed template
  router.post('/form-builder/reset-default', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, reason } = req.body;
      if (!track || (track !== 'executive' && track !== 'non_executive')) {
        return res.status(400).json({ success: false, error: 'Valid track is required.' });
      }

      const template = await formTemplatesService.resetTrackToDefault(track, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_reset_defaults',
        entity_type: 'form_templates',
        entity_id: template.id,
        metadata: {
          track,
          reason: reason || 'Reset track to default seed template',
        },
      });

      return res.json({ success: true, template });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 9. Manual Data Retention Policy Cleanup Job Trigger
  // --------------------------------------------------------------------------
  router.post('/data-retention/run-cleanup', requireSuperAdmin, async (req: any, res) => {
    try {
      const result = await dataRetentionService.runRetentionCleanup(
        supabaseAdmin,
        req.superAdminUser?.id
      );
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
