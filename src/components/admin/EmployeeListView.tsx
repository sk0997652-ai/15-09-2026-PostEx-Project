import React, { useState, useMemo, useEffect, useRef } from 'react';
import '../../styles/employee-list.css';
import {
  appendPortalAuditLog,
  updateHrPortalState,
  ExitRecord,
} from '../../lib/hrPortalStore';
import {
  Plus,
  Download,
  X,
  Edit2,
  Trash2,
  Package,
  Clock,
  Key,
  Mail,
  Fingerprint,
  CreditCard,
  FileText,
  Paperclip,
  Eye,
  EyeOff,
  Smartphone,
} from 'lucide-react';

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.84a8.18 8.18 0 01-5.82 2.41h-.01c-1.49 0-2.95-.4-4.22-1.15l-.3-.18-3.13.82.83-3.05-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z"/>
  </svg>
);

export type MachineEnrollmentStatus = 'Enrolled' | 'Not Enrolled';
export type IdCardStatus = 'Provided' | 'Not Provided';
export type DocumentsDispatchStatus = 'Dispatched' | 'Not Dispatched';

export interface AssetImageAttachment {
  name: string;
  url: string;
  storage_path?: string;
}

export interface EmployeeRecord {
  id: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  zone: string;
  sub_department: string;
  cnic: string;
  phone: string;
  status: 'Active' | 'Resigned' | 'Terminated';
  avatar?: string;
  resignationDate?: string;
  lastWorkingDay?: string;
  resignationReason?: string;
  exitCompleted?: boolean;
  // Asset Fields (Reference: employee-assets-popup.html + Share Details)
  sim_number?: string;
  sim_imsi?: string;
  timetrax_username?: string;
  timetrax_password?: string;
  postex_username?: string;
  postex_password?: string;
  emails: string[];
  machine_enrollment: MachineEnrollmentStatus;
  id_card: IdCardStatus;
  documents_dispatch: DocumentsDispatchStatus;
  machine_enrollment_image?: AssetImageAttachment | null;
  id_card_image?: AssetImageAttachment | null;
  documents_dispatch_image?: AssetImageAttachment | null;
  emailed_at?: string;
  whatsapp_shared_at?: string;
}

export interface EmployeeListViewProps {
  initialSearch?: string;
  onOpenExitTracker?: () => void;
  currentUser?: { name?: string; email?: string; role?: string };
}

/* ================= REFERENCE MASTER DATA ================= */
const RN = ['Ahmed', 'Usman', 'Bilal', 'Hassan', 'Zain', 'Imran', 'Faisal', 'Asif', 'Saad', 'Owais', 'Hamza', 'Talha'];
const LN = ['Khan', 'Ali', 'Raza', 'Malik', 'Butt', 'Shah', 'Iqbal', 'Sheikh'];

const DESIGS = [
  { name: 'RIDER', dept: 'OPERATIONS' },
  { name: 'AREA MANAGER', dept: 'OPERATIONS' },
  { name: 'HR OFFICER', dept: 'HUMAN RESOURCES' },
  { name: 'ACCOUNTANT', dept: 'FINANCE' },
  { name: 'CS AGENT', dept: 'CUSTOMER SERVICE' },
  { name: 'DISPATCHER', dept: 'OPERATIONS' },
];

const DEPTS = ['OPERATIONS', 'HUMAN RESOURCES', 'FINANCE', 'CUSTOMER SERVICE'];

const BRANCH_LIST = [
  { name: 'LHR-GULBERG', zone: 'LAHORE' },
  { name: 'LHR-JOHAR TOWN', zone: 'LAHORE' },
  { name: 'ISB-BLUE AREA', zone: 'ISLAMABAD' },
  { name: 'ISB-F-7', zone: 'ISLAMABAD' },
  { name: 'KHI-CLIFTON', zone: 'KARACHI' },
  { name: 'KHI-DHA', zone: 'KARACHI' },
  { name: 'FSD-D GROUND', zone: 'FAISALABAD' },
  { name: 'MUL-CANTT', zone: 'MULTAN' },
];

const SUBD: Record<string, string[]> = {
  'OPERATIONS': ['Last Mile Delivery', 'First Mile & Hub', 'Linehaul & Sorting', 'Fleet Management'],
  'HUMAN RESOURCES': ['Talent Acquisition', 'Employee Relations', 'Payroll & Benefits', 'Training & Development'],
  'FINANCE': ['Accounts Payable', 'Accounts Receivable', 'Auditing & Taxation', 'Treasury & Cash'],
  'CUSTOMER SERVICE': ['Inbound Support', 'Issue Resolution', 'Key Accounts & VIP', 'Escalations & QA'],
};

const RESIGNATION_REASONS = [
  'Better opportunity',
  'Higher studies',
  'Personal / family reasons',
  'Relocation',
  'Health reasons',
  'Other',
];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ASSETS_STORAGE_KEY = 'postex_employee_assets_v3';

// WhatsApp number normalizer: strip spaces, dashes and "+", "03XX..." -> "923XX...", exactly 12 digits starting with 923
export function normalizeWhatsAppNumber(raw: string): { normalized: string; isValid: boolean } {
  if (!raw) return { normalized: '', isValid: false };
  let cleaned = raw.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('03')) {
    cleaned = '92' + cleaned.slice(1);
  } else if (cleaned.startsWith('3') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  }
  const isValid = /^923\d{9}$/.test(cleaned);
  return { normalized: cleaned, isValid };
}

