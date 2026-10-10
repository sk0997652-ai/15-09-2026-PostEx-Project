// ==============================================================================
// PostEx HR Onboarding Portal — Employee Clearance Form (ECF) PDF Generator
// Built with pdf-lib for rigorous compliance, multi-page support, and safe encoding
// ==============================================================================

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFName } from 'pdf-lib';

export interface ClearanceItemData {
  item_key: string;
  status: string; // 'pending' | 'received' | 'not_received' | 'not_applicable'
  detail?: string | null;
}

export interface EcfPdfPayload {
  exitId: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  branch: string;
  exitType: string;
  lastWorkingDate: string;
  reason: string;
  clearanceItems: ClearanceItemData[];
  preparedByName: string;
  generatedDate: string;
  templateBuffer?: Buffer | null;
  templateMimeType?: string | null;
}

/**
 * Replaces characters outside standard WinAnsi (Latin-1) encoding range (e.g. Urdu, Arabic, emojis)
 * with safe ASCII characters ('?') so pdf-lib Helvetica standard fonts will never crash.
 */
export function sanitizePdfText(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
        return ch;
      }
      if (ch === '\n' || ch === '\r' || ch === '\t') {
        return ' ';
      }
      // Non-encodable characters (e.g. Urdu / Arabic / special symbols) replaced safely
      return '?';
    })
    .join('');
}

/**
 * Draws a clean checkbox square with diagonal crossing lines when checked.
 * Uses NO unicode characters to maintain strict standard font compatibility.
 */
function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  checked: boolean
) {
  // Square boundary
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    borderColor: rgb(0.35, 0.4, 0.48),
    borderWidth: 1,
    color: checked ? rgb(0.93, 0.98, 0.94) : rgb(1, 1, 1),
  });

  if (checked) {
    const pad = 2;
    const strokeColor = rgb(0.04, 0.58, 0.38); // PostEx Emerald
    // Diagonal 1: bottom-left to top-right
    page.drawLine({
      start: { x: x + pad, y: y + pad },
      end: { x: x + size - pad, y: y + size - pad },
      thickness: 1.3,
      color: strokeColor,
    });
    // Diagonal 2: top-left to bottom-right
    page.drawLine({
      start: { x: x + pad, y: y + size - pad },
      end: { x: x + size - pad, y: y + pad },
      thickness: 1.3,
      color: strokeColor,
    });
  }
}

/**
 * Wraps text into lines that fit within maxWidth using the specified font and size.
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is wider than maxWidth, clip or split
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, fontSize) <= maxWidth) {
            chunk += char;
          } else {
            lines.push(chunk);
            chunk = char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Generates an official Employee Clearance Form (ECF) PDF adhering strictly to PostEx specifications.
 */
