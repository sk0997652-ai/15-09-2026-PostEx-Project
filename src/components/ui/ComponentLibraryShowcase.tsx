import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Card,
  Badge,
  StatusBadge,
  ApplicationStatus,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  PageHeader,
  Modal,
  TableToolbar,
} from './index';

export const ComponentLibraryShowcase: React.FC = () => {
  // Interactive state for Demo
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<'small' | 'default' | 'large'>('default');
  const [btnLoading, setBtnLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('lahore');
  const [checkbox1, setCheckbox1] = useState(true);
  const [checkbox2, setCheckbox2] = useState(false);
  const [toolbarSearch, setToolbarSearch] = useState('');
  const [toolbarStatus, setToolbarStatus] = useState('all');
  const [toolbarZone, setToolbarZone] = useState('all');

  // Sample Table Data for pagination demo
  const sampleCandidates = [
    { id: 'CAND-101', name: 'Muhammad Ali', cnic: '35201-*****12-1', role: 'Operations Officer', status: 'approved' as ApplicationStatus, branch: 'Lahore Main' },
    { id: 'CAND-102', name: 'Fatima Noor', cnic: '42101-*****45-2', role: 'Courier Associate', status: 'hr_review' as ApplicationStatus, branch: 'Karachi South' },
    { id: 'CAND-103', name: 'Zain Ahmed', cnic: '61101-*****78-3', role: 'Fleet Supervisor', status: 'bm_verification' as ApplicationStatus, branch: 'Islamabad Hub' },
    { id: 'CAND-104', name: 'Ayesha Khan', cnic: '37405-*****90-4', role: 'Warehouse Lead', status: 'needs_correction' as ApplicationStatus, branch: 'Rawalpindi' },
    { id: 'CAND-105', name: 'Bilal Tariq', cnic: '33100-*****23-5', role: 'Rider', status: 'submitted' as ApplicationStatus, branch: 'Faisalabad' },
    { id: 'CAND-106', name: 'Usman Ghani', cnic: '17301-*****56-1', role: 'Sorter', status: 'draft' as ApplicationStatus, branch: 'Peshawar' },
    { id: 'CAND-107', name: 'Hamza Sheikh', cnic: '35202-*****89-7', role: 'Dispatcher', status: 'rejected' as ApplicationStatus, branch: 'Lahore Hub' },
    { id: 'CAND-108', name: 'Maryam Bibi', cnic: '42201-*****34-2', role: 'Customer Rep', status: 'approved' as ApplicationStatus, branch: 'Karachi Central' },
  ];

  const totalPages = Math.ceil(sampleCandidates.length / pageSize);
  const paginatedData = sampleCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* 1. Page Header Component Demo */}
      <PageHeader
        title="Shared UI Component Library"
        description="Design Spec v1 Compact Design System: All shared UI components in every variant for live visual inspection."
        roleContext="Design Spec v1 Preview"
        breadcrumbs={[
          { label: 'Platform Architecture' },
          { label: 'Design System' },
          { label: 'Components' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={() => alert('Design token guide: Indigo 600, Slate 50-900, Emerald/Amber/Rose/Slate.')}
            >
              Export Tokens
            </Button>
            <Button
              variant="primary"
              size="small"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => setModalOpen(true)}
            >
              Open Modal
            </Button>
          </div>
        }
      />

      {/* 2. Color & Typography Tokens Verification Card */}
      <Card
        title="1. Design Tokens & Typography Scale (Design Spec v1)"
        description="Inter 400/500/600/700. Desktop: Title 16px/700, KPI 20px/700, Card Heading 12px/700, Body 11px/400, Caption 10px/400, Table Header 10px/600, Tag 9.5px/700."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Primary Tokens */}
          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-table-header text-slate-500">Primary Tokens</span>
            <div className="space-y-1 text-caption">
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-indigo-600 text-white font-medium">
                <span>Indigo 600 (#4f46e5)</span>
                <span className="opacity-80 text-tag">primary</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-indigo-700 text-white font-medium">
                <span>Indigo 700 (#4338ca)</span>
                <span className="opacity-80 text-tag">hover</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                <span>Indigo 50 (#eef2ff)</span>
                <span className="opacity-80 text-tag">subtle</span>
              </div>
            </div>
          </div>

          {/* Neutral Tokens */}
          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-table-header text-slate-500">Neutral Tokens</span>
            <div className="space-y-1 text-caption">
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-white text-slate-900 border border-slate-200 font-medium">
                <span>White (#ffffff)</span>
                <span className="text-slate-500 text-tag">surface</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-slate-50 text-slate-900 border border-slate-200 font-medium">
                <span>Slate 50 (#f8fafc)</span>
                <span className="text-slate-500 text-tag">bg</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-slate-200 text-slate-900 font-medium">
                <span>Slate 200 (#e2e8f0)</span>
                <span className="text-slate-500 text-tag">border</span>
              </div>
            </div>
          </div>

          {/* Text Tokens */}
          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-table-header text-slate-500">Typography Scale</span>
            <div className="space-y-1 text-caption">
              <p className="text-page-title text-slate-900 leading-tight">Title (16px / 700)</p>
              <p className="text-kpi-number text-slate-900 leading-tight">KPI (20px / 700)</p>
              <p className="text-card-heading text-slate-900">Card Heading (12px / 700)</p>
              <p className="text-body text-slate-900">Body (11px / 400)</p>
              <p className="text-caption text-slate-500">Caption (10px / 400)</p>
              <p className="text-table-header text-slate-700">Table Header (10px / 600)</p>
              <p className="text-tag text-slate-500">Tag / Badge (9.5px / 700)</p>
            </div>
          </div>

          {/* Semantic Status Tokens */}
          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-table-header text-slate-500">Semantic Colors</span>
            <div className="space-y-1 text-caption">
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <span>Emerald 600</span>
                <span className="text-tag">success</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                <span>Amber 600</span>
                <span className="text-tag">warning</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                <span>Rose 600</span>
                <span className="text-tag">error</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-[4px] bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <span>Slate 400</span>
                <span className="text-tag">info</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Button Component Showcase */}
      <Card
        title="2. Button Component (Button.tsx)"
        description="All variants: primary, secondary, danger, ghost, link. Sizes: default (28px high), small/sm (24px high), mobile min-height 40px. Semi-bold, radius 6px, icon 14px."
      >
        <div className="space-y-4 pt-1">
          {/* Default Size (28px) */}
          <div>
            <span className="text-table-header text-slate-500 block mb-2">
              Default Size (28px high, text-body semibold, radius 6px)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link Button</Button>
              <Button variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                With Left Icon
              </Button>
              <Button variant="secondary" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                With Right Icon
              </Button>
              <Button
                variant="primary"
                isLoading={btnLoading}
                onClick={() => {
                  setBtnLoading(true);
                  setTimeout(() => setBtnLoading(false), 1500);
                }}
              >
                {btnLoading ? 'Processing...' : 'Click for Loading'}
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Small Size (24px) */}
          <div>
            <span className="text-table-header text-slate-500 block mb-2">
              Small Size (24px high, text-body semibold, radius 6px)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="small">
                Small Primary
              </Button>
              <Button variant="secondary" size="small">
                Small Secondary
              </Button>
              <Button variant="danger" size="small" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                Small Danger
              </Button>
              <Button variant="ghost" size="small">
                Small Ghost
              </Button>
              <Button variant="secondary" size="small" disabled>
                Small Disabled
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Form Controls Component Showcase */}
      <Card
        title="3. Form Controls (Input.tsx, Select.tsx, Textarea.tsx, Checkbox.tsx)"
        description="Height 28px (textarea padding 6x10), body token (16px on mobile to prevent iOS zoom), radius 6px, 1px border-slate-300, 14px checkbox."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Input Variants */}
          <div className="space-y-3">
            <span className="text-table-header text-slate-500 block">
              Input Component
            </span>
            <Input
              label="Standard Input"
              placeholder="candidate@postex.pk"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              hint="Corporate or official email."
            />
            <Input
              label="With Icon"
              placeholder="Search CNIC..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
            <Input
              label="Validation Error"
              defaultValue="invalid@"
              error="Invalid email format."
            />
            <Input
              label="Disabled Input"
              defaultValue="Read-only system value"
              disabled
            />
          </div>

          {/* Select Component */}
          <div className="space-y-3">
            <span className="text-table-header text-slate-500 block">
              Select Component
            </span>
            <Select
              label="Branch Hub"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              hint="Select physical operational hub."
              options={[
                { value: 'lahore', label: 'Lahore Gulberg Hub (Central)' },
                { value: 'karachi', label: 'Karachi South Hub (South)' },
                { value: 'islamabad', label: 'Islamabad I-9 Express (North)' },
              ]}
            />
            <Select
              label="Searchable Select"
              searchable
              options={[
                { value: '', label: '-- Select Role --' },
                { value: 'bm', label: 'BM | Branch Manager' },
                { value: 'zonal', label: 'ZONAL | Zonal HR Manager' },
                { value: 'central', label: 'CENTRAL | Central HR' },
              ]}
            />
            <Select
              label="Role (With Error)"
              error="Role is required."
              options={[
                { value: '', label: '-- Select Role --' },
                { value: 'bm', label: 'Branch Manager' },
              ]}
            />
            <Select
              label="Disabled Select"
              disabled
              options={[{ value: 'locked', label: 'Read-only Selection' }]}
            />
          </div>

          {/* Textarea Component */}
          <div className="space-y-3">
            <span className="text-table-header text-slate-500 block">
              Textarea Component
            </span>
            <Textarea
              label="Audit Justification"
              placeholder="Business justification..."
              rows={2}
              hint="Logged in audit compliance ledger."
            />
            <Textarea
              label="Correction Notes (Error)"
              rows={2}
              error="At least 10 characters required."
              defaultValue="Short"
            />
            <Textarea
              label="Disabled Textarea"
              rows={2}
              defaultValue="Locked comment"
              disabled
            />
          </div>

          {/* Checkbox Component */}
          <div className="space-y-3">
            <span className="text-table-header text-slate-500 block">
              Checkbox Component
            </span>
            <Checkbox
              id="chk-standard"
              label="Enable Notifications"
              description="Send real-time onboarding alerts."
              checked={checkbox1}
              onChange={(e) => setCheckbox1(e.target.checked)}
            />
            <Checkbox
              id="chk-second"
              label="Require Document Verification"
              description="Branch Manager physical sign-off."
              checked={checkbox2}
              onChange={(e) => setCheckbox2(e.target.checked)}
            />
            <Checkbox
              id="chk-disabled"
              label="Enforce 2FA (Mandatory)"
              description="System enforced for all admins."
              checked={true}
              disabled
            />
            <Checkbox
              id="chk-error"
              label="Agree to Terms & Conditions"
              error="You must agree before continuing."
              checked={false}
              onChange={() => {}}
            />
          </div>
        </div>
      </Card>

      {/* 5. Badge & StatusBadge Component Showcase */}
      <Card
        title="4. Badges & Application Status Mappings (Badge.tsx, StatusBadge.tsx)"
        description="Tag token (9.5px), padding 2px 8px (px-2 py-0.5), fully rounded. All 7 application statuses mapped to semantic colors."
      >
        <div className="space-y-4 pt-1">
          {/* Base Badges */}
          <div>
            <span className="text-table-header text-slate-500 block mb-2">
              Base Badge Variants (with & without status dot)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" dot>Primary / Indigo</Badge>
              <Badge variant="sky" dot>Sky / Light Blue</Badge>
              <Badge variant="success" dot>Success / Emerald</Badge>
              <Badge variant="warning" dot>Warning / Amber</Badge>
              <Badge variant="error" dot>Error / Rose</Badge>
              <Badge variant="info" dot>Info / Slate</Badge>
              <Badge variant="primary">No Dot</Badge>
              <Badge variant="success">Active</Badge>
              <Badge variant="warning">In Review</Badge>
              <Badge variant="error">Terminated</Badge>
              <Badge variant="info">Archived</Badge>
            </div>
          </div>

          {/* Single Source of Truth StatusBadge */}
          <div>
            <span className="text-table-header text-slate-500 block mb-2">
              Application StatusBadge (Single Source of Truth)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {(
                [
                  'draft',
                  'submitted',
                  'bm_verification',
                  'needs_correction',
                  'hr_review',
                  'approved',
                  'rejected',
                ] as ApplicationStatus[]
              ).map((statusKey) => (
                <div
                  key={statusKey}
                  className="p-2 rounded-[6px] bg-slate-50 border border-slate-200 flex flex-col items-center gap-1.5 text-center"
                >
                  <StatusBadge status={statusKey} />
                  <span className="text-tag font-mono text-slate-400 font-medium">{statusKey}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 6. TableToolbar Component Showcase */}
      <Card
        title="5. TableToolbar Component (TableToolbar.tsx)"
        description="28px control height, 6px radius, border-slate-300, 2px 8px status pills with tag token."
      >
        <div className="pt-1">
          <TableToolbar
            searchValue={toolbarSearch}
            onSearchChange={setToolbarSearch}
            searchPlaceholder="Search candidates..."
            filters={[
              {
                id: 'zone-filter',
                label: 'Zone',
                value: toolbarZone,
                onChange: setToolbarZone,
                options: [
                  { value: 'all', label: 'All Zones' },
                  { value: 'central', label: 'Central Zone' },
                  { value: 'south', label: 'South Zone' },
                  { value: 'north', label: 'North Zone' },
                ],
              },
            ]}
            statusPills={[
              { value: 'all', label: 'All', count: 8 },
              { value: 'approved', label: 'Approved', variant: 'success', count: 2 },
              { value: 'hr_review', label: 'HR Review', variant: 'warning', count: 1 },
              { value: 'bm_verification', label: 'BM Verification', variant: 'warning', count: 1 },
              { value: 'rejected', label: 'Rejected', variant: 'error', count: 1 },
            ]}
            activeStatus={toolbarStatus}
            onStatusChange={setToolbarStatus}
            hasActiveFilters={Boolean(toolbarSearch || toolbarZone !== 'all' || toolbarStatus !== 'all')}
            onReset={() => {
              setToolbarSearch('');
              setToolbarZone('all');
              setToolbarStatus('all');
            }}
          />
        </div>
      </Card>

      {/* 7. Table & TablePagination Component Showcase */}
      <Card
        title="6. Table & Built-in Pagination Component (Table.tsx)"
        description="Standardized table layout with header, body, row, cell, and integrated pagination footer."
        action={
          <div className="flex items-center gap-2">
            <span className="text-caption text-slate-500">Live Pagination Demo:</span>
            <Badge variant="primary">Page {currentPage} of {totalPages}</Badge>
          </div>
        }
      >
        <div className="pt-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Masked CNIC</TableHead>
                <TableHead>Applied Role</TableHead>
                <TableHead>Branch Hub</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((cand) => (
                <TableRow key={cand.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-tag">
                        {cand.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-body">{cand.name}</div>
                        <div className="text-caption text-slate-500 font-mono">{cand.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-caption text-slate-700">{cand.cnic}</span>
                  </TableCell>
                  <TableCell>{cand.role}</TableCell>
                  <TableCell>{cand.branch}</TableCell>
                  <TableCell>
                    <StatusBadge status={cand.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="small">
                      View Dossier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Standardized Table Pagination */}
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            total={sampleCandidates.length}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={pageSize}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            pageSizeOptions={[3, 5, 10]}
          />
        </div>
      </Card>

      {/* 8. Modal Component Demo Card */}
      <Card
        title="7. Base Modal Component (Modal.tsx)"
        description="Radius 8px, padding 16px, title = card-heading token, body = body token, size variants keep max-widths."
        action={
          <Button
            variant="primary"
            size="small"
            onClick={() => setModalOpen(true)}
          >
            Open Interactive Modal
          </Button>
        }
      >
        <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-body text-slate-600">
            Click to test modal sizes with header, body slots, and standardized action footer.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setModalSize('small');
                setModalOpen(true);
              }}
            >
              Small (max-w-md)
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setModalSize('default');
                setModalOpen(true);
              }}
            >
              Default (max-w-lg)
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setModalSize('large');
                setModalOpen(true);
              }}
            >
              Large (max-w-3xl)
            </Button>
          </div>
        </div>
      </Card>

      {/* The Actual Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Base Modal Component Verification"
        description="Design Spec v1: Radius 8px, padding 16px, title card-heading token."
        size={modalSize}
        footer={
          <>
            <Button variant="secondary" size="small" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => {
                alert('Modal action confirmed!');
                setModalOpen(false);
              }}
            >
              Confirm Action
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-body text-slate-600">
          <p>
            This base modal serves as the foundation across the entire portal (e.g. DeleteConfirmationModal, Applicant Dossier modals, etc.).
          </p>
          <div className="p-3 rounded-[6px] bg-indigo-50 border border-indigo-100 text-indigo-900 text-caption">
            <span className="font-bold">Design Token Check:</span> Header titles follow card-heading scale (12px), body is padded to 16px (p-4), and footer buttons use compact Button tokens.
          </div>
          <Input
            label="Sample Modal Field"
            placeholder="Type inside modal to verify input rendering..."
          />
        </div>
      </Modal>
    </div>
  );
};
