import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { formatAppDateAtTime } from '@/lib/appDateTime';
import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import { PDF_TEXT_FALLBACK, sanitizeForPdfText } from '@/lib/pdfWinAnsiText';
import type { PdiDoc } from '@/lib/pdi/types';
import {
  PDF_BRANDING_FOOTER_HEIGHT_PT,
  PDF_BRANDING_HEADER_HEIGHT_PT,
  applyBrandingToAllPdfLibPages,
  embedBrandingImagesForPdfLib,
} from '@/lib/pdfLibDocumentBranding';

type TGetter = { get: (key: string, params?: Record<string, string>) => string };

export type PdiPdfExportOptions = {
  trailTitles: Map<string, string>;
  trailDescriptions?: Map<string, string>;
  participantName?: string | null;
  progressByTrail?: Map<string, { percent: number; completed: boolean }>;
  locale?: string;
};

const PAGE_SIZE = { width: 595.28, height: 841.89 };
const MARGIN_X = 48;
/** Espaço entre o cabeçalho de branding e o primeiro texto (abaixo dos logótipos). */
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

export async function buildPdiPdfBytes(
  pdi: PdiDoc,
  t: TGetter,
  opts: PdiPdfExportOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const branding = await fetchDocumentBranding().catch(() => defaultBranding());
  const embeddedBranding = await embedBrandingImagesForPdfLib(pdf, branding);

  const marginTop = PDF_BRANDING_HEADER_HEIGHT_PT + CONTENT_TOP_GAP_PT;
  const marginBottom = MARGIN_X + PDF_BRANDING_FOOTER_HEIGHT_PT;
  const maxTextWidth = PAGE_SIZE.width - MARGIN_X * 2;
  const locale = opts.locale ?? 'pt';

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
    const labelWidth = 150;
    const valueX = MARGIN_X + labelWidth;
    const lead = lineLead(BODY_SIZE);
    const lines = wrapText(value || PDF_TEXT_FALLBACK, maxTextWidth - labelWidth, font, BODY_SIZE);
    const blockHeight = Math.max(lead, lines.length * lead);
    ensureSpace(blockHeight + blockGap(BODY_SIZE));
    page.drawText(sanitizeForPdfText(key), {
      x: MARGIN_X,
      y: cursorY,
      size: BODY_SIZE,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: valueX,
        y: cursorY - idx * lead,
        size: BODY_SIZE,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    cursorY -= blockHeight + blockGap(BODY_SIZE);
  };

  const drawParagraph = (text: string) => {
    const lead = lineLead(BODY_SIZE);
    const lines = wrapText(text || PDF_TEXT_FALLBACK, maxTextWidth, font, BODY_SIZE);
    const blockHeight = lines.length * lead;
    ensureSpace(blockHeight + blockGap(BODY_SIZE));
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: MARGIN_X,
        y: cursorY - idx * lead,
        size: BODY_SIZE,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
    });
    cursorY -= blockHeight + blockGap(BODY_SIZE);
  };

  const drawBullets = (items: string[], emptyLabel: string) => {
    if (items.length === 0) {
      drawText(emptyLabel, BODY_SIZE, false, rgb(0.35, 0.35, 0.35));
      return;
    }
    const lead = lineLead(BODY_SIZE);
    items.forEach((item) => {
      const lines = wrapText(item, maxTextWidth - 14, font, BODY_SIZE);
      const blockHeight = Math.max(lead, lines.length * lead);
      ensureSpace(blockHeight + blockGap(BODY_SIZE));
      page.drawText('-', { x: MARGIN_X, y: cursorY, size: BODY_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
      lines.forEach((line, idx) => {
        page.drawText(line, {
          x: MARGIN_X + 14,
          y: cursorY - idx * lead,
          size: BODY_SIZE,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      });
      cursorY -= blockHeight + blockGap(BODY_SIZE);
    });
  };

  const docTitle = t.get('pdi.migrant.title');
  const includedTrilhas = pdi.trilhas.filter((tr) => tr.recommended_state !== 'NAO_INCLUIDA');
  const baseTrilhas = includedTrilhas.filter(
    (tr) => tr.recommended_state === 'OBRIGATORIA' || tr.recommended_state === 'RECOMENDADA'
  );
  const optionalTrilhas = includedTrilhas.filter((tr) => tr.recommended_state === 'OPCIONAL');

  const formatTrailLine = (tr: (typeof includedTrilhas)[number], index: number) => {
    const title = opts.trailTitles.get(tr.trail_id) ?? tr.trail_id;
    const state = t.get(`pdi.trailState.${tr.recommended_state}`);
    const progress = opts.progressByTrail?.get(tr.trail_id);
    const progressLabel = progress?.completed
      ? t.get('pdi.cpc.trailCompleted')
      : progress && progress.percent > 0
        ? t.get('pdi.cpc.trailInProgress', { percent: String(progress.percent) })
        : t.get('pdi.cpc.trailNotStarted');
    return `T${index + 1}. ${title} - ${state} - ${progressLabel}`;
  };

  drawText(docTitle, TITLE_SIZE, true);
  drawText(t.get('pdi.migrant.subtitle'), BODY_SIZE, false, rgb(0.35, 0.35, 0.35));
  cursorY -= blockGap(BODY_SIZE);

  drawKeyValue(t.get('pdi.fields.version'), pdi.version);
  drawKeyValue(t.get('pdi.fields.status'), t.get(`pdi.status.${pdi.status}`));
  if (opts.participantName?.trim()) {
    drawKeyValue('Participante', opts.participantName.trim());
  }
  if (pdi.validated_at) {
    drawKeyValue('Validado em', formatAppDateAtTime(pdi.validated_at, { locale }));
  }
  if (pdi.accepted_at) {
    drawKeyValue('Aceite em', formatAppDateAtTime(pdi.accepted_at, { locale }));
  }

  drawHeading('Indicadores SCAS');
  drawKeyValue(
    t.get('pdi.fields.scoreGlobal'),
    `${pdi.score_global?.toFixed(2) ?? '—'} → ${pdi.target_global?.toFixed(2) ?? '—'}`
  );
  drawKeyValue('D1', `${pdi.score_d1?.toFixed(2) ?? '—'} → ${pdi.target_d1?.toFixed(2) ?? '—'}`);
  drawKeyValue('D2', `${pdi.score_d2?.toFixed(2) ?? '—'} → ${pdi.target_d2?.toFixed(2) ?? '—'}`);
  drawKeyValue('D3', `${pdi.score_d3?.toFixed(2) ?? '—'} → ${pdi.target_d3?.toFixed(2) ?? '—'}`);
  drawKeyValue('D4', `${pdi.score_d4?.toFixed(2) ?? '—'} → ${pdi.target_d4?.toFixed(2) ?? '—'}`);

  drawHeading(t.get('pdi.migrant.baseTrailsTitle'));
  drawBullets(
    baseTrilhas.map((tr, i) => formatTrailLine(tr, i)),
    t.get('pdi.migrant.noBaseTrails')
  );

  if (optionalTrilhas.length > 0) {
    drawHeading(t.get('pdi.migrant.optionalTrailsTitle'));
    drawBullets(
      optionalTrilhas.map((tr, i) => formatTrailLine(tr, baseTrilhas.length + i)),
      PDF_TEXT_FALLBACK
    );
  }

  drawHeading(t.get('pdi.sections.apoios'));
  drawBullets(
    pdi.apoios.map((a) => {
      const label = t.get(`pdi.apoios.${a.type}`);
      return a.notes?.trim() ? `${label}: ${a.notes.trim()}` : label;
    }),
    t.get('pdi.migrant.noApoios')
  );

  drawHeading(t.get('pdi.sections.objetivos'));
  drawParagraph(pdi.notes?.trim() ? pdi.notes.trim() : t.get('pdi.migrant.defaultObjectives'));

  drawHeading(t.get('pdi.sections.declaracao'));
  drawParagraph(t.get('pdi.migrant.declaration'));

  applyBrandingToAllPdfLibPages(pdf, font, embeddedBranding, branding, docTitle);
  return pdf.save();
}

export async function downloadPdiPdf(
  pdi: PdiDoc,
  trailTitles: Map<string, string>,
  t: TGetter,
  opts?: Partial<Omit<PdiPdfExportOptions, 'trailTitles'>>
): Promise<void> {
  const bytes = await buildPdiPdfBytes(pdi, t, {
    trailTitles,
    ...opts,
  });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const safeVersion = String(pdi.version).replace(/[^\w.-]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `PDI_v${safeVersion}_${pdi.participant_id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
