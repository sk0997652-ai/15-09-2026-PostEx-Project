import React, { createContext, useContext, useState, useEffect } from 'react';

export interface BrandingData {
  companyName: string;
  portalName: string;
  logoUrl?: string | null;
  supportEmail: string;
  dataRetentionDays: number;
  autoArchiveEnabled: boolean;
  lastUpdated?: string;
}

interface BrandingContextType {
  branding: BrandingData;
  companyName: string;
  portalName: string;
  logoUrl?: string | null;
  supportEmail: string;
  updateBranding: (updates: Partial<BrandingData>) => Promise<boolean>;
  reloadBranding: () => Promise<void>;
  loading: boolean;
}

const defaultBranding: BrandingData = {
  companyName: 'PostEx',
  portalName: 'HR Onboarding Portal',
  logoUrl: null,
  supportEmail: 'hr-support@postex.pk',
  dataRetentionDays: 90,
  autoArchiveEnabled: true,
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  companyName: 'PostEx',
  portalName: 'HR Onboarding Portal',
  logoUrl: null,
  supportEmail: 'hr-support@postex.pk',
  updateBranding: async () => false,
  reloadBranding: async () => {},
  loading: false,
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingData>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/organization-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setBranding({
            companyName: data.settings.company_name || 'PostEx',
            portalName: data.settings.portal_name || 'HR Onboarding Portal',
            logoUrl: data.settings.logo_storage_path || null,
            supportEmail: data.settings.support_email || 'hr-support@postex.pk',
            dataRetentionDays: data.settings.data_retention_days || 90,
            autoArchiveEnabled: data.settings.auto_archive_enabled ?? true,
            lastUpdated: data.settings.updated_at,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch organization settings, using defaults:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const updateBranding = async (updates: Partial<BrandingData>): Promise<boolean> => {
    try {
      // Optimistic update
      setBranding((prev) => ({ ...prev, ...updates }));

      const token = localStorage.getItem('postex_staff_token') || localStorage.getItem('supabase_auth_token');
      const res = await fetch('/api/admin/organization-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_name: updates.companyName,
          portal_name: updates.portalName,
          logo_storage_path: updates.logoUrl,
          support_email: updates.supportEmail,
          data_retention_days: updates.dataRetentionDays,
          auto_archive_enabled: updates.autoArchiveEnabled,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to persist organization settings');
      }

      const data = await res.json();
      if (data.success && data.settings) {
        setBranding({
          companyName: data.settings.company_name,
          portalName: data.settings.portal_name,
          logoUrl: data.settings.logo_storage_path,
          supportEmail: data.settings.support_email,
          dataRetentionDays: data.settings.data_retention_days,
          autoArchiveEnabled: data.settings.auto_archive_enabled,
          lastUpdated: data.settings.updated_at,
        });
      }
      return true;
    } catch (err) {
      console.error('Error updating branding:', err);
      // Revert if failed
      fetchBranding();
      return false;
    }
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        companyName: branding.companyName,
        portalName: branding.portalName,
        logoUrl: branding.logoUrl,
        supportEmail: branding.supportEmail,
        updateBranding,
        reloadBranding: fetchBranding,
        loading,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
