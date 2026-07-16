import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { formatAppDateAtTime } from '@/lib/appDateTime';
import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import { getTranslationStringAtPath, type Language } from '@/lib/i18n';
import {
  SCAS_DOMAIN_I18N_KEY,
  SCAS_DOMAINS,
  SCAS_ITEM_DOMAIN,
  itemsForScope,
} from '@/lib/scas';
import type { ScasAssessmentDoc, ScasResponseDoc } from '@/lib/scas/repository';
import { PDF_TEXT_FALLBACK, sanitizeForPdfText } from '@/lib/pdfWinAnsiText';
import {
  PDF_BRANDING_FOOTER_HEIGHT_PT,
  PDF_BRANDING_HEADER_HEIGHT_PT,
  applyBrandingToAllPdfLibPages,
  embedBrandingImagesForPdfLib,
} from '@/lib/pdfLibDocumentBranding';

const PAGE_SIZE = { width: 595.28, height: 841.89 };
const MARGIN_X = 48;
const CONTENT_TOP_GAP_PT = 10;
const LINE_SPACING = 1.5;
const BODY_SIZE = 10;
const HEADING_SIZE = 13;
const TITLE_SIZE = 18;

function lineLead(fontSize: number): number {
  return fontSize * LINE_SPACING;
}

