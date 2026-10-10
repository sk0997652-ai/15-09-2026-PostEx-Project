// ==============================================================================
// Script to generate the 3 sample ECF PDFs into scripts/out/
// (1) no template, partial clearance
// (2) PNG image template, full clearance
// (3) PDF template, full clearance
// Also renders each PDF to PNG using Ghostscript (/usr/bin/gs)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateEcfPdf } from '../src/server/ecfPdfGenerator';

async function main() {
  const outDir = path.resolve(process.cwd(), 'scripts/out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`Target directory: ${outDir}`);

  // --------------------------------------------------------------------------
  // Sample 1: No template, Partial clearance
  // --------------------------------------------------------------------------
  console.log('Generating Sample 1: No template, Partial clearance...');
  const sample1Bytes = await generateEcfPdf({
    exitId: '00000000-0000-0000-0000-000000000001',
    employeeCode: 'PX-EMP-0042',
    fullName: 'Tariq Mahmood',
    designation: 'Operations Supervisor',
    branch: 'Lahore Main Hub',
    exitType: 'resignation',
    lastWorkingDate: '2026-11-20',
    reason: 'Relocating to another city with family',
    clearanceItems: [
      { item_key: 'office_files', status: 'received' },
      { item_key: 'keys', status: 'not_applicable' },
      { item_key: 'mobile_sim', status: 'received', detail: '0300-8451290' },
      { item_key: 'id_card', status: 'pending' },
      { item_key: 'company_car', status: 'pending' },
      { item_key: 'others', status: 'pending' },
    ],
    preparedByName: 'Ayesha Khan (HR Officer)',
    generatedDate: '09 Oct 2026',
    templateBuffer: null,
    templateMimeType: null,
  });

  const sample1Path = path.join(outDir, 'sample1_no_template_partial.pdf');
  fs.writeFileSync(sample1Path, Buffer.from(sample1Bytes));
  console.log(`Saved Sample 1 to: ${sample1Path} (${sample1Bytes.byteLength} bytes)`);

  // --------------------------------------------------------------------------
  // Sample 2: PNG image template, Full clearance
  // --------------------------------------------------------------------------
  console.log('Generating Sample 2: PNG image template, Full clearance...');

  // Create a realistic PNG letterhead image buffer using an embedded PDF canvas or clean PNG
  // Minimal valid 120x30 PNG with PostEx green banner
  // Let's create a crisp PNG banner
  const pngHeaderDoc = await PDFDocument.create();
  const pngPage = pngHeaderDoc.addPage([400, 60]);
  pngPage.drawRectangle({
    x: 0,
    y: 0,
    width: 400,
    height: 60,
    color: rgb(0.04, 0.58, 0.38),
  });
  pngPage.drawText('POSTEX EXPRESS LOGISTICS', {
    x: 20,
    y: 28,
    size: 16,
    color: rgb(1, 1, 1),
  });
  pngPage.drawText('Official Clearance & Asset Offboarding Protocol', {
    x: 20,
    y: 12,
    size: 9,
    color: rgb(0.85, 0.95, 0.9),
  });
  const tempPdfForPng = path.join(outDir, '_temp_png_banner.pdf');
  const tempPngOut = path.join(outDir, '_temp_png_banner.png');
  fs.writeFileSync(tempPdfForPng, await pngHeaderDoc.save());

  // Render to PNG with gs
  execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${tempPngOut}" "${tempPdfForPng}"`, {
    stdio: 'ignore',
  });
  const pngTemplateBuffer = fs.readFileSync(tempPngOut);
  fs.unlinkSync(tempPdfForPng);
  fs.unlinkSync(tempPngOut);

  const sample2Bytes = await generateEcfPdf({
    exitId: '00000000-0000-0000-0000-000000000002',
    employeeCode: 'PX-EMP-0108',
    fullName: 'Zainab Fatima',
    designation: 'Senior Financial Analyst',
    branch: 'Islamabad Corporate Office',
    exitType: 'resignation',
    lastWorkingDate: '2026-11-30',
    reason: 'Pursuing higher education abroad for master degree program',
    clearanceItems: [
      { item_key: 'office_files', status: 'received' },
      { item_key: 'keys', status: 'not_applicable' },
      { item_key: 'mobile_sim', status: 'received', detail: '0321-9876543' },
      { item_key: 'id_card', status: 'received' },
      { item_key: 'company_car', status: 'received', detail: 'LEA-2024-8190' },
      { item_key: 'others', status: 'not_applicable' },
    ],
    preparedByName: 'Bilal Ahmed (Central HR Manager)',
    generatedDate: '09 Oct 2026',
    templateBuffer: pngTemplateBuffer,
    templateMimeType: 'image/png',
  });

  const sample2Path = path.join(outDir, 'sample2_png_template_full.pdf');
  fs.writeFileSync(sample2Path, Buffer.from(sample2Bytes));
  console.log(`Saved Sample 2 to: ${sample2Path} (${sample2Bytes.byteLength} bytes)`);

  // --------------------------------------------------------------------------
  // Sample 3: PDF template, Full clearance
  // --------------------------------------------------------------------------
  console.log('Generating Sample 3: PDF template, Full clearance...');

  // Create an official A4 PDF background template
  const pdfTemplateDoc = await PDFDocument.create();
  const tPage = pdfTemplateDoc.addPage([595.28, 841.89]);

  // Top header banner
  tPage.drawRectangle({
    x: 0,
    y: 841.89 - 90,
    width: 595.28,
    height: 90,
    color: rgb(0.06, 0.09, 0.16),
  });
  tPage.drawRectangle({
    x: 0,
    y: 841.89 - 94,
    width: 595.28,
    height: 4,
    color: rgb(0.04, 0.58, 0.38),
  });
  tPage.drawText('POSTEX', {
    x: 40,
    y: 841.89 - 52,
    size: 22,
    color: rgb(1, 1, 1),
  });
  tPage.drawText('EMPLOYEE WORKFLOW & EXIT CLEARANCE DIVISION', {
    x: 40,
    y: 841.89 - 72,
    size: 9,
    color: rgb(0.65, 0.75, 0.85),
  });
  // Subtle decorative border around page
  tPage.drawRectangle({
    x: 20,
    y: 20,
    width: 595.28 - 40,
    height: 841.89 - 40,
    borderColor: rgb(0.9, 0.92, 0.95),
    borderWidth: 1,
  });

  const pdfTemplateBuffer = Buffer.from(await pdfTemplateDoc.save());

  const sample3Bytes = await generateEcfPdf({
    exitId: '00000000-0000-0000-0000-000000000003',
    employeeCode: 'PX-EMP-0215',
    fullName: 'Hamza Tariq',
    designation: 'Fleet Logistics Manager',
    branch: 'Karachi South Hub',
    exitType: 'termination',
    lastWorkingDate: '2026-10-15',
    reason: 'Contract completion upon project closure and fleet realignment',
    clearanceItems: [
      { item_key: 'office_files', status: 'received' },
      { item_key: 'keys', status: 'not_applicable' },
      { item_key: 'mobile_sim', status: 'received', detail: '0345-1234567' },
      { item_key: 'id_card', status: 'received' },
      { item_key: 'company_car', status: 'not_applicable' },
      { item_key: 'others', status: 'received', detail: 'IT Security Token & Access Dongle' },
    ],
    preparedByName: 'Usman Farooq (HR Director)',
    generatedDate: '09 Oct 2026',
    templateBuffer: pdfTemplateBuffer,
    templateMimeType: 'application/pdf',
  });

  const sample3Path = path.join(outDir, 'sample3_pdf_template_full.pdf');
  fs.writeFileSync(sample3Path, Buffer.from(sample3Bytes));
  console.log(`Saved Sample 3 to: ${sample3Path} (${sample3Bytes.byteLength} bytes)`);

  // --------------------------------------------------------------------------
  // Render PDFs to PNG images via Ghostscript
  // --------------------------------------------------------------------------
  console.log('\nRendering PDF pages to PNG using Ghostscript (/usr/bin/gs)...');
  const samples = [
    { name: 'sample1_no_template_partial', pdf: sample1Path },
    { name: 'sample2_png_template_full', pdf: sample2Path },
    { name: 'sample3_pdf_template_full', pdf: sample3Path },
  ];

  for (const s of samples) {
    const pngOut = path.join(outDir, `${s.name}_page%d.png`);
    execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${pngOut}" "${s.pdf}"`, {
      stdio: 'inherit',
    });
    console.log(`Rendered PNG: ${pngOut}`);
  }

  // Summary of output files
  console.log('\n--- Output Directory Contents ---');
  const files = fs.readdirSync(outDir);
  for (const f of files) {
    const stat = fs.statSync(path.join(outDir, f));
    console.log(` - ${f} (${stat.size} bytes)`);
  }
}

main().catch((err) => {
  console.error('Error generating sample PDFs:', err);
  process.exit(1);
});
