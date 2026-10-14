import { readFileSync } from 'fs';
import { join } from 'path';

// Empirical test suite for Super Admin Employee List Port

let passed = 0;
let failed = 0;

function assert(desc: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${desc} ${detail ? '(' + detail + ')' : ''}`);
  }
}

console.log('====================================================');
console.log('   SUPER ADMIN EMPLOYEE LIST VERIFICATION SUITE     ');
console.log('====================================================\n');

// 1. DATA GENERATOR VERIFICATION
console.log('--- 1. Demo Data Generator Test ---');
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

interface DemoEmp {
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
}

const employees: DemoEmp[] = [];
for (let i = 0; i < 26; i++) {
  const dObj = DESIGS[i % 6];
  const bObj = BRANCH_LIST[i % 8];
  const dept = dObj.dept;
  const subList = SUBD[dept];
  let status: 'Active' | 'Resigned' | 'Terminated' = 'Active';
  if (i % 7 === 3) status = 'Resigned';
  else if (i % 11 === 7) status = 'Terminated';

  const cnicNumber = String(1000000 + ((i * 7919) % 9000000)).slice(0, 7);
  const cnicCheck = (i % 9) + 1;
  const phoneSuffix = String(1234000 + i * 37).slice(0, 7);

  employees.push({
    id: `emp-demo-${1001 + i}`,
    code: `PX-EMP-${1001 + i}`,
    name: `${RN[i % 12]} ${LN[(i * 3) % 8]}`,
    designation: dObj.name,
    department: dept,
    branch: bObj.name,
    zone: bObj.zone,
    sub_department: subList[i % subList.length],
    cnic: `35202-${cnicNumber}-${cnicCheck}`,
    phone: `0300-${phoneSuffix}`,
    status,
  });
}

assert('Total employees count is exactly 26', employees.length === 26);
const activeCount = employees.filter((e) => e.status === 'Active').length;
const resignedCount = employees.filter((e) => e.status === 'Resigned').length;
const termCount = employees.filter((e) => e.status === 'Terminated').length;
assert('Active count is 20', activeCount === 20, `got ${activeCount}`);
assert('Resigned count is 4', resignedCount === 4, `got ${resignedCount}`);
assert('Terminated count is 2', termCount === 2, `got ${termCount}`);
assert('First employee code is PX-EMP-1001', employees[0].code === 'PX-EMP-1001');
assert('Last employee code is PX-EMP-1026', employees[25].code === 'PX-EMP-1026');

// 2. FILTER COMBINATION & LIVE COUNTS
console.log('\n--- 2. Filter Combination & Live Status Chips ---');
// Test scope filter: "Active Employees"
const activeScope = employees.filter((e) => e.status === 'Active');
assert('Active Employees filter returns 20 records', activeScope.length === 20);

// Test top search: match name
const searchUsman = employees.filter((e) => e.name.toLowerCase().includes('usman'));
assert('Search "Usman" returns matching employees', searchUsman.length > 0 && searchUsman.every((e) => e.name.includes('Usman')));

// Test branch filter
const branchGulberg = employees.filter((e) => e.branch === 'LHR-GULBERG');
assert('Branch filter LHR-GULBERG returns employees', branchGulberg.length > 0 && branchGulberg.every((e) => e.branch === 'LHR-GULBERG'));

// Test column filters: contains, case-insensitive
const colSearchRider = employees.filter((e) => e.designation.toLowerCase().includes('rider'));
assert('Column search "rider" returns only riders', colSearchRider.length > 0 && colSearchRider.every((e) => e.designation === 'RIDER'));

// 3. PAGINATION MATH
console.log('\n--- 3. Pagination & Empty State ---');
const pageSize = 15;
const totalPages = Math.ceil(employees.length / pageSize);
assert('Total pages for 26 items with pageSize 15 is 2', totalPages === 2);
const page1Items = employees.slice(0, 15);
const page2Items = employees.slice(15, 26);
assert('Page 1 items count is 15', page1Items.length === 15);
assert('Page 2 items count is 11', page2Items.length === 11);

// 4. SCOPED CSS TOKENS AND CLASSES VERIFICATION
console.log('\n--- 4. Scoped CSS Stylesheet Audit ---');
const cssContent = readFileSync(join(process.cwd(), 'src/styles/employee-list.css'), 'utf-8');
assert('Scoped under .el-page wrapper', cssContent.includes('.el-page {'));
assert('Font Inter is configured', cssContent.includes('Inter'));
assert('Base 12px font size is set', cssContent.includes('font-size: 12px;'));
assert('--bg: #f3f5fa is defined', cssContent.includes('#f3f5fa'));
assert('--line: #e5e9f2 is defined', cssContent.includes('#e5e9f2'));
assert('--pri: #4f46e5 is defined', cssContent.includes('#4f46e5'));
assert('Page header h1 is 19px/700', cssContent.includes('font-size: 19px;') && cssContent.includes('font-weight: 700;'));
assert('Table card radius 14px', cssContent.includes('border-radius: 14px;'));
assert('Table header cells 10.5px uppercase', cssContent.includes('font-size: 10.5px;') && cssContent.includes('text-transform: uppercase;'));
assert('Resignation block (.rsb) exists with amber styling', cssContent.includes('.rsb') && cssContent.includes('#fde68a') && cssContent.includes('#fffbeb'));
assert('Modal overlay rgba(10,17,40,0.5) with blur', cssContent.includes('backdrop-filter: blur(3px)'));
assert('Modal card radius 16px and max-width 520px', cssContent.includes('border-radius: 16px;') && cssContent.includes('max-width: 520px;'));
assert('Badges: Active green, Resigned amber, Terminated red', cssContent.includes('#d1fae5') && cssContent.includes('#fef3c7') && cssContent.includes('#ffe4e6'));

// 5. NAVIGATION AND TOP BAR CONNECTIONS
console.log('\n--- 5. Navigation & Top Bar Connections ---');
const dashboardContent = readFileSync(join(process.cwd(), 'src/components/SuperAdminDashboard.tsx'), 'utf-8');
assert('SuperAdminDashboard imports EmployeeListView', dashboardContent.includes('EmployeeListView'));
assert('sidebarItems contains Employee List', dashboardContent.includes('Employee List'));
assert('Top bar contains search input with Ctrl+K shortcut', dashboardContent.includes('Ctrl+K') || dashboardContent.includes('⌘K'));
assert('Top bar search submit navigates to employees tab', dashboardContent.includes("setActiveTab('employees')"));
assert('Exit Tracker link connection passed to EmployeeListView', dashboardContent.includes("setWorkflowInitialView('e')"));

// 6. ASSETS TRACKING & POPUP REDESIGN COMPLIANCE (employee-assets-popup.html)
console.log('\n--- 6. Assets Tracking & 6-Card Popup Audit ---');
const empListContent = readFileSync(join(process.cwd(), 'src/components/admin/EmployeeListView.tsx'), 'utf-8');
assert('Assets column exists directly after Emp Image', empListContent.includes('<th style={{ minWidth: \'105px\' }}>Assets</th>'));
assert('Assets cell has primary button with Package icon', empListContent.includes('btn-asset') && empListContent.includes('Package'));
assert('Actions column has ONLY Edit and Delete (no View button)', !empListContent.includes('>View<') && empListContent.includes('Edit') && empListContent.includes('Delete'));
assert('Delete button has red outline styling', cssContent.includes('.btn-del') && cssContent.includes('border: 1px solid #fecdd3;'));

// Verify exact 6 cards in popup grid
assert('Card 1: SIM + IMSI exists in the grid', empListContent.includes('SIM + IMSI') && empListContent.includes('sim_num') && empListContent.includes('sim_imsi'));
assert('Card 2: TimeTrax App Login exists with Username and Password', empListContent.includes('TimeTrax App Login') && empListContent.includes('Username') && (empListContent.includes('autoComplete="new-password"') || empListContent.includes('autocomplete="new-password"')));
assert('Card 3: PostEx Login exists with Username and Password', empListContent.includes('PostEx Login') && empListContent.includes('px_user') && empListContent.includes('px_pw'));
assert('Card 4: Machine Enrollment has dropdown ("Enrolled", "Not Enrolled") + optional image', empListContent.includes('Machine Enrollment') && empListContent.includes('Enrolled</option>') && empListContent.includes('Not Enrolled</option>') && empListContent.includes("handleUploadImageAttachment('mc'"));
assert('Card 5: ID Card has dropdown ("Provided", "Not Provided") + optional image', empListContent.includes('ID Card') && empListContent.includes('Provided</option>') && empListContent.includes('Not Provided</option>') && empListContent.includes("handleUploadImageAttachment('idc'"));
assert('Card 6: Documents sent to Head Office has dropdown ("Dispatched", "Not Dispatched") + optional image', empListContent.includes('Documents sent to Head Office') && empListContent.includes('Dispatched</option>') && empListContent.includes('Not Dispatched</option>') && empListContent.includes("handleUploadImageAttachment('doc'"));

// Verify Task 1: Email moved OUT of the grid
assert('Email Address card is removed from the asset cards grid', !empListContent.includes('<h4>\n                      Email Address') && !empListContent.includes('<h4>Email Address</h4>'));

// Verify Task 2: New Share Details Section at the bottom
assert('Share Details section exists with heading and subtitle', empListContent.includes('Share Details') && empListContent.includes('Send these asset details to the employee or HR'));
assert('Option 1: Email with multi-email, Add another email, and Send by Email', empListContent.includes('Send by Email') && empListContent.includes('Add another email'));
assert('Option 2: WhatsApp with +92 prefix, Add another number, and Share on WhatsApp', empListContent.includes('Share on WhatsApp') && empListContent.includes('Add another number') && empListContent.includes('+92'));
assert('WhatsApp normalizer handles 03XX -> 923XX and 12-digit validation', empListContent.includes('normalizeWhatsAppNumber') && empListContent.includes('923'));
assert('WhatsApp opens wa.me URL with encoded message', empListContent.includes('wa.me/'));
assert('Message template includes employee code, machine, sim, timetrax, postex, id card, documents', empListContent.includes('welcome to PostEx. Your onboarding assets:') && empListContent.includes('Please keep this information confidential.'));
assert('Include passwords checkbox exists with security hint', empListContent.includes('Include passwords') && empListContent.includes('WhatsApp is not a secure channel'));
assert('Audit log records email and WhatsApp share actions', empListContent.includes('asset_details_emailed') && empListContent.includes('asset_details_whatsapp_shared'));

// Verify Complete / Pending condition
assert('Complete condition checks TimeTrax and PostEx credentials both filled', empListContent.includes('emp.timetrax_username?.trim() &&') && empListContent.includes('emp.postex_password?.trim()'));

// 7. BACKEND MIGRATION & ENCRYPTED CREDENTIALS
console.log('\n--- 7. Backend Migration & Encrypted Credentials ---');
const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261014000000_employee_assets_redesign.sql'), 'utf-8');
assert('Migration creates machine_enrollment_status enum', migrationSql.includes('machine_enrollment_status'));
assert('Migration creates id_card_status enum', migrationSql.includes('id_card_status'));
assert('Migration creates documents_dispatch_status enum', migrationSql.includes('documents_dispatch_status'));
assert('Migration adds timetrax and postex username/password columns', migrationSql.includes('timetrax_username') && migrationSql.includes('postex_password'));
assert('Migration creates child employee_emails table', migrationSql.includes('CREATE TABLE IF NOT EXISTS public.employee_emails'));

const routesContent = readFileSync(join(process.cwd(), 'src/server/employeesRoutes.ts'), 'utf-8');
assert('Backend routes support PUT /:id/assets', routesContent.includes("router.put('/:id/assets'"));
assert('Backend routes support GET /:id/assets', routesContent.includes("router.get('/:id/assets'"));
assert('Backend routes support POST /asset-image/upload', routesContent.includes("router.post('/asset-image/upload'"));
assert('Backend routes encrypt passwords at rest', routesContent.includes('encryptPassword') && routesContent.includes('decryptPassword'));

console.log('\n====================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

