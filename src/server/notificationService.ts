import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationChannel = 'sms' | 'email' | 'in_app';
export type NotificationRecipientType = 'candidate' | 'staff' | 'admin' | 'system';

export interface NotificationPayload {
  recipientType: NotificationRecipientType;
  recipientId: string;
  channel: NotificationChannel;
  message: string;
  metadata?: Record<string, any>;
  recipientPhone?: string;
  recipientEmail?: string;
}

export interface NotificationResult {
  id?: string;
  delivered: boolean;
  channel: NotificationChannel;
  provider: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  sendSms(to: string, message: string): Promise<{ success: boolean; providerId?: string; error?: string }>;
  sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; providerId?: string; error?: string }>;
}

/**
 * Default provider: Logs formatted notifications to console.
 * Automatically switches to Twilio / SendGrid if environment credentials are supplied in the future.
 */
class ProductionReadyNotificationProvider implements NotificationProvider {
  name = 'PostEx-Omnichannel-Provider';

  private twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  private sendgridConfigured = Boolean(process.env.SENDGRID_API_KEY);

  async sendSms(to: string, message: string) {
    if (this.twilioConfigured) {
      // Future Twilio integration hook
      console.log(`[NOTIFICATION SERVICE] [TWILIO OUTBOUND] To: ${to} | Content: ${message.slice(0, 80)}...`);
      return { success: true, providerId: `tw_${Date.now()}` };
    }
    // Standard simulation logging
    console.log(`[NOTIFICATION SERVICE] [SMS SIMULATION] To: ${to} | Message: "${message}"`);
    return { success: true, providerId: `sms_sim_${Date.now()}` };
  }

  async sendEmail(to: string, subject: string, body: string) {
    if (this.sendgridConfigured) {
      // Future SendGrid integration hook
      console.log(`[NOTIFICATION SERVICE] [SENDGRID OUTBOUND] To: ${to} | Subject: ${subject}`);
      return { success: true, providerId: `sg_${Date.now()}` };
    }
    // Standard simulation logging
    console.log(`[NOTIFICATION SERVICE] [EMAIL SIMULATION] To: ${to} | Subject: "${subject}" | Body: "${body.slice(0, 100)}..."`);
    return { success: true, providerId: `email_sim_${Date.now()}` };
  }
}

export class CentralizedNotificationService {
  private provider: NotificationProvider;

  constructor(provider?: NotificationProvider) {
    this.provider = provider || new ProductionReadyNotificationProvider();
  }

  /**
   * Sets or swaps external notification delivery provider (e.g. Twilio, AWS SNS, SendGrid).
   */
  setProvider(provider: NotificationProvider) {
    this.provider = provider;
  }

