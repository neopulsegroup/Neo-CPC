import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { rgb } from 'pdf-lib';

import type { BrandingSection, BrandingSettings } from '@/lib/documentBranding';
import { BRANDING_SECTIONS } from '@/lib/documentBranding';

/** Altura reservada no topo de cada página (pontos PDF, ~25 mm). */
export const PDF_BRANDING_HEADER_HEIGHT_PT = 72;
/** Altura reservada na base de cada página (pontos PDF, ~20 mm). */
export const PDF_BRANDING_FOOTER_HEIGHT_PT = 56;

export type BrandingPdfEmbedded = {
  header: Record<BrandingSection, PDFImage | null>;
  footer: Record<BrandingSection, PDFImage | null>;
};

export function resolveBrandingAssetUrl(url: string): string {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  if (typeof globalThis !== 'undefined' && 'location' in globalThis && u.startsWith('/')) {
    const loc = (globalThis as unknown as { location?: { origin?: string } }).location;
    if (loc?.origin) return `${loc.origin}${u}`;
  }
  return u;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const resolved = resolveBrandingAssetUrl(url);
  if (!resolved) return null;
  try {
    const res = await fetch(resolved, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedBytesAsImage(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  if (bytes.length < 4) return null;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  try {
    if (isPng) return await pdf.embedPng(bytes);
    if (isJpeg) return await pdf.embedJpg(bytes);
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

export async function embedBrandingImagesForPdfLib(
  pdf: PDFDocument,
  branding: BrandingSettings
): Promise<BrandingPdfEmbedded> {
  const header: Record<BrandingSection, PDFImage | null> = {
    left: null,
    center: null,
    right: null,
  };
  const footer: Record<BrandingSection, PDFImage | null> = {
    left: null,
    center: null,
    right: null,
  };

  for (const section of BRANDING_SECTIONS) {
    const hu = branding.header[section].imageUrl.trim();
    if (hu) {
      const b = await fetchBytes(hu);
      if (b) header[section] = await embedBytesAsImage(pdf, b);
    }
    const fu = branding.footer[section];
    if (fu.mode === 'image' && fu.imageUrl.trim()) {
      const b = await fetchBytes(fu.imageUrl.trim());
      if (b) footer[section] = await embedBytesAsImage(pdf, b);
    }
  }

  return { header, footer };
}

export function drawPdfBrandingHeader(
  page: PDFPage,
  embedded: BrandingPdfEmbedded,
  headerBranding: BrandingSettings['header'],
  layout: { marginX: number; headerHeightPt: number }
): void {
  const { width, height } = page.getSize();
  const { marginX, headerHeightPt } = layout;
  const totalW = width - 2 * marginX;
  const colW = totalW / 3;

  BRANDING_SECTIONS.forEach((section, i) => {
    const slot = headerBranding[section];
    if (slot.mode !== 'image' || !slot.imageUrl.trim()) return;
    const img = embedded.header[section];
    if (!img) return;

    const x0 = marginX + i * colW;
    const maxW = colW - 8;
    const maxH = headerHeightPt - 10;
    const iw = img.width;
    const ih = img.height;
    const scale = Math.min(maxW / iw, maxH / ih, 1);
    const dw = iw * scale;
    const dh = ih * scale;
    const x = x0 + (colW - dw) / 2;
    const y = height - 4 - dh;
    page.drawImage(img, { x, y, width: dw, height: dh });
  });
}

function truncateText(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function drawPdfBrandingFooter(
  page: PDFPage,
  font: PDFFont,
  embedded: BrandingPdfEmbedded,
  footerBranding: BrandingSettings['footer'],
  layout: { marginX: number; footerHeightPt: number },
  meta: { pageIndex: number; pageCount: number; documentTitle: string }
): void {
  const { width } = page.getSize();
  const { marginX, footerHeightPt } = layout;
  const totalW = width - 2 * marginX;
  const colW = totalW / 3;
  const size = 8;
  const color = rgb(0.22, 0.22, 0.22);
  const baseY = 14;

  BRANDING_SECTIONS.forEach((section, i) => {
    const slot = footerBranding[section];
    const x0 = marginX + i * colW + 4;
    const maxW = colW - 8;

    if (slot.mode === 'title') {
      const text = truncateText((meta.documentTitle || '—').trim() || '—', 120);
      const lines: string[] = [];
      const words = text.split(/\s+/g).filter(Boolean);
      let line = '';
      words.forEach((w) => {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
        else {
          if (line) lines.push(line);
          line = w;
        }
      });
      if (line) lines.push(line);
      const show = lines.slice(0, 2);
      show.forEach((ln, idx) => {
        page.drawText(ln, { x: x0, y: baseY + idx * (size + 2), size, font, color });
      });
      return;
    }

    if (slot.mode === 'pagination') {
      const text = `Página ${meta.pageIndex} de ${meta.pageCount}`;
      const tw = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: marginX + i * colW + (colW - tw) / 2, y: baseY, size, font, color });
      return;
    }

    if (slot.mode === 'image' && slot.imageUrl.trim()) {
      const img = embedded.footer[section];
      if (!img) return;
      const maxWImg = colW - 8;
      const maxHImg = Math.min(footerHeightPt - 8, 36);
      const iw = img.width;
      const ih = img.height;
      const scale = Math.min(maxWImg / iw, maxHImg / ih, 1);
      const dw = iw * scale;
      const dh = ih * scale;
      const x = marginX + i * colW + (colW - dw) / 2;
      const y = baseY - 2;
      page.drawImage(img, { x, y, width: dw, height: dh });
    }
  });
}

export function applyBrandingToAllPdfLibPages(
  pdf: PDFDocument,
  font: PDFFont,
  embedded: BrandingPdfEmbedded,
  branding: BrandingSettings,
  documentTitle: string
): void {
  const pages = pdf.getPages();
  const n = pages.length;
  pages.forEach((p, idx) => {
    drawPdfBrandingHeader(p, embedded, branding.header, {
      marginX: 48,
      headerHeightPt: PDF_BRANDING_HEADER_HEIGHT_PT,
    });
    drawPdfBrandingFooter(p, font, embedded, branding.footer, { marginX: 48, footerHeightPt: PDF_BRANDING_FOOTER_HEIGHT_PT }, {
      pageIndex: idx + 1,
      pageCount: n,
      documentTitle,
    });
  });
}
