# PostEx Design System (DESIGN SPEC v1)

## 1. Overview & Architecture

The PostEx application uses **DESIGN SPEC v1**, a unified compact token system implemented in pure Tailwind CSS with CSS custom properties.

Typography and component scales are driven by root CSS custom variables in `src/index.css`, with automatic scaling for:
1. **Staff Desktop & Tablet (`>= 640px`)**
2. **Staff Mobile (`< 640px`)**
3. **Candidate Portal Desktop (`html[data-portal="candidate"]`)**
4. **Candidate Portal Mobile (`html[data-portal="candidate"]` on `< 640px`)**

---

## 2. Token Scales Table

| Token Class | Role / Purpose | Staff Desktop (`>=640px`) | Staff Mobile (`<640px`) | Candidate Desktop | Candidate Mobile | Line Height |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `text-page-title` | Top-level view header | **16px** (bold) | **18px** (bold) | **18px** (bold) | **18px** (bold) | 1.3 |
| `text-kpi-number` | Hero KPI count/metric | **20px** (bold) | **22px** (bold) | **22px** (bold) | **22px** (bold) | 1.2 |
| `text-card-heading`| Card title, section heading | **12px** (bold) | **14px** (bold) | **13px** (bold) | **14px** (bold) | 1.4 |
| `text-body` | Table cell, paragraph, input | **11px** (regular) | **13px** (regular) | **12px** (regular) | **13px** (regular) | 1.5 |
| `text-caption` | Timestamp, subtitle, hint | **10px** (regular) | **12px** (regular) | **11px** (regular) | **12px** (regular) | 1.4 |
| `text-table-header`| Column header in table | **10px** (semibold)| **11px** (semibold)| **11px** (semibold)| **11px** (semibold)| 1.4 |
| `text-tag` | Status badge, pill, chip | **9.5px** (bold) | **11px** (bold) | **10.5px** (bold) | **11px** (bold) | 1.3 |
| `text-micro` | Small metadata label (no weight)| **9.5px** | **11px** | **10.5px** | **11px** | 1.3 |
| `text-field` | Form inputs (zoom prevention) | **11px** | **16px** | **12px** | **16px** | 1.5 |

---

## 3. Component Dimensions & Sizing

### Buttons (`src/components/ui/Button.tsx`)
- **Desktop default**: `h-7 sm:h-7 px-3 py-1 text-body font-semibold rounded-[6px]` (28px height).
- **Desktop small (`sm`)**: `h-6 sm:h-6 px-2.5 py-0.5 text-body font-semibold rounded-[6px]` (24px height).
- **Desktop large (`lg`)**: `h-8 sm:h-8 px-4 py-1.5 text-body font-semibold rounded-[6px]` (32px height).
- **Mobile (`< 640px`)**: `min-h-[40px] sm:min-h-0` on all buttons to enforce accessible touch targets.

### Inputs & Selects (`src/components/ui/Input.tsx`, `Select.tsx`, `Textarea.tsx`)
- **Desktop default**: `h-7 sm:h-7 px-2.5 py-1 text-field rounded-[6px] border border-slate-300` (28px height).
- **Mobile (`< 640px`)**: `min-h-[40px] sm:min-h-0 text-field` (renders 16px on mobile to prevent iOS Safari auto-zoom).
- **Icons**: Left/right icons sized at `w-3.5 h-3.5` inside inputs.

### Cards (`src/components/ui/Card.tsx`, `KpiCard.tsx`)
- **Card**: `bg-white border border-slate-200/80 rounded-2xl shadow-xs`.
- **Card Padding**: Standard `p-4` (or `p-6` for settings).
- **KPI Grid**: Uses `<KpiGrid columns={4}>` and `<KpiCard label="..." value={...} tone="indigo" />`.

### Tables (`src/components/ui/Table.tsx`)
- **Header**: Height `28px` (`h-7`), uppercase or semibold `text-table-header text-slate-500 bg-slate-50`.
- **Row**: Height `32px` (`h-8`), hover highlight `hover:bg-slate-50/80 transition-colors`.
- **Cells**: Padding `px-2.5 py-1.5 text-body text-slate-800`.
- **Responsive Stacking**: Supports `mobileRole="primary"`, `mobileRole="field"`, `mobileRole="status"`, `hideOnTablet`.

### Modals (`src/components/ui/Modal.tsx`)
- **Backdrop**: `fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50`.
- **Card**: `rounded-2xl shadow-xl border border-slate-200 bg-white p-6`.
- **Sizes**: `small` (`max-w-md`), `default` (`max-w-lg`), `large` (`max-w-3xl`), `xl` (`max-w-4xl`).

### Sidebars (`src/components/ui/PortalSidebar.tsx`)
- **Desktop (`>= 1024px`)**: `w-48` (**192px** width).
- **Tablet (`640px - 1023px`)**: `w-14` (**56px** icon rail with tooltip titles).
- **Mobile Drawer (`< 640px`)**: `w-56` (**224px** slide-over drawer with backdrop).
- **Item padding**: `px-2.5 py-2` (8x10px), icons `14px` (`w-3.5 h-3.5`), text token `text-body`.
- **Active state**: `bg-indigo-600 text-white font-semibold shadow-xs`.

