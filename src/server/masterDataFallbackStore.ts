// ==============================================================================
// PostEx HR Onboarding Portal — Master Data Pre-Migration Fallback Store
// ==============================================================================
// Ensures that if the user has not yet executed the latest SQL migration
// (20261002000000_cities_and_master_data_codes.sql) in the Supabase SQL Editor,
// `cities`, `branches.city_id`, and `designations.designation_code` still work
// seamlessly across all API endpoints while keeping all real UUIDs in Supabase.
// Once the migration is run in Supabase, the database columns take precedence.
// ==============================================================================

import crypto from 'crypto';

export interface FallbackCityRecord {
  id: string;
  city_code: string | null;
  name: string;
  zone_id: string | null;
  is_active: boolean;
  created_at: string;
}

const fallbackCitiesById = new Map<string, FallbackCityRecord>();
const fallbackBranchCityId = new Map<string, string | null>();
const fallbackDesignationCode = new Map<string, string | null>();

export const masterDataFallbackStore = {
  // Cities fallback (used only when public.cities table is not yet in PostgREST schema cache)
  listCities(): FallbackCityRecord[] {
    return Array.from(fallbackCitiesById.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },

  getCityById(id: string): FallbackCityRecord | undefined {
    return fallbackCitiesById.get(id);
  },

  findCityByCode(code: string): FallbackCityRecord | undefined {
    const clean = code.trim().toLowerCase();
    if (!clean) return undefined;
    for (const c of fallbackCitiesById.values()) {
      if ((c.city_code || '').trim().toLowerCase() === clean) {
        return c;
      }
    }
    return undefined;
  },

  findCityByName(name: string): FallbackCityRecord | undefined {
    const clean = name.trim().toLowerCase();
    if (!clean) return undefined;
    for (const c of fallbackCitiesById.values()) {
      if (c.name.trim().toLowerCase() === clean) {
        return c;
      }
    }
    return undefined;
  },

  createCity(payload: {
    id?: string;
    city_code?: string | null;
    name: string;
    zone_id?: string | null;
    is_active?: boolean;
  }): FallbackCityRecord {
    const cleanCode = payload.city_code ? payload.city_code.trim() : null;
    if (cleanCode) {
      const dup = this.findCityByCode(cleanCode);
      if (dup) {
        throw new Error(`City Code "${cleanCode}" already exists. Please enter a unique City Code.`);
      }
    }
    const record: FallbackCityRecord = {
      id: payload.id || crypto.randomUUID(),
      city_code: cleanCode,
      name: payload.name.trim(),
      zone_id: payload.zone_id || null,
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
      created_at: new Date().toISOString(),
    };
    fallbackCitiesById.set(record.id, record);
    return record;
  },

  updateCity(
    id: string,
    payload: {
      city_code?: string | null;
      name?: string;
      zone_id?: string | null;
      is_active?: boolean;
    }
  ): FallbackCityRecord {
    const existing = fallbackCitiesById.get(id);
    if (!existing) {
      throw new Error('City record not found.');
    }
    if (payload.city_code !== undefined && payload.city_code !== null) {
      const cleanCode = payload.city_code.trim();
      const dup = this.findCityByCode(cleanCode);
      if (dup && dup.id !== id) {
        throw new Error(`City Code "${cleanCode}" already exists. Please enter a unique City Code.`);
      }
    }
    const updated: FallbackCityRecord = {
      ...existing,
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.city_code !== undefined
        ? { city_code: payload.city_code ? payload.city_code.trim() : null }
        : {}),
      ...(payload.zone_id !== undefined ? { zone_id: payload.zone_id || null } : {}),
      ...(typeof payload.is_active === 'boolean' ? { is_active: payload.is_active } : {}),
    };
    fallbackCitiesById.set(id, updated);
    return updated;
  },

  deleteCity(id: string): boolean {
    return fallbackCitiesById.delete(id);
  },

  // Branch city_id fallback
  setBranchCityId(branchId: string, cityId: string | null) {
    fallbackBranchCityId.set(branchId, cityId);
  },

  getBranchCityId(branchId: string): string | null | undefined {
    return fallbackBranchCityId.get(branchId);
  },

  // Designation designation_code fallback
  setDesignationCode(designationId: string, code: string | null) {
    if (code) {
      const clean = code.trim().toLowerCase();
      for (const [otherId, otherCode] of fallbackDesignationCode.entries()) {
        if (otherId !== designationId && (otherCode || '').trim().toLowerCase() === clean) {
          throw new Error(`Designation Code "${code.trim()}" already exists. Please enter a unique Designation Code.`);
        }
      }
    }
    fallbackDesignationCode.set(designationId, code ? code.trim() : null);
  },

  getDesignationCode(designationId: string): string | null | undefined {
    return fallbackDesignationCode.get(designationId);
  },

  findDesignationIdByCode(code: string): string | undefined {
    const clean = code.trim().toLowerCase();
    if (!clean) return undefined;
    for (const [id, c] of fallbackDesignationCode.entries()) {
      if ((c || '').trim().toLowerCase() === clean) {
        return id;
      }
    }
    return undefined;
  },

  enrichBranches(branches: any[], cities: any[]): any[] {
    const cityMap = new Map<string, any>();
    for (const c of cities || []) {
      cityMap.set(c.id, c);
    }
    return (branches || []).map((b) => {
      const resolvedCityId = b.city_id ?? fallbackBranchCityId.get(b.id) ?? null;
      const cityObj = b.cities || (resolvedCityId ? cityMap.get(resolvedCityId) || null : null);
      return {
        ...b,
        city_id: resolvedCityId,
        cities: cityObj
          ? { id: cityObj.id, name: cityObj.name, city_code: cityObj.city_code || null }
          : null,
      };
    });
  },

  enrichDesignations(designations: any[]): any[] {
    return (designations || []).map((d) => ({
      ...d,
      designation_code: d.designation_code ?? fallbackDesignationCode.get(d.id) ?? null,
    }));
  },
};