function blockGap(fontSize: number): number {
  return lineLead(fontSize) * 0.5;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const safeText = sanitizeForPdfText(text);
  const words = safeText.split(/\s+/g).filter(Boolean);
  if (words.length === 0) return [PDF_TEXT_FALLBACK];
  const lines: string[] = [];
  let current = '';
  words.forEach((w) => {
    const word = sanitizeForPdfText(w);
    if (!word) return;
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [PDF_TEXT_FALLBACK];
}

function scasLabel(lang: Language, path: string, fallback: string): string {
  return getTranslationStringAtPath(lang, path) ?? fallback;
}

export type ScasPdfExportOptions = {
  participantName: string;
  trailTitle?: string | null;
  responses: ScasResponseDoc[];
  uiLabels: {
    title: string;
    participant: string;
    moment: string;
    date: string;
    mode: string;
    language: string;
    trail: string;
    scores: string;
    global: string;
    responses: string;
    autonomous: string;
    assisted: string;
    item: string;
  };
};

export async function buildScasAssessmentPdfBytes(
  assessment: ScasAssessmentDoc,
  opts: ScasPdfExportOptions
): Promise<Uint8Array> {
  const lang = assessment.language;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const branding = await fetchDocumentBranding().catch(() => defaultBranding());
  const embeddedBranding = await embedBrandingImagesForPdfLib(pdf, branding);

  const marginTop = PDF_BRANDING_HEADER_HEIGHT_PT + CONTENT_TOP_GAP_PT;
  const marginBottom = MARGIN_X + PDF_BRANDING_FOOTER_HEIGHT_PT;
  const maxTextWidth = PAGE_SIZE.width - MARGIN_X * 2;

  let page: PDFPage = pdf.addPage([PAGE_SIZE.width, PAGE_SIZE.height]);
  let cursorY = PAGE_SIZE.height - marginTop;

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < marginBottom) {
      page = pdf.addPage([PAGE_SIZE.width, PAGE_SIZE.height]);
      cursorY = PAGE_SIZE.height - marginTop;
    }
  };

  const drawText = (text: string, size = BODY_SIZE, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const lead = lineLead(size);
    ensureSpace(lead);
    page.drawText(sanitizeForPdfText(text), {
      x: MARGIN_X,
      y: cursorY - size,
      size,
      font: bold ? fontBold : font,
      color,
    });
    cursorY -= lead;
  };

  const drawHeading = (text: string) => {
    cursorY -= blockGap(BODY_SIZE);
    drawText(text, HEADING_SIZE, true);
    cursorY -= blockGap(BODY_SIZE);
  };

  const drawKeyValue = (key: string, value: string) => {
    const labelWidth = 300;
    const valueX = MARGIN_X + labelWidth + 8;
    const valueWidth = maxTextWidth - labelWidth - 8;
    const lead = lineLead(BODY_SIZE);
    const keyLines = wrapText(key, labelWidth, fontBold, BODY_SIZE);
    const valueLines = wrapText(value || PDF_TEXT_FALLBACK, valueWidth, font, BODY_SIZE);
    const rowCount = Math.max(keyLines.length, valueLines.length);
    const blockHeight = rowCount * lead;
    ensureSpace(blockHeight + blockGap(BODY_SIZE));
    for (let i = 0; i < rowCount; i += 1) {
      const y = cursorY - i * lead;
      if (keyLines[i]) {
        page.drawText(keyLines[i], {
          x: MARGIN_X,
          y,
          size: BODY_SIZE,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
      if (valueLines[i]) {
        page.drawText(valueLines[i], {
          x: valueX,
          y,
          size: BODY_SIZE,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }
    cursorY -= blockHeight + blockGap(BODY_SIZE);
  };

  const drawWrappedBold = (text: string, indent = 0) => {
    const lead = lineLead(BODY_SIZE);
    const lines = wrapText(text, maxTextWidth - indent, fontBold, BODY_SIZE);
    const blockHeight = lines.length * lead;
    ensureSpace(blockHeight + blockGap(BODY_SIZE));
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: MARGIN_X + indent,
        y: cursorY - idx * lead,
        size: BODY_SIZE,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });
    });
    cursorY -= blockHeight + blockGap(BODY_SIZE);
  };

  const drawItemResponse = (itemId: number, value: number) => {
    const itemText = scasLabel(lang, `scas.items.${itemId}`, `Item ${itemId}`);
    const scaleText = scasLabel(lang, `scas.scale.${value}`, String(value));
    const lead = lineLead(BODY_SIZE);
    const questionLines = wrapText(`${itemId}. ${itemText}`, maxTextWidth - 20, font, BODY_SIZE);
    const answerLine = sanitizeForPdfText(`${opts.uiLabels.item}: ${value} (${scaleText})`);
    const blockHeight = questionLines.length * lead + lead + blockGap(BODY_SIZE);
    ensureSpace(blockHeight);
    let y = cursorY;
    questionLines.forEach((line) => {
      page.drawText(line, {
        x: MARGIN_X + 10,
        y,
        size: BODY_SIZE,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lead;
    });
    page.drawText(answerLine, {
      x: MARGIN_X + 18,
      y,
      size: BODY_SIZE,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= blockHeight;
  };

  const momentLabel = scasLabel(lang, `scas.moments.${assessment.moment_type}`, assessment.moment_type);
  const modeLabel =
    assessment.mode === 'ASSISTIDO'
      ? opts.uiLabels.assisted
      : opts.uiLabels.autonomous;
  const submittedLabel = assessment.submitted_at
    ? formatAppDateAtTime(assessment.submitted_at, { locale: lang })
    : PDF_TEXT_FALLBACK;

  drawText(opts.uiLabels.title, TITLE_SIZE, true);
  cursorY -= blockGap(BODY_SIZE);

  drawKeyValue(opts.uiLabels.participant, opts.participantName);
  drawKeyValue(opts.uiLabels.moment, momentLabel);
  drawKeyValue(opts.uiLabels.date, submittedLabel);
  drawKeyValue(opts.uiLabels.mode, modeLabel);
  drawKeyValue(opts.uiLabels.language, assessment.language.toUpperCase());
  if (opts.trailTitle?.trim()) {
    drawKeyValue(opts.uiLabels.trail, opts.trailTitle.trim());
  }

  drawHeading(opts.uiLabels.scores);
  for (const domain of SCAS_DOMAINS) {
    const key = `score_${domain.toLowerCase()}` as keyof ScasAssessmentDoc;
    const score = assessment[key];
    const domainName = scasLabel(lang, SCAS_DOMAIN_I18N_KEY[domain], domain);
    drawKeyValue(domainName, typeof score === 'number' ? score.toFixed(2) : PDF_TEXT_FALLBACK);
  }
  drawKeyValue(
    opts.uiLabels.global,
    typeof assessment.score_global === 'number' ? assessment.score_global.toFixed(2) : PDF_TEXT_FALLBACK
  );

  const itemIds = itemsForScope(assessment.domain_scope);
  const responseMap = new Map(opts.responses.map((r) => [r.item_id, r.value]));
  const answeredIds = itemIds.filter((id) => typeof responseMap.get(id) === 'number');

  drawHeading(opts.uiLabels.responses);
  if (answeredIds.length === 0) {
    drawText(PDF_TEXT_FALLBACK, BODY_SIZE, false, rgb(0.35, 0.35, 0.35));
  } else {
    for (const domain of SCAS_DOMAINS) {
      const domainItemIds = answeredIds
        .filter((id) => SCAS_ITEM_DOMAIN[id] === domain)
        .sort((a, b) => a - b);
      if (domainItemIds.length === 0) continue;
      if (!assessment.domain_scope) {
        drawWrappedBold(scasLabel(lang, SCAS_DOMAIN_I18N_KEY[domain], domain));
      }
      domainItemIds.forEach((itemId) => {
        const value = responseMap.get(itemId);
        if (typeof value !== 'number') return;
        drawItemResponse(itemId, value);
      });
    }
  }

  applyBrandingToAllPdfLibPages(pdf, font, embeddedBranding, branding, opts.uiLabels.title);
  return pdf.save();
}

export async function downloadScasAssessmentPdf(
  assessment: ScasAssessmentDoc,
  opts: ScasPdfExportOptions
): Promise<void> {
  const bytes = await buildScasAssessmentPdfBytes(assessment, opts);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const moment = sanitizeForPdfText(assessment.moment_type).replace(/[^\w-]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `SCAS_${moment}_${assessment.participant_id}_${assessment.id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