export async function generateEcfPdf(payload: EcfPdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN_X = 40;
  const USABLE_WIDTH = A4_WIDTH - MARGIN_X * 2; // 515.28 pt

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const colorNavy = rgb(0.06, 0.09, 0.16);
  const colorSlateDark = rgb(0.2, 0.24, 0.32);
  const colorSlateMuted = rgb(0.42, 0.47, 0.55);
  const colorBorder = rgb(0.82, 0.86, 0.9);
  const colorHeaderBg = rgb(0.95, 0.96, 0.98);
  const colorPostExGreen = rgb(0.04, 0.58, 0.38);

  let currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let currentY = A4_HEIGHT;

  // Helper to ensure enough vertical space or spawn a new page
  const ensureSpace = (neededPoints: number) => {
    if (currentY - neededPoints < 50) {
      currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      currentY = A4_HEIGHT - 50;
    }
  };

  // --------------------------------------------------------------------------
  // 1. LETTERHEAD
  // --------------------------------------------------------------------------
  let isPdfTemplate = false;

  if (payload.templateBuffer && payload.templateBuffer.length > 0) {
    const isBufferPdf =
      payload.templateMimeType === 'application/pdf' ||
      (payload.templateBuffer[0] === 0x25 &&
        payload.templateBuffer[1] === 0x50 &&
        payload.templateBuffer[2] === 0x44 &&
        payload.templateBuffer[3] === 0x46);

    if (isBufferPdf) {
      try {
        const templatePdfDoc = await PDFDocument.load(payload.templateBuffer);
        const templatePages = templatePdfDoc.getPages();
        if (templatePages.length > 0 && templatePages[0].node.has(PDFName.of('Contents'))) {
          const [embeddedTemplatePage] = await pdfDoc.embedPages([templatePages[0]]);
          currentPage.drawPage(embeddedTemplatePage, {
            x: 0,
            y: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT,
          });
          isPdfTemplate = true;
          // Content starts ~140 points from top for PDF background
          currentY = A4_HEIGHT - 140;
        }
      } catch (err) {
        console.warn('Could not embed PDF template background:', err);
      }
    } else {
      // Image template (PNG or JPG)
      try {
        let embeddedImg;
        try {
          embeddedImg = await pdfDoc.embedPng(payload.templateBuffer);
        } catch {
          embeddedImg = await pdfDoc.embedJpg(payload.templateBuffer);
        }

        if (embeddedImg) {
          // Centered at top, scaled to fit page width with max height ~80 points
          const dims = embeddedImg.scaleToFit(USABLE_WIDTH, 80);
          const imgX = MARGIN_X + (USABLE_WIDTH - dims.width) / 2;
          const imgY = A4_HEIGHT - 25 - dims.height;

          currentPage.drawImage(embeddedImg, {
            x: imgX,
            y: imgY,
            width: dims.width,
            height: dims.height,
          });

          currentY = imgY - 20;
        }
      } catch (err) {
        console.warn('Could not embed image template header:', err);
      }
    }
  }

  // Fallback: If no template or image embed didn't set currentY, draw plain "PostEx" text header
  if (!isPdfTemplate && currentY === A4_HEIGHT) {
    currentPage.drawText('POSTEX', {
      x: MARGIN_X,
      y: A4_HEIGHT - 45,
      size: 20,
      font: fontBold,
      color: colorPostExGreen,
    });
    currentPage.drawText('HUMAN RESOURCES & EMPLOYEE OFFBOARDING DIVISION', {
      x: MARGIN_X,
      y: A4_HEIGHT - 58,
      size: 7.5,
      font: fontBold,
      color: colorSlateMuted,
    });
    currentPage.drawLine({
      start: { x: MARGIN_X, y: A4_HEIGHT - 65 },
      end: { x: A4_WIDTH - MARGIN_X, y: A4_HEIGHT - 65 },
      thickness: 1,
      color: colorBorder,
    });
    currentY = A4_HEIGHT - 85;
  }

  // --------------------------------------------------------------------------
  // 2. DOCUMENT TITLE
  // --------------------------------------------------------------------------
  ensureSpace(40);
  currentPage.drawText('Employee Clearance Form (ECF)', {
    x: MARGIN_X,
    y: currentY,
    size: 15,
    font: fontBold,
    color: colorNavy,
  });
  currentY -= 18;

  // --------------------------------------------------------------------------
  // 3. EMPLOYEE TABLE
  // Employee code, Name, Designation, Branch, Exit type, Last working day, Reason
  // --------------------------------------------------------------------------
  ensureSpace(120);

  const empTableX = MARGIN_X;
  const col1W = 100;
  const col2W = 157.64;
  const col3W = 100;
  const col4W = 157.64;

  const empRows = [
    [
      { label: 'Employee Code', val: sanitizePdfText(payload.employeeCode) || '—' },
      { label: 'Employee Name', val: sanitizePdfText(payload.fullName) || '—' },
    ],
    [
      { label: 'Designation', val: sanitizePdfText(payload.designation) || '—' },
      { label: 'Branch', val: sanitizePdfText(payload.branch) || '—' },
    ],
    [
      { label: 'Exit Type', val: sanitizePdfText(payload.exitType.toUpperCase()) || '—' },
      { label: 'Last Working Day', val: sanitizePdfText(payload.lastWorkingDate) || '—' },
    ],
  ];

  const cellHeight = 22;

  for (const row of empRows) {
    const rowY = currentY - cellHeight;

    // Draw background & borders for Row pair 1 & 2
    // Left pair: Label (col1) + Value (col2)
    currentPage.drawRectangle({
      x: empTableX,
      y: rowY,
      width: col1W,
      height: cellHeight,
      color: colorHeaderBg,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: empTableX + col1W,
      y: rowY,
      width: col2W,
      height: cellHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    // Right pair: Label (col3) + Value (col4)
    currentPage.drawRectangle({
      x: empTableX + col1W + col2W,
      y: rowY,
      width: col3W,
      height: cellHeight,
      color: colorHeaderBg,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: empTableX + col1W + col2W + col3W,
      y: rowY,
      width: col4W,
      height: cellHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    // Draw texts
    currentPage.drawText(row[0].label, {
      x: empTableX + 8,
      y: rowY + 7,
      size: 8.5,
      font: fontBold,
      color: colorSlateDark,
    });
    currentPage.drawText(row[0].val, {
      x: empTableX + col1W + 8,
      y: rowY + 7,
      size: 8.5,
      font: fontRegular,
      color: colorNavy,
    });

    currentPage.drawText(row[1].label, {
      x: empTableX + col1W + col2W + 8,
      y: rowY + 7,
      size: 8.5,
      font: fontBold,
      color: colorSlateDark,
    });
    currentPage.drawText(row[1].val, {
      x: empTableX + col1W + col2W + col3W + 8,
      y: rowY + 7,
      size: 8.5,
      font: fontRegular,
      color: colorNavy,
    });

    currentY -= cellHeight;
  }

  // Reason row (full width)
  const reasonLines = wrapText(payload.reason || 'None specified', USABLE_WIDTH - col1W - 16, fontRegular, 8.5);
  const reasonRowH = Math.max(cellHeight, reasonLines.length * 12 + 10);
  const reasonRowY = currentY - reasonRowH;

  currentPage.drawRectangle({
    x: empTableX,
    y: reasonRowY,
    width: col1W,
    height: reasonRowH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: empTableX + col1W,
    y: reasonRowY,
    width: USABLE_WIDTH - col1W,
    height: reasonRowH,
    color: rgb(1, 1, 1),
    borderColor: colorBorder,
    borderWidth: 0.5,
  });

  currentPage.drawText('Exit Reason', {
    x: empTableX + 8,
    y: reasonRowY + reasonRowH - 15,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });

  let textY = reasonRowY + reasonRowH - 15;
  for (const line of reasonLines) {
    currentPage.drawText(line, {
      x: empTableX + col1W + 8,
      y: textY,
      size: 8.5,
      font: fontRegular,
      color: colorNavy,
    });
    textY -= 12;
  }

  currentY = reasonRowY - 22;

  // --------------------------------------------------------------------------
  // 4. HOD CLEARANCE TABLE
  // Title: "HOD CLEARANCE"
  // Subtitle: "(to be filled by concerned department only)"
  // Columns: Item | N/A | Received | Still not received
  // Rows:
  // 1. Office files & stationery
  // 2. Keys (third column label "Not eligible" instead of N/A)
  // 3. Mobile & SIM with the saved detail
  // 4. Company ID card
  // 5. Company car with the saved registration number
  // 6. Others with the saved text
  // --------------------------------------------------------------------------
  ensureSpace(230);

  currentPage.drawText('HOD CLEARANCE', {
    x: MARGIN_X,
    y: currentY,
    size: 11,
    font: fontBold,
    color: colorNavy,
  });
  currentY -= 12;

  currentPage.drawText('(to be filled by concerned department only)', {
    x: MARGIN_X,
    y: currentY,
    size: 8,
    font: fontOblique,
    color: colorSlateMuted,
  });
  currentY -= 12;

  const itemColW = 245.28;
  const naColW = 80;
  const receivedColW = 95;
  const notReceivedColW = 95;

  // Clearance Table Header Row
  const hodHeaderH = 22;
  const hodHeaderY = currentY - hodHeaderH;

  currentPage.drawRectangle({
    x: MARGIN_X,
    y: hodHeaderY,
    width: itemColW,
    height: hodHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + itemColW,
    y: hodHeaderY,
    width: naColW,
    height: hodHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + itemColW + naColW,
    y: hodHeaderY,
    width: receivedColW,
    height: hodHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + itemColW + naColW + receivedColW,
    y: hodHeaderY,
    width: notReceivedColW,
    height: hodHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });

  currentPage.drawText('Item', {
    x: MARGIN_X + 10,
    y: hodHeaderY + 7,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('N/A', {
    x: MARGIN_X + itemColW + 28,
    y: hodHeaderY + 7,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('Received', {
    x: MARGIN_X + itemColW + naColW + 26,
    y: hodHeaderY + 7,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('Still not received', {
    x: MARGIN_X + itemColW + naColW + receivedColW + 10,
    y: hodHeaderY + 7,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });

  currentY = hodHeaderY;

  // Build items lookup
  const itemsMap = new Map(payload.clearanceItems.map((ci) => [ci.item_key, ci]));

  const clearanceRowsConfig = [
    {
      key: 'office_files',
      num: '1',
      label: 'Office files & stationery',
      naLabel: 'N/A',
      detailPrefix: '',
    },
    {
      key: 'keys',
      num: '2',
      label: 'Keys',
      naLabel: 'Not eligible',
      detailPrefix: '',
    },
    {
      key: 'mobile_sim',
      num: '3',
      label: 'Mobile & SIM',
      naLabel: 'N/A',
      detailPrefix: 'Mobile no.',
    },
    {
      key: 'id_card',
      num: '4',
      label: 'Company ID card',
      naLabel: 'N/A',
      detailPrefix: '',
    },
    {
      key: 'company_car',
      num: '5',
      label: 'Company car',
      naLabel: 'N/A',
      detailPrefix: 'Registration #',
    },
    {
      key: 'others',
      num: '6',
      label: 'Others',
      naLabel: 'N/A',
      detailPrefix: 'Detail',
    },
  ];

  const rowHeight = 24;
  const checkboxSize = 11;

  for (const cfg of clearanceRowsConfig) {
    ensureSpace(rowHeight + 2);
    const rowY = currentY - rowHeight;

    const record = itemsMap.get(cfg.key);
    const status = record?.status || 'pending';
    const detail = record?.detail ? sanitizePdfText(record.detail) : '';

    // Draw row cell boundaries
    currentPage.drawRectangle({
      x: MARGIN_X,
      y: rowY,
      width: itemColW,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + itemColW,
      y: rowY,
      width: naColW,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + itemColW + naColW,
      y: rowY,
      width: receivedColW,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + itemColW + naColW + receivedColW,
      y: rowY,
      width: notReceivedColW,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    // Item label & detail
    let itemLabelText = `${cfg.num}. ${cfg.label}`;
    if (detail) {
      itemLabelText += ` (${cfg.detailPrefix ? `${cfg.detailPrefix}: ` : ''}${detail})`;
    }

    // Clip label text if longer than column
    const clippedItemLabel = wrapText(itemLabelText, itemColW - 16, fontRegular, 8.5)[0];
    currentPage.drawText(clippedItemLabel, {
      x: MARGIN_X + 10,
      y: rowY + 8,
      size: 8.5,
      font: fontRegular,
      color: colorNavy,
    });

    // Checkboxes
    // Col 2: N/A (or Not eligible for Keys)
    const isNaChecked = status === 'not_applicable';
    const naBoxX = MARGIN_X + itemColW + (naColW - checkboxSize) / 2;
    const boxY = rowY + (rowHeight - checkboxSize) / 2;
    drawCheckbox(currentPage, naBoxX, boxY, checkboxSize, isNaChecked);

    // If Keys row, print small "Not eligible" hint next to checkbox if desired
    if (cfg.key === 'keys') {
      currentPage.drawText('(Not eligible)', {
        x: MARGIN_X + itemColW + 4,
        y: rowY + 3,
        size: 6,
        font: fontOblique,
        color: colorSlateMuted,
      });
    }

    // Col 3: Received
    const isReceivedChecked = status === 'received';
    const receivedBoxX = MARGIN_X + itemColW + naColW + (receivedColW - checkboxSize) / 2;
    drawCheckbox(currentPage, receivedBoxX, boxY, checkboxSize, isReceivedChecked);

    // Col 4: Still not received
    const isNotReceivedChecked = status === 'not_received';
    const notReceivedBoxX =
      MARGIN_X + itemColW + naColW + receivedColW + (notReceivedColW - checkboxSize) / 2;
    drawCheckbox(currentPage, notReceivedBoxX, boxY, checkboxSize, isNotReceivedChecked);

    currentY = rowY;
  }

  currentY -= 22;

  // --------------------------------------------------------------------------
  // 5. DEPARTMENT APPROVAL TABLE
  // Departments: Admin, IT, Finance, Head Office HR
  // Empty cells for Name, Signature, Date (to be signed by hand)
  // --------------------------------------------------------------------------
  ensureSpace(160);

  currentPage.drawText('Department Approval', {
    x: MARGIN_X,
    y: currentY,
    size: 11,
    font: fontBold,
    color: colorNavy,
  });
  currentY -= 15;

  const deptColW = 125.28;
  const nameColW = 130;
  const sigColW = 140;
  const dateColW = 120;

  const deptHeaderH = 20;
  const deptHeaderY = currentY - deptHeaderH;

  currentPage.drawRectangle({
    x: MARGIN_X,
    y: deptHeaderY,
    width: deptColW,
    height: deptHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + deptColW,
    y: deptHeaderY,
    width: nameColW,
    height: deptHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + deptColW + nameColW,
    y: deptHeaderY,
    width: sigColW,
    height: deptHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });
  currentPage.drawRectangle({
    x: MARGIN_X + deptColW + nameColW + sigColW,
    y: deptHeaderY,
    width: dateColW,
    height: deptHeaderH,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });

  currentPage.drawText('Department', {
    x: MARGIN_X + 8,
    y: deptHeaderY + 6,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('Name', {
    x: MARGIN_X + deptColW + 8,
    y: deptHeaderY + 6,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('Signature', {
    x: MARGIN_X + deptColW + nameColW + 8,
    y: deptHeaderY + 6,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });
  currentPage.drawText('Date', {
    x: MARGIN_X + deptColW + nameColW + sigColW + 8,
    y: deptHeaderY + 6,
    size: 8.5,
    font: fontBold,
    color: colorSlateDark,
  });

  currentY = deptHeaderY;

  const departments = ['Admin', 'IT', 'Finance', 'Head Office HR'];
  const deptRowH = 26; // Roomy height for hand signing

  for (const dept of departments) {
    const rowY = currentY - deptRowH;

    currentPage.drawRectangle({
      x: MARGIN_X,
      y: rowY,
      width: deptColW,
      height: deptRowH,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + deptColW,
      y: rowY,
      width: nameColW,
      height: deptRowH,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + deptColW + nameColW,
      y: rowY,
      width: sigColW,
      height: deptRowH,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    currentPage.drawRectangle({
      x: MARGIN_X + deptColW + nameColW + sigColW,
      y: rowY,
      width: dateColW,
      height: deptRowH,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    currentPage.drawText(dept, {
      x: MARGIN_X + 8,
      y: rowY + 9,
      size: 8.5,
      font: fontBold,
      color: colorNavy,
    });

    currentY = rowY;
  }

  // --------------------------------------------------------------------------
  // 6. FOOTER
  // "Prepared by <HR name>, generated on <date>"
  // --------------------------------------------------------------------------
  const pages = pdfDoc.getPages();
  const footerText = `Prepared by ${sanitizePdfText(payload.preparedByName) || 'HR Officer'}, generated on ${sanitizePdfText(payload.generatedDate)}`;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawLine({
      start: { x: MARGIN_X, y: 35 },
      end: { x: A4_WIDTH - MARGIN_X, y: 35 },
      thickness: 0.5,
      color: colorBorder,
    });

    p.drawText(footerText, {
      x: MARGIN_X,
      y: 23,
      size: 7.5,
      font: fontRegular,
      color: colorSlateMuted,
    });

    if (pages.length > 1) {
      const pageInfo = `Page ${i + 1} of ${pages.length}`;
      const pageInfoW = fontRegular.widthOfTextAtSize(pageInfo, 7.5);
      p.drawText(pageInfo, {
        x: A4_WIDTH - MARGIN_X - pageInfoW,
        y: 23,
        size: 7.5,
        font: fontRegular,
        color: colorSlateMuted,
      });
    }
  }

  return await pdfDoc.save();
}
