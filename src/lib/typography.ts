/**
 * Shared Typography Utility Classes (Single Source of Truth)
 * Defined in src/index.css under @layer components:
 * - .text-page-title   -> 24px, font-weight 700, letter-spacing -0.3px
 * - .text-kpi-number   -> 30px, font-weight 700, letter-spacing -0.3px
 * - .text-card-heading -> 16px, font-weight 700
 * - .text-body         -> 14px, font-weight 400, line-height 1.5
 * - .text-table-header -> 12px, font-weight 600
 * - .text-caption      -> 13px, font-weight 400
 * - .text-tag          -> 12px, font-weight 700
 */
export const TYPOGRAPHY = {
  pageTitle: 'text-page-title',
  kpiNumber: 'text-kpi-number',
  cardHeading: 'text-card-heading',
  body: 'text-body',
  tableHeader: 'text-table-header',
  caption: 'text-caption',
  tag: 'text-tag',
} as const;

export type TypographyToken = keyof typeof TYPOGRAPHY;