// Helper to compute 30 days ahead in YYYY-MM-DD
function addDaysToDate(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

// Generate the 26 demo employees according to exact reference rule
function generateDemoEmployees(): EmployeeRecord[] {
  const list: EmployeeRecord[] = [];

  for (let i = 0; i < 26; i++) {
    const dObj = DESIGS[i % 6];
    const bObj = BRANCH_LIST[i % 8];
    const dept = dObj.dept;
    const subList = SUBD[dept] || ['General'];
    const subDept = subList[i % subList.length];

    // Status logic: i % 7 === 3 -> Resigned (indices 3, 10, 17, 24 -> 4 items)
    // i % 11 === 7 -> Terminated (indices 7, 18 -> 2 items)
    // Remaining -> Active (20 items)
    let status: 'Active' | 'Resigned' | 'Terminated' = 'Active';
    if (i % 7 === 3) {
      status = 'Resigned';
    } else if (i % 11 === 7) {
      status = 'Terminated';
    }

    const cnicNumber = String(1000000 + ((i * 7919) % 9000000)).slice(0, 7);
    const cnicCheck = (i % 9) + 1;
    const phoneSuffix = String(1234000 + i * 37).slice(0, 7);

    const isResigned = status === 'Resigned';
    const resDate = isResigned ? '2026-10-01' : undefined;
    const lwd = isResigned ? '2026-10-31' : undefined;

    // TimeTrax and PostEx credentials:
    // Employee 0 & even indices have both credentials filled -> Complete
    // Odd indices have PostEx missing -> Pending
    const isComplete = i % 2 === 0;
    const firstName = RN[i % 12].toLowerCase();
    const lastName = LN[(i * 3) % 8].toLowerCase();

    const ttUser = `${firstName}.${lastName}`;
    const ttPw = 'Tt@12345678';
    const pxUser = isComplete ? `${firstName}.${lastName}@postex.pk` : '';
    const pxPw = isComplete ? 'Px@12345678' : '';

    const machine_enrollment: MachineEnrollmentStatus = isComplete ? 'Enrolled' : 'Not Enrolled';
    const id_card: IdCardStatus = isComplete ? 'Provided' : 'Not Provided';
    const documents_dispatch: DocumentsDispatchStatus = isComplete ? 'Dispatched' : 'Not Dispatched';

    const emails: string[] = [`${firstName}.${lastName}@postex.pk`];
    if (i === 1) {
      emails.push('hr.sana@postex.pk');
    }

    list.push({
      id: `emp-demo-${1001 + i}`,
      code: `PX-EMP-${1001 + i}`,
      name: `${RN[i % 12]} ${LN[(i * 3) % 8]}`,
      designation: dObj.name,
      department: dept,
      branch: bObj.name,
      zone: bObj.zone,
      sub_department: subDept,
      cnic: `35202-${cnicNumber}-${cnicCheck}`,
      phone: `0300-${phoneSuffix}`,
      status,
      resignationDate: resDate,
      lastWorkingDay: lwd,
      resignationReason: isResigned ? RESIGNATION_REASONS[i % RESIGNATION_REASONS.length] : undefined,
      exitCompleted: false,
      timetrax_username: ttUser,
      timetrax_password: ttPw,
      postex_username: pxUser,
      postex_password: pxPw,
      sim_number: isComplete ? `0300-${phoneSuffix}` : '',
      sim_imsi: isComplete ? `89920100${1001 + i}` : '',
      emails,
      machine_enrollment,
      id_card,
      documents_dispatch,
      machine_enrollment_image: null,
      id_card_image: null,
      documents_dispatch_image: null,
      emailed_at: i === 0 ? 'Oct 12, 2026' : undefined,
      whatsapp_shared_at: i === 0 ? 'Oct 12, 2026' : undefined,
    });
  }

  return list;
}

// Check if assets are Complete (TimeTrax and PostEx credentials both filled)
export function isAssetsComplete(emp: EmployeeRecord): boolean {
  return Boolean(
    emp.timetrax_username?.trim() &&
    emp.timetrax_password?.trim() &&
    emp.postex_username?.trim() &&
    emp.postex_password?.trim()
  );
}

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({
  initialSearch = '',
  onOpenExitTracker,
  currentUser,
}) => {
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => {
    const baseline = generateDemoEmployees();
    try {
      const stored = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, any>(parsed.map((e) => [e.id || e.code, e]));
          return baseline.map((emp) => {
            const saved = map.get(emp.id) || map.get(emp.code);
            return saved ? { ...emp, ...saved } : emp;
          });
        }
      }
    } catch {
      // ignore
    }
    return baseline;
  });

  // Filter States
  const [scopeFilter, setScopeFilter] = useState<'all' | 'active'>('all');
  const [topSearch, setTopSearch] = useState(initialSearch);
  const [branchFilter, setBranchFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Resigned' | 'Terminated'>('All');

  // Column search filters (second header row)
  const [colEmpId, setColEmpId] = useState('');
  const [colName, setColName] = useState('');
  const [colDesig, setColDesig] = useState('');
  const [colDept, setColDept] = useState('');
  const [colBranch, setColBranch] = useState('');
  const [colSubDept, setColSubDept] = useState('');
  const [colCnic, setColCnic] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals state
  const [editEmployee, setEditEmployee] = useState<EmployeeRecord | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // ================= ASSETS POPUP FORM STATE =================
  const [assetTarget, setAssetTarget] = useState<EmployeeRecord | null>(null);
  const [simNumber, setSimNumber] = useState('');
  const [simImsi, setSimImsi] = useState('');
  const [ttUser, setTtUser] = useState('');
  const [ttPw, setTtPw] = useState('');
  const [showTtPw, setShowTtPw] = useState(false);
  const [pxUser, setPxUser] = useState('');
  const [pxPw, setPxPw] = useState('');
  const [showPxPw, setShowPxPw] = useState(false);
  const [emails, setEmails] = useState<string[]>(['']);
  const [machineEnrollment, setMachineEnrollment] = useState<MachineEnrollmentStatus>('Not Enrolled');
  const [idCard, setIdCard] = useState<IdCardStatus>('Not Provided');
  const [documentsDispatch, setDocumentsDispatch] = useState<DocumentsDispatchStatus>('Not Dispatched');
  const [machineImage, setMachineImage] = useState<AssetImageAttachment | null>(null);
  const [idCardImage, setIdCardImage] = useState<AssetImageAttachment | null>(null);
  const [docsImage, setDocsImage] = useState<AssetImageAttachment | null>(null);
  const [assetErrors, setAssetErrors] = useState<Record<string, boolean>>({});

  // Share Details State (Email & WhatsApp)
  const [whatsAppNumbers, setWhatsAppNumbers] = useState<string[]>(['']);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isMessageEdited, setIsMessageEdited] = useState(false);
  const [emailedDate, setEmailedDate] = useState<string>('');
  const [whatsappSharedDate, setWhatsappSharedDate] = useState<string>('');
  const [whatsAppErrors, setWhatsAppErrors] = useState<Record<number, string>>({});

  // Field refs for auto-focusing the first invalid field
  const ttUserRef = useRef<HTMLInputElement>(null);
  const ttPwRef = useRef<HTMLInputElement>(null);
  const pxUserRef = useRef<HTMLInputElement>(null);
  const pxPwRef = useRef<HTMLInputElement>(null);
  const emailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const waRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form state for Add/Edit Employee Modal
  const [formImage, setFormImage] = useState<string>('');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState(DESIGS[0].name);
  const [formDepartment, setFormDepartment] = useState(DEPTS[0]);
  const [formBranch, setFormBranch] = useState(BRANCH_LIST[0].name);
  const [formSubDept, setFormSubDept] = useState('');
  const [formCnic, setFormCnic] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Resigned' | 'Terminated'>('Active');
  const [formPhone, setFormPhone] = useState('');
  const [formResDate, setFormResDate] = useState('');
  const [formLwd, setFormLwd] = useState('');
  const [formReason, setFormReason] = useState(RESIGNATION_REASONS[0]);

  // Toast notification
  const [toast, setToast] = useState<{
    text: string;
    actionLabel?: string;
    onAction?: () => void;
    isError?: boolean;
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // When initialSearch changes, update topSearch
  useEffect(() => {
    if (initialSearch) {
      setTopSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  // Scope filter logic: "Active Employees" shows only status Active and resets status chip to All
  const handleScopeChange = (newScope: 'all' | 'active') => {
    setScopeFilter(newScope);
    if (newScope === 'active') {
      setStatusFilter('All');
    }
    setPage(1);
  };

  // Base filter (without status) to calculate status chip counts
  const baseFilteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Scope filter
      if (scopeFilter === 'active' && emp.status !== 'Active') return false;

      // 2. Top search (name + code + cnic)
      if (topSearch.trim()) {
        const q = topSearch.toLowerCase();
        const mName = emp.name.toLowerCase().includes(q);
        const mCode = emp.code.toLowerCase().includes(q);
        const mCnic = emp.cnic.toLowerCase().includes(q);
        if (!mName && !mCode && !mCnic) return false;
      }

      // 3. Branch filter (exact match or contains)
      if (branchFilter.trim()) {
        const bf = branchFilter.trim().toLowerCase();
        if (emp.branch.toLowerCase() !== bf && !emp.branch.toLowerCase().includes(bf)) {
          return false;
        }
      }

      // 4. Department filter
      if (deptFilter && emp.department !== deptFilter) return false;

      // 5. Assets filter (Complete vs Pending)
      if (assetFilter) {
        const isComp = isAssetsComplete(emp);
        if (assetFilter === 'Complete' && !isComp) return false;
        if (assetFilter === 'Pending' && isComp) return false;
      }

      // 6. Column filters (contains, case-insensitive)
      if (colEmpId.trim() && !emp.code.toLowerCase().includes(colEmpId.trim().toLowerCase())) {
        return false;
      }
      if (colName.trim() && !emp.name.toLowerCase().includes(colName.trim().toLowerCase())) {
        return false;
      }
      if (colDesig.trim() && !emp.designation.toLowerCase().includes(colDesig.trim().toLowerCase())) {
        return false;
      }
      if (colDept.trim() && !emp.department.toLowerCase().includes(colDept.trim().toLowerCase())) {
        return false;
      }
      if (colBranch.trim() && !emp.branch.toLowerCase().includes(colBranch.trim().toLowerCase())) {
        return false;
      }
      if (colSubDept.trim() && !emp.sub_department.toLowerCase().includes(colSubDept.trim().toLowerCase())) {
        return false;
      }
      if (colCnic.trim() && !emp.cnic.toLowerCase().includes(colCnic.trim().toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [
    employees,
    scopeFilter,
    topSearch,
    branchFilter,
    deptFilter,
    assetFilter,
    colEmpId,
    colName,
    colDesig,
    colDept,
    colBranch,
    colSubDept,
    colCnic,
  ]);

  // Compute live chip counts following all other filters
  const chipCounts = useMemo(() => {
    let all = baseFilteredEmployees.length;
    let active = 0;
    let resigned = 0;
    let terminated = 0;
    baseFilteredEmployees.forEach((emp) => {
      if (emp.status === 'Active') active++;
      if (emp.status === 'Resigned') resigned++;
      if (emp.status === 'Terminated') terminated++;
    });
    return { all, active, resigned, terminated };
  }, [baseFilteredEmployees]);

  // Apply final status filter
  const filteredEmployees = useMemo(() => {
    if (statusFilter === 'All') return baseFilteredEmployees;
    return baseFilteredEmployees.filter((emp) => emp.status === statusFilter);
  }, [baseFilteredEmployees, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredEmployees.length);
  const pagedEmployees = useMemo(() => {
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, startIndex, endIndex]);

  // ================= ASSETS POPUP HANDLERS =================
  const handleOpenAssetsModal = (emp: EmployeeRecord) => {
    setAssetTarget(emp);
    setSimNumber(emp.sim_number || '');
    setSimImsi(emp.sim_imsi || '');
    setTtUser(emp.timetrax_username || '');
    setTtPw(emp.timetrax_password || '');
    setShowTtPw(false);
    setPxUser(emp.postex_username || '');
    setPxPw(emp.postex_password || '');
    setShowPxPw(false);
    setEmails(emp.emails && emp.emails.length > 0 ? [...emp.emails] : ['']);
    setMachineEnrollment(emp.machine_enrollment || 'Not Enrolled');
    setIdCard(emp.id_card || 'Not Provided');
    setDocumentsDispatch(emp.documents_dispatch || 'Not Dispatched');
    setMachineImage(emp.machine_enrollment_image || null);
    setIdCardImage(emp.id_card_image || null);
    setDocsImage(emp.documents_dispatch_image || null);

    // Prefill WhatsApp number from employee's phone
    const savedPhone = emp.phone ? emp.phone.replace(/^\+92/, '').replace(/^92/, '0') : '';
    setWhatsAppNumbers(savedPhone ? [savedPhone] : ['0300-1234567']);
    setIncludePasswords(false);
    setCustomMessage('');
    setIsMessageEdited(false);
    setEmailedDate(emp.emailed_at || '');
    setWhatsappSharedDate(emp.whatsapp_shared_at || '');
    setAssetErrors({});
    setWhatsAppErrors({});
  };

  const handleCloseAssetsModal = () => {
    setAssetTarget(null);
    setAssetErrors({});
    setWhatsAppErrors({});
  };

  // Add another email row
  const handleAddEmail = () => {
    setEmails((prev) => [...prev, '']);
  };

  // Update specific email row
  const handleEmailChange = (index: number, val: string) => {
    setEmails((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    // Remove error highlight as user types
    if (assetErrors[`email_${index}`]) {
      setAssetErrors((prev) => {
        const next = { ...prev };
        delete next[`email_${index}`];
        return next;
      });
    }
  };

  // Remove specific email row (for index > 0)
  const handleRemoveEmail = (index: number) => {
    setEmails((prev) => prev.filter((_, idx) => idx !== index));
    setAssetErrors((prev) => {
      const next = { ...prev };
      delete next[`email_${index}`];
      return next;
    });
  };

  // WhatsApp numbers management
  const handleAddWhatsAppNumber = () => {
    setWhatsAppNumbers((prev) => [...prev, '']);
  };

  const handleWhatsAppNumberChange = (index: number, val: string) => {
    setWhatsAppNumbers((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    if (whatsAppErrors[index]) {
      setWhatsAppErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleRemoveWhatsAppNumber = (index: number) => {
    setWhatsAppNumbers((prev) => prev.filter((_, idx) => idx !== index));
    setWhatsAppErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Helper to generate the onboarding assets WhatsApp message template:
  // "Dear {first name}, welcome to PostEx. Your onboarding assets: Employee Code {code} | Machine: {status} | SIM {number} | TimeTrax user {user} | PostEx user {user} | ID Card {status} | Documents {status}. Please keep this information confidential. - HR {officer}"
  const getGeneratedMessage = (withPasswords: boolean) => {
    if (!assetTarget) return '';
    const firstName = assetTarget.name.split(' ')[0];
    const machineStatus = machineEnrollment === 'Enrolled' ? 'Enrolled' : 'Pending';
    const simStatus = simNumber.trim() ? simNumber.trim() : 'Pending';

    let ttUserStatus = 'Pending';
    if (ttUser.trim()) {
      ttUserStatus = withPasswords && ttPw.trim()
        ? `${ttUser.trim()} (pw: ${ttPw.trim()})`
        : ttUser.trim();
    }

    let pxUserStatus = 'Pending';
    if (pxUser.trim()) {
      pxUserStatus = withPasswords && pxPw.trim()
        ? `${pxUser.trim()} (pw: ${pxPw.trim()})`
        : pxUser.trim();
    }

    const idStatus = idCard === 'Provided' ? 'Provided' : 'Pending';
    const docStatus = documentsDispatch === 'Dispatched' ? 'Dispatched' : 'Pending';
    const hrOfficer = currentUser?.name || 'Operations';

    return `Dear ${firstName}, welcome to PostEx. Your onboarding assets: Employee Code ${assetTarget.code} | Machine: ${machineStatus} | SIM ${simStatus} | TimeTrax user ${ttUserStatus} | PostEx user ${pxUserStatus} | ID Card ${idStatus} | Documents ${docStatus}. Please keep this information confidential. - HR ${hrOfficer}`;
  };

  // Image upload handler (real upload with fallback)
  const handleUploadImageAttachment = async (
    fieldKey: 'mc' | 'idc' | 'doc',
    file: File | undefined
  ) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ text: 'Please select an image file (PNG, JPG, WEBP).', isError: true });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({ text: 'File size exceeds 5MB limit.', isError: true });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);

      // Attempt upload to server endpoint
      const uploadRes = await fetch('/api/employees/asset-image/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
        body: formData,
      }).catch(() => null);

      let attachment: AssetImageAttachment = {
        name: file.name,
        url: URL.createObjectURL(file),
      };

      if (uploadRes && uploadRes.ok) {
        const data = await uploadRes.json();
        if (data.url) {
          attachment = {
            name: data.name || file.name,
            url: data.url,
            storage_path: data.storage_path,
          };
        }
      }

      if (fieldKey === 'mc') setMachineImage(attachment);
      if (fieldKey === 'idc') setIdCardImage(attachment);
      if (fieldKey === 'doc') setDocsImage(attachment);
    } catch {
      // Offline fallback
      const localAttachment: AssetImageAttachment = {
        name: file.name,
        url: URL.createObjectURL(file),
      };
      if (fieldKey === 'mc') setMachineImage(localAttachment);
      if (fieldKey === 'idc') setIdCardImage(localAttachment);
      if (fieldKey === 'doc') setDocsImage(localAttachment);
    }
  };

  // Validate and Save Assets (used by Save button, Send Email, and Share on WhatsApp)
  const validateAndSaveAssets = (silentSuccess = false): boolean => {
    if (!assetTarget) return false;

    const newErrors: Record<string, boolean> = {};
    let firstInvalidInput: HTMLElement | null = null;

    // 1. Validate TimeTrax username & password (Required)
    if (!ttUser.trim()) {
      newErrors['tt_user'] = true;
      if (!firstInvalidInput) firstInvalidInput = ttUserRef.current;
    }
    if (!ttPw.trim()) {
      newErrors['tt_pw'] = true;
      if (!firstInvalidInput) firstInvalidInput = ttPwRef.current;
    }

    // 2. Validate PostEx username & password (Required)
    if (!pxUser.trim()) {
      newErrors['px_user'] = true;
      if (!firstInvalidInput) firstInvalidInput = pxUserRef.current;
    }
    if (!pxPw.trim()) {
      newErrors['px_pw'] = true;
      if (!firstInvalidInput) firstInvalidInput = pxPwRef.current;
    }

    // 3. Validate Emails (Optional, but non-empty must be valid)
    emails.forEach((em, idx) => {
      const trimmed = em.trim();
      if (trimmed && !EMAIL_REGEX.test(trimmed)) {
        newErrors[`email_${idx}`] = true;
        if (!firstInvalidInput && emailRefs.current[idx]) {
          firstInvalidInput = emailRefs.current[idx];
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setAssetErrors(newErrors);
      setToast({
        text: 'Please complete the highlighted fields.',
        isError: true,
      });
      if (firstInvalidInput) {
        firstInvalidInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
        firstInvalidInput.focus();
      }
      return false;
    }

    const cleanEmails = emails.map((m) => m.trim()).filter(Boolean);

    const updatedEmp: EmployeeRecord = {
      ...assetTarget,
      sim_number: simNumber.trim(),
      sim_imsi: simImsi.trim(),
      timetrax_username: ttUser.trim(),
      timetrax_password: ttPw.trim(),
      postex_username: pxUser.trim(),
      postex_password: pxPw.trim(),
      emails: cleanEmails.length > 0 ? cleanEmails : [''],
      machine_enrollment: machineEnrollment,
      id_card: idCard,
      documents_dispatch: documentsDispatch,
      machine_enrollment_image: machineImage,
      id_card_image: idCardImage,
      documents_dispatch_image: docsImage,
      emailed_at: emailedDate || assetTarget.emailed_at,
      whatsapp_shared_at: whatsappSharedDate || assetTarget.whatsapp_shared_at,
    };

    // Update in React State & localStorage
    setEmployees((prev) => {
      const next = prev.map((e) => (e.id === assetTarget.id ? updatedEmp : e));
      try {
        localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    // Background call to update server DB if available
    fetch(`/api/employees/${assetTarget.id}/assets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      },
      body: JSON.stringify({
        sim_number: simNumber.trim(),
        sim_imsi: simImsi.trim(),
        timetrax_username: ttUser.trim(),
        timetrax_password: ttPw.trim(),
        postex_username: pxUser.trim(),
        postex_password: pxPw.trim(),
        emails: cleanEmails,
        machine_enrollment: machineEnrollment,
        id_card: idCard,
        documents_dispatch: documentsDispatch,
        machine_enrollment_image: machineImage,
        id_card_image: idCardImage,
        documents_dispatch_image: docsImage,
        emailed_at: emailedDate || assetTarget.emailed_at,
        whatsapp_shared_at: whatsappSharedDate || assetTarget.whatsapp_shared_at,
      }),
    }).catch(() => null);

    if (!silentSuccess) {
      setToast({ text: `Assets submitted to HR — ${assetTarget.name}` });
      setAssetTarget(null);
    }

    return true;
  };

  const handleSaveAssetsModal = () => {
    validateAndSaveAssets(false);
  };

  // Option 1: Send by Email
  const handleSendByEmail = () => {
    if (!assetTarget) return;

    const cleanEmails = emails.map((m) => m.trim()).filter(Boolean);
    if (cleanEmails.length === 0) {
      setAssetErrors((prev) => ({ ...prev, email_0: true }));
      setToast({ text: 'Please enter at least one valid email address.', isError: true });
      if (emailRefs.current[0]) emailRefs.current[0].focus();
      return;
    }

    // Validate and save latest form state
    const isSaved = validateAndSaveAssets(true);
    if (!isSaved) return;

    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    setEmailedDate(todayStr);

    setEmployees((prev) => {
      const next = prev.map((e) =>
        e.id === assetTarget.id ? { ...e, emailed_at: todayStr } : e
      );
      try {
        localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Write audit log entry
    updateHrPortalState((prev) => ({
      ...prev,
      auditLogs: appendPortalAuditLog(
        prev,
        'asset_details_emailed',
        'employee',
        assetTarget.code,
        {
          name: assetTarget.name,
          emails: cleanEmails,
          actor: currentUser?.name || 'Super Admin',
        }
      ),
    }));

    setToast({ text: 'Details sent' });
  };

  // Option 2: Share on WhatsApp
  const handleShareOnWhatsApp = (idx: number) => {
    if (!assetTarget) return;

    // 1. Validate and save form values first
    const isFormValid = validateAndSaveAssets(true);
    if (!isFormValid) return;

    // 2. Validate WhatsApp number at this index
    const rawNum = whatsAppNumbers[idx] || '';
    const { normalized, isValid } = normalizeWhatsAppNumber(rawNum);

    if (!isValid) {
      setWhatsAppErrors((prev) => ({
        ...prev,
        [idx]: 'Enter a valid WhatsApp number',
      }));
      setToast({ text: 'Enter a valid WhatsApp number', isError: true });
      if (waRefs.current[idx]) {
        waRefs.current[idx]?.focus();
      }
      return;
    }

    setWhatsAppErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });

    // 3. Message template (editable preview box)
    const msgToSend = isMessageEdited
      ? customMessage
      : getGeneratedMessage(includePasswords);

    // 4. Open wa.me in new tab
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(msgToSend)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    setWhatsappSharedDate(todayStr);

    setEmployees((prev) => {
      const next = prev.map((e) =>
        e.id === assetTarget.id ? { ...e, whatsapp_shared_at: todayStr } : e
      );
      try {
        localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Write audit log entry
    updateHrPortalState((prev) => ({
      ...prev,
      auditLogs: appendPortalAuditLog(
        prev,
        'asset_details_whatsapp_shared',
        'employee',
        assetTarget.code,
        {
          name: assetTarget.name,
          whatsapp_number: normalized,
          actor: currentUser?.name || 'Super Admin',
        }
      ),
    }));

    setToast({ text: 'Details sent' });
  };

  // Helper to open Add Modal
  const handleOpenAddModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextCode = `PX-EMP-${1001 + employees.length}`;
    setFormImage('');
    setFormCode(nextCode);
    setFormName('');
    setFormDesignation(DESIGS[0].name);
    setFormDepartment(DESIGS[0].dept);
    setFormBranch(BRANCH_LIST[0].name);
    setFormSubDept(SUBD[DESIGS[0].dept]?.[0] || '');
    setFormCnic('');
    setFormStatus('Active');
    setFormPhone('0300-1234567');
    setFormResDate(today);
    setFormLwd(addDaysToDate(today, 30));
    setFormReason(RESIGNATION_REASONS[0]);

    setIsNewModal(true);
    setEditEmployee(null);
  };

  // Helper to open Edit Modal
  const handleOpenEditModal = (emp: EmployeeRecord) => {
    const today = new Date().toISOString().split('T')[0];
    setFormImage(emp.avatar || '');
    setFormCode(emp.code);
    setFormName(emp.name);
    setFormDesignation(emp.designation);
    setFormDepartment(emp.department);
    setFormBranch(emp.branch);
    setFormSubDept(emp.sub_department);
    setFormCnic(emp.cnic);
    setFormStatus(emp.status);
    setFormPhone(emp.phone);
    setFormResDate(emp.resignationDate || today);
    setFormLwd(emp.lastWorkingDay || addDaysToDate(emp.resignationDate || today, 30));
    setFormReason(emp.resignationReason || RESIGNATION_REASONS[0]);

    setIsNewModal(false);
    setEditEmployee(emp);
  };

  // When designation changes in form, auto-sync department
  const handleFormDesignationChange = (newDesig: string) => {
    setFormDesignation(newDesig);
    const dMatch = DESIGS.find((d) => d.name === newDesig);
    if (dMatch) {
      setFormDepartment(dMatch.dept);
      const subList = SUBD[dMatch.dept] || [];
      if (subList.length > 0 && (!formSubDept || !subList.includes(formSubDept))) {
        setFormSubDept(subList[0]);
      }
    }
  };

  // Export to Excel (CSV)
  const handleExportCsv = () => {
    const headers = [
      'Emp ID',
      'Name',
      'Designation',
      'Department',
      'Branch',
      'Sub Department',
      'CNIC',
      'Assets Status',
      'Status',
    ];
    const rows = employees.map((emp) => [
      emp.code,
      `"${emp.name.replace(/"/g, '""')}"`,
      `"${emp.designation.replace(/"/g, '""')}"`,
      `"${emp.department.replace(/"/g, '""')}"`,
      `"${emp.branch.replace(/"/g, '""')}"`,
      `"${emp.sub_department.replace(/"/g, '""')}"`,
      `"${emp.cnic}"`,
      `"${isAssetsComplete(emp) ? 'Complete' : 'Pending'}"`,
      emp.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employees.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({ text: 'Exported employees.csv' });
  };

  // Save Add/Edit
  const handleSaveEmployee = () => {
    // 1. Validation: Name, ID, CNIC
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!formName.trim() || !formCode.trim() || !cnicRegex.test(formCnic.trim())) {
      setToast({ text: 'Name, ID and a valid CNIC (00000-0000000-0) are required.' });
      return;
    }

    // 2. ID already exists check
    const duplicateId = employees.some((emp) => {
      if (editEmployee && emp.id === editEmployee.id) return false;
      return emp.code.trim().toUpperCase() === formCode.trim().toUpperCase();
    });
    if (duplicateId) {
      setToast({ text: 'Employee ID already exists.' });
      return;
    }

    // 3. Valid branch from list check
    const branchMatch = BRANCH_LIST.find(
      (b) => b.name.toUpperCase() === formBranch.trim().toUpperCase()
    );
    if (!branchMatch) {
      setToast({ text: 'Select a valid branch from the list.' });
      return;
    }

    // 4. Resignation block validation
    if (formStatus === 'Resigned') {
      if (!formResDate) {
        setToast({ text: 'Resignation date is required.' });
        return;
      }
      if (formLwd && formLwd < formResDate) {
        setToast({ text: 'Last working day cannot be before resignation date.' });
        return;
      }
    }

    const previousStatus = editEmployee ? editEmployee.status : null;
    const isNew = isNewModal || !editEmployee;

    const savedRecord: EmployeeRecord = {
      id: editEmployee ? editEmployee.id : `emp-${Date.now()}`,
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      designation: formDesignation,
      department: formDepartment,
      branch: branchMatch.name,
      zone: branchMatch.zone,
      sub_department: formSubDept || SUBD[formDepartment]?.[0] || 'General',
      cnic: formCnic.trim(),
      phone: formPhone.trim() || '0300-1234567',
      status: formStatus,
      avatar: formImage || editEmployee?.avatar,
      resignationDate: formStatus === 'Resigned' ? formResDate : undefined,
      lastWorkingDay: formStatus === 'Resigned' ? formLwd : undefined,
      resignationReason: formStatus === 'Resigned' ? formReason : undefined,
      exitCompleted: editEmployee?.exitCompleted || false,
      timetrax_username: editEmployee?.timetrax_username || '',
      timetrax_password: editEmployee?.timetrax_password || '',
      postex_username: editEmployee?.postex_username || '',
      postex_password: editEmployee?.postex_password || '',
      emails: editEmployee?.emails || [''],
      machine_enrollment: editEmployee?.machine_enrollment || 'Not Enrolled',
      id_card: editEmployee?.id_card || 'Not Provided',
      documents_dispatch: editEmployee?.documents_dispatch || 'Not Dispatched',
      machine_enrollment_image: editEmployee?.machine_enrollment_image || null,
      id_card_image: editEmployee?.id_card_image || null,
      documents_dispatch_image: editEmployee?.documents_dispatch_image || null,
    };

    if (isNew) {
      setEmployees((prev) => [savedRecord, ...prev]);
    } else {
      setEmployees((prev) => prev.map((e) => (e.id === savedRecord.id ? savedRecord : e)));
    }

    // Write to audit log in portal store
    updateHrPortalState((prev) => ({
      ...prev,
      auditLogs: appendPortalAuditLog(
        prev,
        isNew ? 'employee_created' : 'employee_updated',
        'employee',
        savedRecord.code,
        {
          name: savedRecord.name,
          designation: savedRecord.designation,
          status: savedRecord.status,
          actor: currentUser?.name || 'Super Admin',
        }
      ),
    }));

    // If status is Resigned, create or update ExitRecord in hrPortalStore
    if (formStatus === 'Resigned') {
      updateHrPortalState((prev) => {
        const existingIdx = prev.exits.findIndex(
          (x) => x.employeeId === savedRecord.id || x.employeeCode === savedRecord.code
        );

        const newExitRecord: ExitRecord = {
          id: existingIdx >= 0 ? prev.exits[existingIdx].id : `exit-emp-${savedRecord.code}`,
          employeeId: savedRecord.id,
          employeeCode: savedRecord.code,
          n: savedRecord.name,
          d: savedRecord.designation,
          b: [savedRecord.branch, savedRecord.zone, 'Hamza Ali'],
          ago: 0,
          k: 0,
          checklist: prev.ecfItems.map(() => false),
          type: 'Resignation',
          lastWorkingDate: formLwd || formResDate || new Date().toISOString().split('T')[0],
          reason: formReason,
          notes: `Resignation submitted via Employee List directory for ${savedRecord.name}`,
          initiatedAt: new Date().toISOString(),
        };

        const nextExits =
          existingIdx >= 0
            ? prev.exits.map((x, i) => (i === existingIdx ? newExitRecord : x))
            : [newExitRecord, ...prev.exits];

        return {
          ...prev,
          exits: nextExits,
        };
      });

      setToast({
        text: `${savedRecord.name} moved to Exit Workflow.`,
        actionLabel: 'Open Exit Tracker →',
        onAction: onOpenExitTracker,
      });
    } else if (previousStatus === 'Resigned' && formStatus !== 'Resigned') {
      // Changed resigned employee back to Active/Terminated: withdraw exit record
      updateHrPortalState((prev) => ({
        ...prev,
        exits: prev.exits.filter(
          (x) => x.employeeId !== savedRecord.id && x.employeeCode !== savedRecord.code
        ),
      }));

      setToast({
        text: `Resignation withdrawn — ${savedRecord.name} removed from Exit Workflow.`,
      });
    } else {
      setToast({
        text: isNew ? `Added employee ${savedRecord.name}` : `Updated employee ${savedRecord.name}`,
      });
    }

    setIsNewModal(false);
    setEditEmployee(null);
  };

  // Delete employee
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));

    // Audit log
    updateHrPortalState((prev) => ({
      ...prev,
      auditLogs: appendPortalAuditLog(
        prev,
        'employee_deleted',
        'employee',
        deleteTarget.code,
        {
          name: deleteTarget.name,
          reason: deleteReason.trim() || 'Deleted by Super Admin',
          actor: currentUser?.name || 'Super Admin',
        }
      ),
    }));

    setToast({ text: `Deleted ${deleteTarget.name}` });
    setDeleteTarget(null);
    setDeleteReason('');
  };

  // Avatar helper
  const renderAvatar = (emp: EmployeeRecord, sizeClass = '') => {
    if (emp.avatar) {
      return (
        <div className={`avatar ${sizeClass}`}>
          <img src={emp.avatar} alt={emp.name} />
        </div>
      );
    }
    const initials = emp.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return <div className={`avatar ${sizeClass}`}>{initials}</div>;
  };

  // Dynamic Badges for Cards
  const isSimAssigned = Boolean(simNumber.trim());
  const isTimeTraxVerified = Boolean(ttUser.trim() && ttPw.trim());
  const isPostExVerified = Boolean(pxUser.trim() && pxPw.trim());
  const validEmailCount = emails.filter((m) => EMAIL_REGEX.test(m.trim())).length;
  const emailBadgeText =
    validEmailCount === 0
      ? 'Not added'
      : validEmailCount === 1
      ? 'Email Added'
      : `${validEmailCount} Emails Added`;

  return (
    <div className="el-page">
      {/* 1. Page Header */}
      <div className="page-header">
        <div>
          <h1>Employee List</h1>
          <p>Complete directory of all employees with their details.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            Export to Excel
          </button>
          <button type="button" className="btn p" onClick={handleOpenAddModal}>
            <Plus className="w-3.5 h-3.5" />
            + Add Employee
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="filter-bar">
        {/* Scope Select: All Employees | Active Employees (bold) */}
        <select
          value={scopeFilter}
          onChange={(e) => handleScopeChange(e.target.value as 'all' | 'active')}
          className="bold-select"
        >
          <option value="all">All Employees</option>
          <option value="active">Active Employees</option>
        </select>

        {/* Top Search Input */}
        <input
          type="text"
          className="search-input"
          placeholder="Search name, employee ID, CNIC..."
          value={topSearch}
          onChange={(e) => {
            setTopSearch(e.target.value);
            setPage(1);
          }}
        />

        {/* Branch Input with Datalist */}
        <input
          type="text"
          className="branch-input"
          list="branch-datalist"
          placeholder="All branches (type to search)"
          value={branchFilter}
          onChange={(e) => {
            setBranchFilter(e.target.value);
            setPage(1);
          }}
        />
        <datalist id="branch-datalist">
          <option value="">All branches</option>
          {BRANCH_LIST.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({b.zone})
            </option>
          ))}
        </datalist>

        {/* Department Select */}
        <select
          className="dept-select"
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Departments</option>
          {DEPTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Assets Status Select */}
        <select
          className="asset-select"
          value={assetFilter}
          onChange={(e) => {
            setAssetFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Assets: All</option>
          <option value="Complete">Complete</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      {/* 3. Status Chips with live counts following all other filters */}
      <div className="status-chips">
        <button
          type="button"
          className={`chip ${statusFilter === 'All' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('All');
            setPage(1);
          }}
        >
          All Statuses ({chipCounts.all})
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'Active' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('Active');
            setPage(1);
          }}
        >
          Active ({chipCounts.active})
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'Resigned' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('Resigned');
            setPage(1);
          }}
        >
          Resigned ({chipCounts.resigned})
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'Terminated' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('Terminated');
            setPage(1);
          }}
        >
          Terminated ({chipCounts.terminated})
        </button>
      </div>

      {/* 4. Table Card with 11 Columns in exact order and second header row */}
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              {/* First Header Row: Column Titles */}
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>Emp Image</th>
                <th style={{ minWidth: '105px' }}>Assets</th>
                <th>Emp ID</th>
                <th>Emp Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Branch</th>
                <th>Sub Department</th>
                <th>CNIC</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', minWidth: '110px' }}>Actions</th>
              </tr>

              {/* Second Header Row: Small Search Inputs (26px height, 11px text, min-width 96px) */}
              <tr>
                {/* Emp Image: empty */}
                <th className="sub-filter-th" style={{ textAlign: 'center' }}></th>

                {/* Assets: empty */}
                <th className="sub-filter-th"></th>

                {/* Emp ID search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search Emp ID"
                    value={colEmpId}
                    onChange={(e) => {
                      setColEmpId(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Emp Name search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search name"
                    value={colName}
                    onChange={(e) => {
                      setColName(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Designation search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search designation"
                    value={colDesig}
                    onChange={(e) => {
                      setColDesig(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Department search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search department"
                    value={colDept}
                    onChange={(e) => {
                      setColDept(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Branch search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search branch"
                    value={colBranch}
                    onChange={(e) => {
                      setColBranch(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Sub Department search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search sub department"
                    value={colSubDept}
                    onChange={(e) => {
                      setColSubDept(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* CNIC search */}
                <th className="sub-filter-th">
                  <input
                    type="text"
                    placeholder="Search CNIC"
                    value={colCnic}
                    onChange={(e) => {
                      setColCnic(e.target.value);
                      setPage(1);
                    }}
                  />
                </th>

                {/* Status Dropdown (synced with status chip) */}
                <th className="sub-filter-th">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as any);
                      setPage(1);
                    }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </th>

                {/* Actions: empty */}
                <th className="sub-filter-th"></th>
              </tr>
            </thead>

            <tbody>
              {pagedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    No employees match your filters.
                  </td>
                </tr>
              ) : (
                pagedEmployees.map((emp) => {
                  const complete = isAssetsComplete(emp);
                  return (
                    <tr key={emp.id}>
                      {/* Emp Image */}
                      <td style={{ textAlign: 'center' }}>{renderAvatar(emp)}</td>

                      {/* Assets Cell */}
                      <td>
                        <div className="asset-cell">
                          <button
                            type="button"
                            className="btn-asset"
                            onClick={() => handleOpenAssetsModal(emp)}
                            title={`Manage assets for ${emp.name}`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            Assets
                          </button>
                          <span className={`asset-label ${complete ? 'complete' : 'pending'}`}>
                            <span className="asset-dot" />
                            {complete ? 'Complete' : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Emp ID */}
                      <td style={{ fontWeight: 500, color: '#334155' }}>{emp.code}</td>

                      {/* Emp Name (bold) */}
                      <td className="emp-name-cell">{emp.name}</td>

                      {/* Designation */}
                      <td>{emp.designation}</td>

                      {/* Department */}
                      <td>{emp.department}</td>

                      {/* Branch */}
                      <td>{emp.branch}</td>

                      {/* Sub Department */}
                      <td>{emp.sub_department}</td>

                      {/* CNIC */}
                      <td>{emp.cnic}</td>

                      {/* Status Badge */}
                      <td>
                        <span className={`badge ${emp.status.toLowerCase()}`}>
                          {emp.status}
                        </span>
                      </td>

                      {/* Actions: ONLY Edit and Delete (red outline) */}
                      <td>
                        <div className="actions-cell">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleOpenEditModal(emp)}
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-del"
                            onClick={() => {
                              setDeleteTarget(emp);
                              setDeleteReason('');
                            }}
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer Bar: 1–15 of 26 + buttons ‹ 1 2 › */}
        <div className="pagination-bar">
          <div>
            {filteredEmployees.length > 0 ? (
              <span>
                {startIndex + 1}–{endIndex} of {filteredEmployees.length}
              </span>
            ) : (
              <span>0 of 0</span>
            )}
          </div>
          <div className="page-controls">
            <button
              type="button"
              className="pg-btn"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={`pg-btn ${pNum === currentPage ? 'active' : ''}`}
                onClick={() => setPage(pNum)}
              >
                {pNum}
              </button>
            ))}
            <button
              type="button"
              className="pg-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ================= ASSET DETAILS POPUP (100% exact copy of employee-assets-popup.html) ================= */}
      {assetTarget && (
        <div className="el-modal-overlay" onClick={handleCloseAssetsModal}>
          <div className="el-modal-card asset-modal" onClick={(e) => e.stopPropagation()}>
            {/* Popup Header Shell */}
            <div className="el-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c6cff, #4f46e5)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 8px 16px -6px rgba(79,70,229,.7)',
                  }}
                >
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    Employee Assets
                  </h2>
                  <p style={{ margin: '1px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    Fill in the asset details for this employee
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderAvatar(assetTarget, 'avatar')}
                  <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
                    <b style={{ fontSize: '12.5px', color: '#0f172a', display: 'block' }}>{assetTarget.name}</b>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                      {assetTarget.code} · {assetTarget.designation}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="el-modal-close"
                  onClick={handleCloseAssetsModal}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Popup Body: Exactly 6 Cards in Exact Specified Order */}
            <div className="el-modal-body">
              {/* Employee Quick Info Strip */}
              <div className="asset-header-bar">
                <div className="ci">
                  <Package className="w-5 h-5" />
                </div>
                <div style={{ paddingRight: '16px', borderRight: '1px solid #e3e1f7' }}>
                  <small style={{ display: 'block', fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Employee Code
                  </small>
                  <b style={{ fontSize: '13px', color: '#0f172a' }}>{assetTarget.code}</b>
                </div>
                <div style={{ padding: '0 16px', borderRight: '1px solid #e3e1f7' }}>
                  <small style={{ display: 'block', fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Department
                  </small>
                  <b style={{ fontSize: '13px', color: '#0f172a' }}>{assetTarget.department}</b>
                </div>
                <div style={{ padding: '0 16px', borderRight: '1px solid #e3e1f7' }}>
                  <small style={{ display: 'block', fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                    Branch
                  </small>
                  <b style={{ fontSize: '13px', color: '#0f172a' }}>{assetTarget.branch}</b>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="badge active" style={{ fontSize: '11px', padding: '3px 10px' }}>
                    {assetTarget.status}
                  </span>
                </div>
              </div>

              {/* 6 Asset Cards Grid (2 columns on desktop): SIM + IMSI, TimeTrax, PostEx, Machine Enrollment, ID Card, Documents sent to HO */}
              <div className="grid">
                {/* 1. SIM + IMSI */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h4>SIM + IMSI</h4>
                    <span className={`bg ${isSimAssigned ? 'ok' : ''}`}>
                      {isSimAssigned ? 'Assigned' : 'Pending'}
                    </span>
                  </div>
                  <div className="fs">
                    <div className="f">
                      <label htmlFor="sim_num">SIM Number</label>
                      <input
                        id="sim_num"
                        type="text"
                        value={simNumber}
                        onChange={(e) => setSimNumber(e.target.value)}
                        placeholder="0300-1234567"
                      />
                    </div>
                    <div className="f">
                      <label htmlFor="sim_imsi">IMSI</label>
                      <input
                        id="sim_imsi"
                        type="text"
                        value={simImsi}
                        onChange={(e) => setSimImsi(e.target.value)}
                        placeholder="89920100XXXXXXXX"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. TimeTrax App Login */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h4>TimeTrax App Login</h4>
                    <span className={`bg ${isTimeTraxVerified ? 'ok' : ''}`}>
                      {isTimeTraxVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="fs">
                    <div className="f">
                      <label htmlFor="tt_user">
                        Username <i>*</i>
                      </label>
                      <input
                        ref={ttUserRef}
                        id="tt_user"
                        type="text"
                        value={ttUser}
                        onChange={(e) => {
                          setTtUser(e.target.value);
                          if (assetErrors['tt_user']) {
                            setAssetErrors((p) => ({ ...p, tt_user: false }));
                          }
                        }}
                        placeholder=""
                        className={assetErrors['tt_user'] ? 'bad' : ''}
                      />
                    </div>
                    <div className="f">
                      <label htmlFor="tt_pw">
                        Password <i>*</i>
                      </label>
                      <div className="pw">
                        <input
                          ref={ttPwRef}
                          id="tt_pw"
                          type={showTtPw ? 'text' : 'password'}
                          value={ttPw}
                          onChange={(e) => {
                            setTtPw(e.target.value);
                            if (assetErrors['tt_pw']) {
                              setAssetErrors((p) => ({ ...p, tt_pw: false }));
                            }
                          }}
                          autoComplete="new-password"
                          className={assetErrors['tt_pw'] ? 'bad' : ''}
                        />
                        <button
                          type="button"
                          className="eye"
                          onClick={() => setShowTtPw((prev) => !prev)}
                          aria-label="Toggle TimeTrax password visibility"
                        >
                          {showTtPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. PostEx Login */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <Key className="w-4 h-4" />
                    </div>
                    <h4>PostEx Login</h4>
                    <span className={`bg ${isPostExVerified ? 'ok' : ''}`}>
                      {isPostExVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="fs">
                    <div className="f">
                      <label htmlFor="px_user">
                        Username <i>*</i>
                      </label>
                      <input
                        ref={pxUserRef}
                        id="px_user"
                        type="text"
                        value={pxUser}
                        onChange={(e) => {
                          setPxUser(e.target.value);
                          if (assetErrors['px_user']) {
                            setAssetErrors((p) => ({ ...p, px_user: false }));
                          }
                        }}
                        placeholder=""
                        className={assetErrors['px_user'] ? 'bad' : ''}
                      />
                    </div>
                    <div className="f">
                      <label htmlFor="px_pw">
                        Password <i>*</i>
                      </label>
                      <div className="pw">
                        <input
                          ref={pxPwRef}
                          id="px_pw"
                          type={showPxPw ? 'text' : 'password'}
                          value={pxPw}
                          onChange={(e) => {
                            setPxPw(e.target.value);
                            if (assetErrors['px_pw']) {
                              setAssetErrors((p) => ({ ...p, px_pw: false }));
                            }
                          }}
                          autoComplete="new-password"
                          className={assetErrors['px_pw'] ? 'bad' : ''}
                        />
                        <button
                          type="button"
                          className="eye"
                          onClick={() => setShowPxPw((prev) => !prev)}
                          aria-label="Toggle PostEx password visibility"
                        >
                          {showPxPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. Machine Enrollment */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <h4>Machine Enrollment</h4>
                    <span className={`bg ${machineEnrollment === 'Enrolled' ? 'ok' : ''}`}>
                      {machineEnrollment}
                    </span>
                  </div>
                  <div className="f">
                    <label htmlFor="st_mc">Status</label>
                    <select
                      id="st_mc"
                      className="sel"
                      value={machineEnrollment}
                      onChange={(e) => setMachineEnrollment(e.target.value as MachineEnrollmentStatus)}
                    >
                      <option value="Enrolled">Enrolled</option>
                      <option value="Not Enrolled">Not Enrolled</option>
                    </select>
                  </div>
                  <div className="att">
                    {machineImage ? (
                      <>
                        <img src={machineImage.url} alt="" />
                        <span className="nm" title={machineImage.name}>
                          {machineImage.name}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => setMachineImage(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <label>
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach image
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleUploadImageAttachment('mc', e.target.files?.[0])}
                          />
                        </label>
                        <span>Optional</span>
                      </>
                    )}
                  </div>
                </section>

                {/* 5. ID Card */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h4>ID Card</h4>
                    <span className={`bg ${idCard === 'Provided' ? 'ok' : ''}`}>
                      {idCard}
                    </span>
                  </div>
                  <div className="f">
                    <label htmlFor="st_idc">Status</label>
                    <select
                      id="st_idc"
                      className="sel"
                      value={idCard}
                      onChange={(e) => setIdCard(e.target.value as IdCardStatus)}
                    >
                      <option value="Provided">Provided</option>
                      <option value="Not Provided">Not Provided</option>
                    </select>
                  </div>
                  <div className="att">
                    {idCardImage ? (
                      <>
                        <img src={idCardImage.url} alt="" />
                        <span className="nm" title={idCardImage.name}>
                          {idCardImage.name}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => setIdCardImage(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <label>
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach image
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleUploadImageAttachment('idc', e.target.files?.[0])}
                          />
                        </label>
                        <span>Optional</span>
                      </>
                    )}
                  </div>
                </section>

                {/* 6. Documents sent to Head Office */}
                <section className="cd">
                  <div className="ch">
                    <div className="ci">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h4>Documents sent to Head Office</h4>
                    <span className={`bg ${documentsDispatch === 'Dispatched' ? 'ok' : ''}`}>
                      {documentsDispatch}
                    </span>
                  </div>
                  <div className="f">
                    <label htmlFor="st_doc">Status</label>
                    <select
                      id="st_doc"
                      className="sel"
                      value={documentsDispatch}
                      onChange={(e) => setDocumentsDispatch(e.target.value as DocumentsDispatchStatus)}
                    >
                      <option value="Dispatched">Dispatched</option>
                      <option value="Not Dispatched">Not Dispatched</option>
                    </select>
                  </div>
                  <div className="att">
                    {docsImage ? (
                      <>
                        <img src={docsImage.url} alt="" />
                        <span className="nm" title={docsImage.name}>
                          {docsImage.name}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => setDocsImage(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <label>
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach image
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleUploadImageAttachment('doc', e.target.files?.[0])}
                          />
                        </label>
                        <span>Optional</span>
                      </>
                    )}
                  </div>
                </section>
              </div>

              {/* TASK 2: NEW "SHARE DETAILS" SECTION AT THE BOTTOM */}
              {/* Full-width card below the asset cards and above the footer */}
              <div className="share-details-card">
                <div className="sd-header">
                  <div>
                    <h3>Share Details</h3>
                    <p>Send these asset details to the employee or HR</p>
                  </div>
                  <div className="sd-badges">
                    {emailedDate && (
                      <span className="badge-shared emailed">
                        <Mail className="w-3 h-3" />
                        Emailed {emailedDate}
                      </span>
                    )}
                    {whatsappSharedDate && (
                      <span className="badge-shared whatsapp">
                        <WhatsAppIcon className="w-3 h-3 text-emerald-600" />
                        Shared on WhatsApp {whatsappSharedDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sd-body">
                  {/* Option 1 — Email */}
                  <div className="sd-option sd-email-block">
                    <label className="sd-option-label">Email</label>
                    <div className="sd-field-group">
                      {emails.map((emailVal, idx) => (
                        <div key={idx} className="sd-row">
                          <div className="sd-input-wrap">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              ref={(el) => {
                                emailRefs.current[idx] = el;
                              }}
                              type="email"
                              value={emailVal}
                              placeholder="name@company.com"
                              onChange={(e) => handleEmailChange(idx, e.target.value)}
                              className={assetErrors[`email_${idx}`] ? 'bad' : ''}
                              aria-label={`Email address ${idx + 1}`}
                            />
                          </div>
                          {idx > 0 && (
                            <button
                              type="button"
                              className="sd-btn-rm"
                              onClick={() => handleRemoveEmail(idx)}
                              aria-label="Remove email"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      <div className="sd-actions-row">
                        <button type="button" className="sd-btn-add" onClick={handleAddEmail}>
                          <Plus className="w-3.5 h-3.5" />
                          Add another email
                        </button>
                        <button
                          type="button"
                          className="btn-send-email"
                          onClick={handleSendByEmail}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Send by Email
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Option 2 — WhatsApp */}
                  <div className="sd-option sd-wa-block">
                    <label className="sd-option-label">WhatsApp number</label>
                    <div className="sd-field-group">
                      {whatsAppNumbers.map((waVal, idx) => (
                        <div key={idx} className="sd-wa-item">
                          <div className="sd-row">
                            <div className="sd-wa-input-wrap">
                              <span className="wa-prefix">+92</span>
                              <input
                                ref={(el) => {
                                  waRefs.current[idx] = el;
                                }}
                                type="tel"
                                value={waVal}
                                placeholder="3001234567"
                                onChange={(e) => handleWhatsAppNumberChange(idx, e.target.value)}
                                className={whatsAppErrors[idx] ? 'bad' : ''}
                                aria-label={`WhatsApp number ${idx + 1}`}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-share-wa"
                              onClick={() => handleShareOnWhatsApp(idx)}
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                              Share on WhatsApp
                            </button>
                            {idx > 0 && (
                              <button
                                type="button"
                                className="sd-btn-rm"
                                onClick={() => handleRemoveWhatsAppNumber(idx)}
                                aria-label="Remove WhatsApp number"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {whatsAppErrors[idx] && (
                            <span className="sd-error-text">{whatsAppErrors[idx]}</span>
                          )}
                        </div>
                      ))}

                      <div className="sd-actions-row">
                        <button type="button" className="sd-btn-add" onClick={handleAddWhatsAppNumber}>
                          <Plus className="w-3.5 h-3.5" />
                          Add another number
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Shared Controls: Include Passwords checkbox & Message Preview */}
                  <div className="sd-shared-controls">
                    <div className="sd-passwords-row">
                      <label className="sd-checkbox-label">
                        <input
                          type="checkbox"
                          checked={includePasswords}
                          onChange={(e) => {
                            setIncludePasswords(e.target.checked);
                            if (!isMessageEdited) {
                              setCustomMessage('');
                            }
                          }}
                        />
                        <span>Include passwords</span>
                      </label>
                      <span className="sd-hint-text">
                        (Default off for WhatsApp: WhatsApp is not a secure channel)
                      </span>
                    </div>

                    <div className="sd-preview-box">
                      <div className="sd-preview-header">
                        <label>Message Preview (editable)</label>
                        {isMessageEdited && (
                          <button
                            type="button"
                            className="sd-reset-link"
                            onClick={() => {
                              setIsMessageEdited(false);
                              setCustomMessage('');
                            }}
                          >
                            Reset to template
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={isMessageEdited ? customMessage : getGeneratedMessage(includePasswords)}
                        onChange={(e) => {
                          setCustomMessage(e.target.value);
                          setIsMessageEdited(true);
                        }}
                        placeholder="Message to be sent via WhatsApp or Email..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Popup Footer Shell */}
            <div className="el-modal-footer">
              <button
                type="button"
                className="btn"
                onClick={handleCloseAssetsModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn p"
                onClick={handleSaveAssetsModal}
              >
                Save &amp; Submit to HR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT MODAL ================= */}
      {(isNewModal || editEmployee) && (
        <div
          className="el-modal-overlay"
          onClick={() => {
            setIsNewModal(false);
            setEditEmployee(null);
          }}
        >
          <div className="el-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="el-modal-header">
              <span>{isNewModal ? '+ Add Employee' : 'Edit Employee'}</span>
              <button
                type="button"
                className="el-modal-close"
                onClick={() => {
                  setIsNewModal(false);
                  setEditEmployee(null);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="el-modal-body">
              {/* Employee Image upload + 50px preview */}
              <div className="form-group" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div className="avatar-preview-box">
                  {formImage ? (
                    <img src={formImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    formName ? formName[0].toUpperCase() : '?'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label>Employee Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="file-input-compact"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormImage(String(ev.target?.result || ''));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              {/* ID & Name */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="PX-EMP-1001"
                  />
                </div>
                <div className="form-group">
                  <label>Employee Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>
              </div>

              {/* Designation & Department */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Designation *</label>
                  <select
                    value={formDesignation}
                    onChange={(e) => handleFormDesignationChange(e.target.value)}
                  >
                    {DESIGS.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                  >
                    {DEPTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch & Sub Department */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Branch *</label>
                  <input
                    type="text"
                    list="form-branch-list"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    placeholder="Type branch name"
                  />
                  <datalist id="form-branch-list">
                    {BRANCH_LIST.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name} ({b.zone})
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Sub Department</label>
                  <input
                    type="text"
                    value={formSubDept}
                    onChange={(e) => setFormSubDept(e.target.value)}
                    placeholder="Sub-dept"
                  />
                </div>
              </div>

              {/* CNIC, Status & Phone */}
              <div className="grid-2">
                <div className="form-group">
                  <label>CNIC * (00000-0000000-0)</label>
                  <input
                    type="text"
                    value={formCnic}
                    onChange={(e) => setFormCnic(e.target.value)}
                    placeholder="35202-1234567-1"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formStatus}
                    disabled={editEmployee?.exitCompleted}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0300-1234567"
                />
              </div>

              {/* Resignation Block (.rsb): Shown ONLY when Status = Resigned */}
              {formStatus === 'Resigned' && (
                <div className="rsb">
                  <div className="rsb-title">Resignation details</div>
                  <div className="grid-2">
                    <div>
                      <label style={{ color: '#92400e' }}>Resignation Date *</label>
                      <input
                        type="date"
                        value={formResDate}
                        disabled={editEmployee?.exitCompleted}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormResDate(val);
                          // Auto set LWD to +30 days if LWD not manually edited
                          if (val) {
                            setFormLwd(addDaysToDate(val, 30));
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#92400e' }}>Last Working Day</label>
                      <input
                        type="date"
                        value={formLwd}
                        disabled={editEmployee?.exitCompleted}
                        onChange={(e) => setFormLwd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#92400e' }}>Reason</label>
                    <select
                      value={formReason}
                      disabled={editEmployee?.exitCompleted}
                      onChange={(e) => setFormReason(e.target.value)}
                    >
                      {RESIGNATION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editEmployee?.exitCompleted && (
                    <div className="locked-notice">
                      Exit is already completed. Resignation details are locked.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="el-modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIsNewModal(false);
                  setEditEmployee(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn p" onClick={handleSaveEmployee}>
                Save Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRM MODAL ================= */}
      {deleteTarget && (
        <div className="el-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="el-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="el-modal-header">
              <span>Delete {deleteTarget.name}</span>
              <button
                type="button"
                className="el-modal-close"
                onClick={() => setDeleteTarget(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="el-modal-body">
              <p className="confirm-msg">
                Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.code})?
                This action will remove the employee from directory records.
              </p>
              <div className="form-group">
                <label>Audit Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Inadvertent duplicate entry, test record"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </div>
            </div>
            <div className="el-modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-del"
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FLOATING TOAST ================= */}
      {toast && (
        <div className={`el-toast ${toast.isError ? 'bg-rose-900 border border-rose-700 text-rose-100' : ''}`}>
          <span>{toast.text}</span>
          {toast.actionLabel && toast.onAction && (
            <a
              onClick={(e) => {
                e.preventDefault();
                toast.onAction?.();
              }}
            >
              {toast.actionLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
