import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  Mail,
  User,
  Building,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Select,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* 1. Page Header Component Demo */}
      <PageHeader
        title="Shared UI Component Library"
        description="Design Step 1 of 5: Centralized tokens, typography scale, spacing standards, and reusable pure components."
        roleContext="Design System Preview"
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
              Test Base Modal
            </Button>
          </div>
        }
      />

      {/* 2. Color & Typography Tokens Verification Card */}
      <Card
        title="1. Design Tokens & Constraints Spec"
        description="Strict compliance: Indigo primary, Slate neutrals, Emerald/Amber/Rose/Slate semantics only. No blue, teal, or purple."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Primary Tokens */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Primary Tokens</span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-600 text-white font-medium">
                <span>Indigo 600 (#4f46e5)</span>
                <span className="opacity-80 text-[10px]">primary</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-700 text-white font-medium">
                <span>Indigo 700 (#4338ca)</span>
                <span className="opacity-80 text-[10px]">hover</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                <span>Indigo 50 (#eef2ff)</span>
                <span className="opacity-80 text-[10px]">subtle</span>
              </div>
            </div>
          </div>

          {/* Neutral Tokens */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Neutral Tokens</span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white text-slate-900 border border-slate-200 font-medium">
                <span>White (#ffffff)</span>
                <span className="text-slate-500 text-[10px]">surface</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 font-medium">
                <span>Slate 50 (#f8fafc)</span>
                <span className="text-slate-500 text-[10px]">bg</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-200 text-slate-900 font-medium">
                <span>Slate 200 (#e2e8f0)</span>
                <span className="text-slate-500 text-[10px]">border</span>
              </div>
            </div>
          </div>

          {/* Text Tokens */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Typography Scale</span>
            <div className="space-y-1 text-xs">
              <p className="text-2xl font-bold text-slate-900 leading-none">Title (2xl font-bold)</p>
              <p className="text-lg font-semibold text-slate-900">Heading (lg font-semibold)</p>
              <p className="text-base font-semibold text-slate-900">Card Title (base font-semibold)</p>
              <p className="text-sm font-normal text-slate-900">Body (sm font-normal)</p>
              <p className="text-sm font-medium text-slate-900">Label (sm font-medium)</p>
              <p className="text-xs font-medium text-slate-500">Caption/Badge (xs font-medium)</p>
            </div>
          </div>

          {/* Semantic Status Tokens */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semantic Colors</span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <span>Emerald 600</span>
                <span className="text-[10px]">success</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                <span>Amber 600</span>
                <span className="text-[10px]">warning</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                <span>Rose 600</span>
                <span className="text-[10px]">error</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <span>Slate 400</span>
                <span className="text-[10px]">info</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Button Component Showcase */}
      <Card
        title="2. Button Component (Button.tsx)"
        description="Variants: primary, secondary, danger. Sizes: default (h-10), small (h-8). Spacing: rounded-lg, px-4 py-2.5."
      >
        <div className="space-y-6 pt-2">
          {/* Default Size */}
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Default Size (h-10, px-4 py-2.5)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="danger">Danger Button</Button>
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                With Left Icon
              </Button>
              <Button variant="secondary" rightIcon={<ExternalLink className="w-4 h-4" />}>
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
                {btnLoading ? 'Processing...' : 'Click for Loading State'}
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Small Size */}
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Small Size (h-8, px-3 py-1.5)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="small">
                Small Primary
              </Button>
              <Button variant="secondary" size="small">
                Small Secondary
              </Button>
              <Button variant="danger" size="small" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                Delete Item
              </Button>
              <Button variant="secondary" size="small" disabled>
                Small Disabled
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Form Inputs Component Showcase */}
      <Card
        title="3. Form Controls (Input.tsx, Textarea.tsx, Select.tsx)"
        description="One consistent size: rounded-lg, px-4 py-2.5, h-10, primary focus-ring styling (#4f46e5)."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Input Variants */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Input Component
            </span>
            <Input
              label="Standard Input"
              placeholder="e.g. candidate@postex.pk"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              hint="Enter your corporate or official email."
            />
            <Input
              label="With Icon"
              placeholder="Search by CNIC or Name..."
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Input
              label="Validation Error State"
              defaultValue="invalid_email@"
              error="Please enter a valid format."
            />
            <Input
              label="Disabled Input"
              defaultValue="Locked system value"
              disabled
            />
          </div>

          {/* Select Component */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Select Component
            </span>
            <Select
              label="Branch Assignment"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              hint="Select the physical operational hub."
              options={[
                { value: 'lahore', label: 'Lahore Gulberg Hub (Central)' },
                { value: 'karachi', label: 'Karachi South Hub (South)' },
                { value: 'islamabad', label: 'Islamabad I-9 Express (North)' },
              ]}
            />
            <Select
              label="Role Selector (With Error)"
              error="Role assignment is required."
              options={[
                { value: '', label: '-- Select Role --' },
                { value: 'bm', label: 'Branch Manager' },
                { value: 'zonal', label: 'Zonal HR' },
              ]}
            />
            <Select
              label="Disabled Select"
              disabled
              options={[{ value: 'locked', label: 'Read-only Organization' }]}
            />
          </div>

          {/* Textarea Component */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Textarea Component
            </span>
            <Textarea
              label="Audit Justification"
              placeholder="Provide business justification for audit trail..."
              rows={3}
              hint="Logged with your staff identity in the compliance ledger."
            />
            <Textarea
              label="Correction Notes (Error State)"
              rows={2}
              error="Must provide at least 10 characters explaining corrections."
              defaultValue="Short"
            />
          </div>
        </div>
      </Card>

      {/* 5. Badge & StatusBadge Component Showcase */}
      <Card
        title="4. Badges & Application Status Mappings (Badge.tsx, StatusBadge.tsx)"
        description="StatusBadge maps application statuses (draft, submitted, bm_verification, needs_correction, hr_review, approved, rejected) to exactly ONE semantic color each."
      >
        <div className="space-y-6 pt-2">
          {/* Base Badges */}
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Base Badge Variants (with & without status dot)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="primary" dot>Primary / Indigo</Badge>
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
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Application StatusBadge (Single Source of Truth)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
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
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center gap-2 text-center"
                >
                  <StatusBadge status={statusKey} />
                  <span className="text-[11px] font-mono text-slate-400 font-medium">{statusKey}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 6. Table & TablePagination Component Showcase */}
      <Card
        title="5. Table & Built-in Pagination Component (Table.tsx)"
        description="Standardized table layout with header, body, row, cell, and integrated pagination footer."
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Live Pagination Demo:</span>
            <Badge variant="primary">Page {currentPage} of {totalPages}</Badge>
          </div>
        }
      >
        <div className="pt-2">
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
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {cand.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{cand.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{cand.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-700">{cand.cnic}</span>
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

      {/* 7. Modal Component Demo Card */}
      <Card
        title="6. Base Modal Component (Modal.tsx)"
        description="Elevation: shadow-xl (modal only). Rounded-2xl container, backdrop-blur-xs, accessible keyboard escape and backdrop click."
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
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Click the button to test the base Modal dialog with header, body slots, and standardized action footer.
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
              Large (max-w-2xl)
            </Button>
          </div>
        </div>
      </Card>

      {/* The Actual Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Base Modal Component Verification"
        description="Built using shadow-xl elevation, rounded-2xl container, and slate tokens."
        size={modalSize}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
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
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            This base modal is ready to serve as the foundation for future specialized modals
            (such as refactoring DeleteConfirmationModal, Applicant Dossier modals, etc.).
          </p>
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
            <span className="font-bold">Design Token Check:</span> All header titles follow section heading scale (text-lg font-semibold), card body is padded to p-6, and footer buttons use the standardized Button component.
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