---

## 4. Layout Rules & Container Discipline

- **Page Padding**: Always wrapped in `<PageContainer>` (`p-4` / 16px).
- **Data Screens**: Must NOT be capped by arbitrary `max-w-*` wrappers (`width="full"` is default).
- **Centered Form Screens**: Use `<PageContainer width="form">` (`max-w-3xl mx-auto`).
- **Tabular Numbers**: Numbers, dates, and currency use `tabular-nums` (applied globally to `body`).

---

## 5. The Urdu & RTL Rule

Nastaliq typography has tall ascenders/descenders and requires distinct rendering parameters.
The rule is declared **outside any `@layer`** in `src/index.css` to prevent Tailwind utility class overrides:

```css
.font-urdu:not([dir="ltr"], [dir="ltr"] *),
:is([lang="ur"], [dir="rtl"]) :is(p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6, small, legend, button, input, select, textarea):not([dir="ltr"], [dir="ltr"] *),
:is([lang="ur"], [dir="rtl"]):is(p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6, small, legend, button, input, select, textarea):not([dir="ltr"], [dir="ltr"] *) {
  font-family: var(--font-family-urdu);
  font-size: 16px;
}

/* Text-flow elements: line-height: 2 for Nastaliq rendering */
:is([lang="ur"], [dir="rtl"]) :is(p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6, small, legend):not([dir="ltr"], [dir="ltr"] *),
:is([lang="ur"], [dir="rtl"]):is(p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6, small, legend):not([dir="ltr"], [dir="ltr"] *),
.font-urdu:is(p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6, small, legend):not([dir="ltr"], [dir="ltr"] *) {
  line-height: 2;
}

/* Form inputs & buttons: line-height: normal to maintain control height and vertical centering */
:is([lang="ur"], [dir="rtl"]) :is(button, input, select, textarea):not([dir="ltr"], [dir="ltr"] *),
:is([lang="ur"], [dir="rtl"]):is(button, input, select, textarea):not([dir="ltr"], [dir="ltr"] *),
.font-urdu:is(button, input, select, textarea):not([dir="ltr"], [dir="ltr"] *) {
  line-height: normal;
}
```

- **Protection**: English identifiers, code blocks, or language toggles wrapped in `dir="ltr"` are protected from Urdu overrides.

---

## 6. How to Add a New Screen Correctly

1. **Layout**:
   ```tsx
   import { PageContainer, PageHeader, Card, Button, Input, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, KpiGrid, KpiCard } from '../ui';

   export const MyNewScreen = () => {
     return (
       <PageContainer>
         <PageHeader
           title="My Feature Title"
           description="Operational description of the view."
           roleContext="Management Module"
           action={<Button variant="primary">Add Item</Button>}
         />
         ...
       </PageContainer>
     );
   };
   ```
2. **Typography Rules**:
   - Use `text-page-title` for view headers.
   - Use `text-card-heading` for section & card headings.
   - Use `text-body` for tables, text paragraphs, and regular content.
   - Use `text-caption` for hints, subtext, and timestamps.
   - Use `text-tag` for badges, chips, and pills.
   - Use `text-kpi-number` for big numeric metrics.
   - Never use arbitrary `text-[12px]` or raw `text-xs`/`text-sm`.
3. **Identifiers vs Numbers**:
   - `font-mono` is permitted **only** for identifiers (CNIC, Joining ID, Employee Code, UUIDs, tokens, storage paths).
   - Counts, dates, percentages, and currencies must use standard font (`tabular-nums` is automatically enabled).

---

## 7. What the Guard Script (`npm run check:type`) Enforces

The guard script `scripts/check-typography.mjs` scans all TypeScript files (`src/**/*.ts`, `src/**/*.tsx`) and fails the build with a non-zero exit code if:
- Any arbitrary font size utility is found (`text-[10.5px]`, `text-[0.7rem]`, etc.).
- Any inline style `fontSize` or `fontFamily` is detected.
- Any forbidden font string (e.g. `"Plus Jakarta Sans"`) is found anywhere in `src` or `index.html`.
- Any hardcoded `font-family` CSS declaration is added in source code.

It generates warning metrics and folder counts for raw sizes, `font-sans`, `font-mono`, and uppercase tracking.

---

## 8. How to Scale the Entire Portal from `src/index.css`

To scale the entire application up or down:
- Open `src/index.css`.
- Under `:root`, adjust the font tokens (`--font-body`, `--font-page-title`, etc.) or control heights (`--control-height`).
- Under `html[data-portal="candidate"]`, adjust candidate-specific base scale.
- Tailwind automatically propagates these CSS custom property changes across all components without needing manual class adjustments.
