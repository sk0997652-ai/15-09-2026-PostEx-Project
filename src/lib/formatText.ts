export const toTitleCase = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Shared helper for DROPDOWNS / SELECTS:
 * Formats master data consistently as "CODE | NAME" when a code is present
 * (preserving leading zeros as string), or just "NAME" when a legacy record has no code.
 * Examples:
 *   formatCodeName('0053', 'SKZ') => '0053 | SKZ'
 *   formatCodeName('045', 'SUKKUR') => '045 | SUKKUR'
 *   formatCodeName('0151', 'AREA MANAGER') => '0151 | AREA MANAGER'
 *   formatCodeName('001', 'OPERATIONS') => '001 | OPERATIONS'
 *   formatCodeName(null, 'HR Officer') => 'HR Officer'
 */
export const formatCodeName = (
  code: string | number | null | undefined,
  name: string | null | undefined
): string => {
  const rawName = String(name ?? '').trim();
  const rawCode = code !== null && code !== undefined ? String(code).trim() : '';

  if (!rawName && !rawCode) return '';
  if (!rawName) return rawCode;

  // If name already has "CODE | NAME" format embedded
  if (rawName.includes('|')) {
    const parts = rawName.split('|');
    const embeddedCode = parts[0].trim();
    const embeddedName = parts.slice(1).join('|').trim();
    const effectiveCode = rawCode || embeddedCode;
    if (effectiveCode && embeddedName) {
      return `${effectiveCode} | ${embeddedName}`;
    }
  }

  if (!rawCode) return rawName;
  return `${rawCode} | ${rawName}`;
};

/**
 * Shared helper for TABLES, CARDS, BADGES, DASHBOARDS, DOSSIER/PDF, and EXPORTS:
 * Returns ONLY the clean entity NAME (stripping any accidental "CODE | " prefix).
 */
export const formatEntityName = (
  name: string | null | undefined,
  fallback = ''
): string => {
  const raw = String(name ?? '').trim();
  if (!raw) return fallback;
  if (raw.includes('|')) {
    const parts = raw.split('|');
    const clean = parts.slice(1).join('|').trim();
    if (clean) return clean;
  }
  return raw;
};

/**
 * Shared search helper: matches a search query against code, name, or "CODE | NAME".
 */
export const matchesCodeOrName = (
  query: string,
  code: string | null | undefined,
  name: string | null | undefined,
  ...extraFields: Array<string | null | undefined>
): boolean => {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const c = String(code ?? '').trim().toLowerCase();
  const n = String(name ?? '').trim().toLowerCase();
  const combined = formatCodeName(code, name).toLowerCase();
  if (c.includes(q) || n.includes(q) || combined.includes(q)) return true;
  for (const extra of extraFields) {
    if (extra && String(extra).toLowerCase().includes(q)) return true;
  }
  return false;
};

/**
 * Parses either a combined "CODE | NAME" string or separate code + name inputs
 * into normalized { code, name } fields without duplicating the code prefix.
 * Preserves leading zeros by keeping code strictly as a trimmed string.
 */
export const parseCodeAndName = (
  rawNameOrCombined: string | null | undefined,
  rawExplicitCode?: string | number | null | undefined
): { code: string; name: string } => {
  let code = rawExplicitCode !== null && rawExplicitCode !== undefined ? String(rawExplicitCode).trim() : '';
  let name = String(rawNameOrCombined ?? '').trim();

  // Check if code itself was given as "0053 | SKZ"
  if (code.includes('|') && !name) {
    const parts = code.split('|');
    code = parts[0].trim();
    name = parts.slice(1).join('|').trim();
  } else if (code.includes('|') && name === code) {
    const parts = code.split('|');
    code = parts[0].trim();
    name = parts.slice(1).join('|').trim();
  }

  // Check if name was given as "0053 | SKZ"
  if (name.includes('|')) {
    const parts = name.split('|');
    const leftCode = parts[0].trim();
    const rightName = parts.slice(1).join('|').trim();
    if (!code && leftCode) {
      code = leftCode;
    }
    if (rightName) {
      name = rightName;
    }
  }

  return { code, name };
};