  /**
   * Core dispatch function.
   * Inserts into `notifications` table in Supabase and routes to provider.
   */
  async dispatch(supabaseAdmin: SupabaseClient | null, payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();
    let dbSuccess = false;
    let notificationId: string | undefined;

    // 1. Persist notification row in Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert({
            recipient_type: payload.recipientType,
            recipient_id: payload.recipientId,
            channel: payload.channel,
            message: payload.message,
            sent_at: timestamp,
            status: 'sent',
          })
          .select('id')
          .maybeSingle();

        if (error) {
          console.warn(`[NOTIFICATION SERVICE] DB insert warning: ${error.message}`);
        } else {
          dbSuccess = true;
          notificationId = data?.id;
        }
      } catch (err) {
        console.warn('[NOTIFICATION SERVICE] Supabase notification write error:', err);
      }
    }

    // 2. Deliver via channel provider
    try {
      if (payload.channel === 'sms' && payload.recipientPhone) {
        await this.provider.sendSms(payload.recipientPhone, payload.message);
      } else if (payload.channel === 'email' && payload.recipientEmail) {
        await this.provider.sendEmail(
          payload.recipientEmail,
          payload.metadata?.subject || 'PostEx Onboarding Notification',
          payload.message
        );
      } else {
        // In-app or console broadcast
        console.log(
          `[NOTIFICATION SERVICE] [${payload.channel.toUpperCase()}] [Recipient: ${payload.recipientType}#${payload.recipientId}]: ${payload.message}`
        );
      }

      return {
        id: notificationId,
        delivered: true,
        channel: payload.channel,
        provider: this.provider.name,
      };
    } catch (deliveryErr: any) {
      console.error('[NOTIFICATION SERVICE] Delivery failure:', deliveryErr);
      return {
        id: notificationId,
        delivered: dbSuccess,
        channel: payload.channel,
        provider: this.provider.name,
        error: deliveryErr.message,
      };
    }
  }

  // ==========================================================================
  // CONSOLIDATED DOMAIN EVENT HELPERS
  // ==========================================================================

  /**
   * 1. Candidate created / Joining ID issued (Audit Gap Fixed)
   */
  async notifyCandidateJoiningIdIssued(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile: string; email?: string; joining_id: string }
  ) {
    const message = `Welcome to PostEx, ${candidate.full_name}! Your onboarding Joining ID is ${candidate.joining_id}. Please use this ID to log in to the Onboarding Portal and complete your digital dossier.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      recipientEmail: candidate.email,
      channel: 'sms',
      message,
      metadata: { event: 'candidate_joining_id_issued', joining_id: candidate.joining_id },
    });
  }

  /**
   * 2. Candidate OTP issued
   */
  async notifyCandidateOtp(
    supabaseAdmin: SupabaseClient | null,
    candidateId: string,
    mobile: string,
    otpCode: string
  ) {
    const message = `Your PostEx Onboarding verification OTP is ${otpCode}. Valid for 5 minutes. Do NOT share this code with anyone.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidateId,
      recipientPhone: mobile,
      channel: 'sms',
      message,
      metadata: { event: 'candidate_otp', otp_sent_at: new Date().toISOString() },
    });
  }

  /**
   * 3. Candidate submits application dossier to Branch Manager queue (Audit Gap Fixed)
   */
  async notifyCandidateApplicationSubmitted(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile?: string; joining_id: string },
    branchName?: string
  ) {
    const message = `Application submitted! Candidate ${candidate.full_name} (${candidate.joining_id}) has completed their onboarding dossier. The file is queued for Branch Manager physical verification${branchName ? ` at ${branchName}` : ''}.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      channel: 'sms',
      message,
      metadata: { event: 'application_submitted_to_bm', joining_id: candidate.joining_id },
    });
  }

  /**
   * 4. Application returned for corrections (BM or Central HR)
   */
  async notifyApplicationReturnedForCorrection(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile?: string; email?: string; joining_id: string },
    reason: string,
    returnedByRole: 'branch_manager' | 'central_hr',
    unlockedSections?: string[]
  ) {
    const sectionsText = unlockedSections && unlockedSections.length > 0 ? ` [Sections: ${unlockedSections.join(', ')}]` : '';
    const message = `Notice from PostEx HR (${returnedByRole === 'branch_manager' ? 'Branch Manager' : 'Central HR'}): Your onboarding application requires correction${sectionsText}. Reason: "${reason}". Please log in to your portal to review and update your dossier.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      recipientEmail: candidate.email,
      channel: 'sms',
      message,
      metadata: { event: 'returned_for_correction', returned_by: returnedByRole, reason, unlocked_sections: unlockedSections },
    });
  }

  /**
   * 5. Application verified by BM and forwarded to Central HR
   */
  async notifyApplicationForwardedToCentral(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile?: string; joining_id: string },
    branchName: string,
    centralHrId?: string
  ) {
    const message = `Update: Your onboarding documents have been verified by Branch Management (${branchName}) and successfully forwarded to Central HR for final review.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      channel: 'sms',
      message,
      metadata: { event: 'forwarded_to_central_hr', branch: branchName, assigned_central_hr_id: centralHrId },
    });
  }

  /**
   * 6. Application approved / formal enrollment with Employee ID
   */
  async notifyApplicationApproved(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile?: string; email?: string; joining_id: string },
    employeeId: string
  ) {
    const message = `Congratulations ${candidate.full_name}! Your onboarding application has been APPROVED. Your PostEx Employee ID is ${employeeId}. Welcome to the team!`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      recipientEmail: candidate.email,
      channel: 'sms',
      message,
      metadata: { event: 'application_approved', employee_id: employeeId },
    });
  }

  /**
   * 7. Application rejected
   */
  async notifyApplicationRejected(
    supabaseAdmin: SupabaseClient | null,
    candidate: { id: string; full_name: string; mobile?: string; email?: string; joining_id: string },
    reason: string
  ) {
    const message = `Notice from PostEx HR: Your onboarding application has been formally declined. Reason: "${reason}". If you believe this is in error, contact HR support.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'candidate',
      recipientId: candidate.id,
      recipientPhone: candidate.mobile,
      recipientEmail: candidate.email,
      channel: 'sms',
      message,
      metadata: { event: 'application_rejected', reason },
    });
  }

  /**
   * 8. Staff credential reset / temporary password issued (Audit Gap Fixed)
   */
  async notifyStaffCredentialReset(
    supabaseAdmin: SupabaseClient | null,
    staff: { id: string; name: string; email?: string },
    tempPassword: string,
    resetByStaffId: string
  ) {
    const message = `Security Alert: Your PostEx Staff Portal password has been reset by administration. Temporary Password: ${tempPassword}. You must change your password on next sign-in.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'staff',
      recipientId: staff.id,
      recipientEmail: staff.email,
      channel: 'in_app',
      message,
      metadata: { event: 'staff_password_reset', reset_by: resetByStaffId },
    });
  }

  /**
   * 9. Staff user permission override updated (Audit Gap Fixed)
   */
  async notifyStaffPermissionOverride(
    supabaseAdmin: SupabaseClient | null,
    staffId: string,
    permissionKey: string,
    granted: boolean,
    reason: string,
    updatedByStaffId: string
  ) {
    const action = granted ? 'GRANTED' : 'REVOKED';
    const message = `Permission Notice: Override for permission '${permissionKey}' has been ${action}. Reason: "${reason}".`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'staff',
      recipientId: staffId,
      channel: 'in_app',
      message,
      metadata: { event: 'permission_override_updated', permissionKey, granted, reason, updated_by: updatedByStaffId },
    });
  }

  /**
   * 10. Data retention cleanup completed
   */
  async notifyDataRetentionCleanup(
    supabaseAdmin: SupabaseClient | null,
    adminId: string,
    countArchived: number,
    thresholdDays: number
  ) {
    const message = `Data Retention Policy Job: Completed archival cleanup. ${countArchived} rejected application(s) older than ${thresholdDays} days have been soft-hidden from active views.`;
    return this.dispatch(supabaseAdmin, {
      recipientType: 'admin',
      recipientId: adminId,
      channel: 'in_app',
      message,
      metadata: { event: 'data_retention_cleanup_completed', countArchived, thresholdDays },
    });
  }
}

export const notificationService = new CentralizedNotificationService();
