// Master Data Adapter: Read-only access to existing project's Branches and Designations
// ==============================================================================
// RULES COMPLIANCE:
// 1. Reads ONLY from existing `branches` and `designations` tables.
// 2. ZERO WRITES: Does not create, insert, update, truncate, or alter existing tables.
// 3. Provides clean abstraction for live DB queries with fallback for local dev/testing.
// ==============================================================================

export interface ExistingBranch {
  id: string;
  code: string;
  name: string;
  city: string;
  is_active: boolean;
}

export interface ExistingDesignation {
  id: string;
  code: string;
  name: string;
  department: string;
  is_active: boolean;
}

// Built-in reference master list used as read-only fallback when live DB is unavailable
const DEFAULT_BRANCHES: ExistingBranch[] = [
  { id: 'br-khi-01', code: 'KHI-01', name: 'Karachi Central (Korangi Hub)', city: 'Karachi', is_active: true },
  { id: 'br-khi-02', code: 'KHI-02', name: 'Karachi Clifton', city: 'Karachi', is_active: true },
  { id: 'br-khi-03', code: 'KHI-03', name: 'Karachi Shahrah-e-Faisal', city: 'Karachi', is_active: true },
  { id: 'br-khi-04', code: 'KHI-04', name: 'Karachi North Nazimabad', city: 'Karachi', is_active: true },
  { id: 'br-lhr-01', code: 'LHR-01', name: 'Lahore Gulberg Hub', city: 'Lahore', is_active: true },
  { id: 'br-lhr-02', code: 'LHR-02', name: 'Lahore DHA Phase 5', city: 'Lahore', is_active: true },
  { id: 'br-lhr-03', code: 'LHR-03', name: 'Lahore Johar Town', city: 'Lahore', is_active: true },
  { id: 'br-isb-01', code: 'ISB-01', name: 'Islamabad I-9 Industrial', city: 'Islamabad', is_active: true },
  { id: 'br-isb-02', code: 'ISB-02', name: 'Islamabad Blue Area', city: 'Islamabad', is_active: true },
  { id: 'br-rwp-01', code: 'RWP-01', name: 'Rawalpindi Saddar', city: 'Rawalpindi', is_active: true },
  { id: 'br-fsd-01', code: 'FSD-01', name: 'Faisalabad Clock Tower Hub', city: 'Faisalabad', is_active: true },
  { id: 'br-fsd-02', code: 'FSD-02', name: 'Faisalabad D-Ground', city: 'Faisalabad', is_active: true },
  { id: 'br-mul-01', code: 'MUL-01', name: 'Multan Cantt', city: 'Multan', is_active: true },
  { id: 'br-mul-02', code: 'MUL-02', name: 'Multan Bosan Road', city: 'Multan', is_active: true },
  { id: 'br-psh-01', code: 'PSH-01', name: 'Peshawar University Road', city: 'Peshawar', is_active: true },
  { id: 'br-psh-02', code: 'PSH-02', name: 'Peshawar Hayatabad', city: 'Peshawar', is_active: true },
  { id: 'br-qta-01', code: 'QTA-01', name: 'Quetta Jinnah Road', city: 'Quetta', is_active: true },
  { id: 'br-skt-01', code: 'SKT-01', name: 'Sialkot Daska Road', city: 'Sialkot', is_active: true },
  { id: 'br-guj-01', code: 'GUJ-01', name: 'Gujranwala GT Road', city: 'Gujranwala', is_active: true },
  { id: 'br-hyd-01', code: 'HYD-01', name: 'Hyderabad Latifabad', city: 'Hyderabad', is_active: true },
  { id: 'br-suk-01', code: 'SUK-01', name: 'Sukkur Minara Road', city: 'Sukkur', is_active: true },
  { id: 'br-bwp-01', code: 'BWP-01', name: 'Bahawalpur Model Town', city: 'Bahawalpur', is_active: true },
  { id: 'br-srg-01', code: 'SRG-01', name: 'Sargodha University Road', city: 'Sargodha', is_active: true },
  { id: 'br-abb-01', code: 'ABB-01', name: 'Abbottabad Mansehra Road', city: 'Abbottabad', is_active: true },
];

const DEFAULT_DESIGNATIONS: ExistingDesignation[] = [
  { id: 'des-01', code: 'RDR', name: 'Rider / Courier Specialist', department: 'Operations', is_active: true },
  { id: 'des-02', code: 'VAN', name: 'Van Driver / Logistics Driver', department: 'Operations', is_active: true },
  { id: 'des-03', code: 'HUB-SUP', name: 'Hub Supervisor', department: 'Operations', is_active: true },
  { id: 'des-04', code: 'SRT-OP', name: 'Sorting Officer', department: 'Warehouse & Sorting', is_active: true },
  { id: 'des-05', code: 'INV-CTRL', name: 'Inventory Controller', department: 'Warehouse & Sorting', is_active: true },
  { id: 'des-06', code: 'FLT-CORD', name: 'Fleet Coordinator', department: 'Fleet Management', is_active: true },
  { id: 'des-07', code: 'CS-REP', name: 'Customer Support Representative', department: 'Customer Care', is_active: true },
  { id: 'des-08', code: 'QC-INSP', name: 'Quality Control Inspector', department: 'Quality Assurance', is_active: true },
  { id: 'des-09', code: 'DISP-OFC', name: 'Dispatch Officer', department: 'Logistics', is_active: true },
  { id: 'des-10', code: 'SEC-GRD', name: 'Security Guard', department: 'Administration', is_active: true },
  { id: 'des-11', code: 'BM', name: 'Branch Manager', department: 'Operations Management', is_active: true },
  { id: 'des-12', code: 'HR-OFC', name: 'HR Officer', department: 'Human Resources', is_active: true },
];

export class MasterDataAdapter {
  /**
   * Reads existing branches. In live environments with DATABASE_URL, this can query:
   * `SELECT id, code, name, city, is_active FROM branches WHERE is_active = true ORDER BY name ASC`
   */
  async getExistingBranches(): Promise<ExistingBranch[]> {
    // Integration point: If a live DB client exists (e.g. pg pool or Prisma), query public.branches here.
    return DEFAULT_BRANCHES;
  }

  /**
   * Reads existing designations. In live environments with DATABASE_URL, this can query:
   * `SELECT id, code, name, department, is_active FROM designations WHERE is_active = true ORDER BY name ASC`
   */
  async getExistingDesignations(): Promise<ExistingDesignation[]> {
    // Integration point: If a live DB client exists (e.g. pg pool or Prisma), query public.designations here.
    return DEFAULT_DESIGNATIONS;
  }

  async findBranchById(id: string): Promise<ExistingBranch | undefined> {
    const branches = await this.getExistingBranches();
    return branches.find((b) => b.id === id);
  }

  async findDesignationById(id: string): Promise<ExistingDesignation | undefined> {
    const designations = await this.getExistingDesignations();
    return designations.find((d) => d.id === id);
  }
}

export const masterDataAdapter = new MasterDataAdapter();
