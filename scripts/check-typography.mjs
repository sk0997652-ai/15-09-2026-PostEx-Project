#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const INDEX_HTML = path.resolve(process.cwd(), 'index.html');

// Excluded files / patterns
const EXCLUDED_PATHS = [
  'src/index.css',
  'src/server/ecfPdfGenerator.ts',
  'src/server/dossierGenerator.ts',
  'src/server/notificationService.ts',
  'src/server/employeesRoutes.ts', // Contains HTML email template
];

function isExcluded(filePath) {
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return EXCLUDED_PATHS.some((ex) => relPath.includes(ex));
}

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      if (!isExcluded(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// Check index.html for "Plus Jakarta Sans" or hardcoded font-family
const fatalErrors = [];

if (fs.existsSync(INDEX_HTML)) {
  const htmlContent = fs.readFileSync(INDEX_HTML, 'utf8');
  if (htmlContent.includes('Plus Jakarta Sans')) {
    fatalErrors.push({
      file: 'index.html',
      line: 1,
      message: 'Found forbidden font "Plus Jakarta Sans" in index.html',
    });
  }
}

const files = getAllFiles(SRC_DIR);

// Metrics for warning
const folderMetrics = {};

function getFolderKey(filePath) {
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  if (rel.startsWith('components/admin/')) return 'admin';
  if (rel.startsWith('components/central/')) return 'central';
  if (rel.startsWith('components/zonal/')) return 'zonal';
  if (rel.startsWith('components/branch/')) return 'branch';
  if (rel.startsWith('components/candidate/')) return 'candidate';
  if (rel.startsWith('components/common/')) return 'common';
  if (rel.startsWith('components/ui/')) return 'ui';
  if (rel.startsWith('components/')) return 'root components';
  if (rel.startsWith('lib/')) return 'lib';
  if (rel.startsWith('server/')) return 'server';
  if (rel.startsWith('types/')) return 'types';
  return 'root';
}

function initFolder(folder) {
  if (!folderMetrics[folder]) {
    folderMetrics[folder] = {
      rawSizes: 0,
      fontSans: 0,
      fontMono: 0,
      uppercaseTracking: 0,
    };
  }
}

// Regex patterns
const ARBITRARY_FONT_SIZE_REGEX = /text-\[\s*(\d+(\.\d+)?(px|rem|em))\s*\]/g;
const INLINE_FONT_SIZE_REGEX = /fontSize\s*[:=]\s*['"\d]/;
const INLINE_FONT_FAMILY_REGEX = /fontFamily\s*[:=]\s*['"`]/;
const HARDCODED_FONT_FAMILY_CSS_REGEX = /font-family\s*:\s*[^;`'"]+/;

const RAW_TAILWIND_SIZE_REGEX = /\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g;
const FONT_SANS_REGEX = /\bfont-sans\b/g;
const FONT_MONO_REGEX = /\bfont-mono\b/g;

for (const file of files) {
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const folder = getFolderKey(file);
  initFolder(folder);

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. FATAL CHECKS
    // a. "Plus Jakarta Sans"
    if (line.includes('Plus Jakarta Sans')) {
      fatalErrors.push({
        file: relPath,
        line: lineNum,
        message: 'Found forbidden font "Plus Jakarta Sans"',
      });
    }

    // b. Arbitrary text-[...] size
    const arbitraryMatches = line.match(ARBITRARY_FONT_SIZE_REGEX);
    if (arbitraryMatches) {
      fatalErrors.push({
        file: relPath,
        line: lineNum,
        message: `Found arbitrary font size: ${arbitraryMatches.join(', ')}`,
      });
    }

    // c. Inline fontSize or fontFamily
    if (INLINE_FONT_SIZE_REGEX.test(line)) {
      fatalErrors.push({
        file: relPath,
        line: lineNum,
        message: `Found inline style fontSize: ${line.trim()}`,
      });
    }
    if (INLINE_FONT_FAMILY_REGEX.test(line)) {
      fatalErrors.push({
        file: relPath,
        line: lineNum,
        message: `Found inline style fontFamily: ${line.trim()}`,
      });
    }

    // d. Hardcoded font-family string (except allowed comment or standard CSS variable reference)
    if (HARDCODED_FONT_FAMILY_CSS_REGEX.test(line)) {
      fatalErrors.push({
        file: relPath,
        line: lineNum,
        message: `Found hardcoded font-family rule: ${line.trim()}`,
      });
    }

    // 2. WARNING / STATS CHECKS
    const rawMatches = line.match(RAW_TAILWIND_SIZE_REGEX);
    if (rawMatches) {
      folderMetrics[folder].rawSizes += rawMatches.length;
    }

    const sansMatches = line.match(FONT_SANS_REGEX);
    if (sansMatches) {
      folderMetrics[folder].fontSans += sansMatches.length;
    }

    const monoMatches = line.match(FONT_MONO_REGEX);
    if (monoMatches) {
      folderMetrics[folder].fontMono += monoMatches.length;
    }

    // Check uppercase combined with tracking-wider (exclude ComponentLibraryShowcase.tsx if specified)
    if (!relPath.endsWith('ComponentLibraryShowcase.tsx')) {
      if (line.includes('uppercase') && line.includes('tracking-wider')) {
        folderMetrics[folder].uppercaseTracking += 1;
      }
    }
  });
}

// Print Report
console.log('====================================================');
console.log('       TYPOGRAPHY GUARD & AUDIT REPORT (check:type)  ');
console.log('====================================================\n');

if (fatalErrors.length > 0) {
  console.error(`❌ FATAL VIOLATIONS DETECTED (${fatalErrors.length}):`);
  for (const err of fatalErrors) {
    console.error(`  - ${err.file}:${err.line} -> ${err.message}`);
  }
  console.log('\nAudit aborted with non-zero exit code.\n');
  process.exit(1);
} else {
  console.log('✅ ZERO FATAL VIOLATIONS FOUND:');
  console.log('  - 0 arbitrary font sizes (text-[...])');
  console.log('  - 0 inline style fontSize / fontFamily');
  console.log('  - 0 forbidden font "Plus Jakarta Sans"');
  console.log('  - 0 hardcoded font-family declarations in source code\n');
}

console.log('📊 FOLDER WARNING METRICS & ADOPTION STATUS:');
console.log('-----------------------------------------------------------------------------------------------------');
console.log(
  'Folder'.padEnd(18) +
    '| Raw Tailwind (text-xs..3xl) | font-sans | font-mono | uppercase tracking-wider'
);
console.log('-----------------------------------------------------------------------------------------------------');

let totalRaw = 0;
let totalSans = 0;
let totalMono = 0;
let totalUppercase = 0;

let adminMono = 0;
let nonAdminMono = 0;

const sortedFolders = Object.keys(folderMetrics).sort();
for (const f of sortedFolders) {
  const m = folderMetrics[f];
  totalRaw += m.rawSizes;
  totalSans += m.fontSans;
  totalMono += m.fontMono;
  totalUppercase += m.uppercaseTracking;

  if (f === 'admin') {
    adminMono += m.fontMono;
  } else {
    nonAdminMono += m.fontMono;
  }

  console.log(
    f.padEnd(18) +
      `| ${String(m.rawSizes).padStart(27)} | ${String(m.fontSans).padStart(9)} | ${String(m.fontMono).padStart(9)} | ${String(m.uppercaseTracking).padStart(24)}`
  );
}

console.log('-----------------------------------------------------------------------------------------------------');
console.log(
  'TOTAL'.padEnd(18) +
    `| ${String(totalRaw).padStart(27)} | ${String(totalSans).padStart(9)} | ${String(totalMono).padStart(9)} | ${String(totalUppercase).padStart(24)}`
);
console.log('-----------------------------------------------------------------------------------------------------\n');

console.log('🎯 FONT-MONO AUDIT COMPARISON:');
console.log(`  - admin folder:        ${adminMono} (target spec: 32) -> ${adminMono === 32 ? 'MATCH ✅' : 'MISMATCH ⚠️'}`);
console.log(`  - other folders sum:   ${nonAdminMono} (target spec: 99) -> ${nonAdminMono === 99 ? 'MATCH ✅' : 'MISMATCH ⚠️'}`);
console.log(`  - total font-mono:     ${totalMono} (spec: 131)\n`);

console.log('Check passed successfully with exit code 0.');
process.exit(0);
