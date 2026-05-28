import type { BrandingSettings } from '@/lib/documentBranding';
import { BRANDING_SECTIONS } from '@/lib/documentBranding';
import { resolveBrandingAssetUrl } from '@/lib/pdfLibDocumentBranding';

export function escapeHtmlForPrint(s: string): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Uma linha de tabela (`<tr>...</tr>`) com três células para cabeçalho de impressão. */
export function buildPrintBrandingHeaderRowHtml(branding: BrandingSettings): string {
  const cells = BRANDING_SECTIONS.map((section) => {
    const slot = branding.header[section];
    if (slot.mode === 'image' && slot.imageUrl.trim()) {
      const src = escapeHtmlForPrint(resolveBrandingAssetUrl(slot.imageUrl.trim()));
      return `<td style="width:33.33%;text-align:center;vertical-align:middle;padding:6px;border:none"><img src="${src}" style="max-height:56px;max-width:100%;object-fit:contain" alt="" crossorigin="anonymous" /></td>`;
    }
    return `<td style="width:33.33%;border:none"></td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

/** Cabeçalho de identidade visual numa única linha que ocupa todas as colunas da tabela de dados. */
export function buildPrintBrandingHeaderWrappedRowHtml(branding: BrandingSettings, colspan: number): string {
  const c = Math.max(1, colspan);
  return `<tr><td colspan="${c}" style="padding:0;border:none;vertical-align:top"><table style="width:100%;border-collapse:collapse;margin:0">${buildPrintBrandingHeaderRowHtml(
    branding
  )}</table></td></tr>`;
}

/** Rodapé de identidade visual numa única linha que ocupa todas as colunas da tabela de dados. */
export function buildPrintBrandingFooterWrappedRowHtml(branding: BrandingSettings, documentTitle: string, colspan: number): string {
  const c = Math.max(1, colspan);
  return `<tr><td colspan="${c}" style="padding:0;border:none;vertical-align:top"><table style="width:100%;border-collapse:collapse;margin:0">${buildPrintBrandingFooterRowHtml(
    branding,
    documentTitle
  )}</table></td></tr>`;
}

/** Uma linha de tabela (`<tr>...</tr>`) para rodapé de impressão (título / imagem / paginação). */
export function buildPrintBrandingFooterRowHtml(branding: BrandingSettings, documentTitle: string): string {
  const title = escapeHtmlForPrint((documentTitle || '—').trim() || '—');
  const cells = BRANDING_SECTIONS.map((section) => {
    const slot = branding.footer[section];
    if (slot.mode === 'title') {
      return `<td style="width:33.33%;vertical-align:middle;padding:6px;font-size:11px;border:none">${title}</td>`;
    }
    if (slot.mode === 'pagination') {
      return `<td style="width:33.33%;text-align:center;vertical-align:middle;padding:6px;font-size:11px;border:none">Paginação ao imprimir</td>`;
    }
    if (slot.mode === 'image' && slot.imageUrl.trim()) {
      const src = escapeHtmlForPrint(resolveBrandingAssetUrl(slot.imageUrl.trim()));
      return `<td style="width:33.33%;text-align:center;vertical-align:middle;padding:6px;border:none"><img src="${src}" style="max-height:40px;max-width:100%;object-fit:contain" alt="" crossorigin="anonymous" /></td>`;
    }
    return `<td style="width:33.33%;border:none"></td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

export function printBrandingStylesCss(): string {
  return `
    .doc-branding-print-header, .doc-branding-print-footer { width: 100%; border-collapse: collapse; margin: 0; }
    .doc-branding-print-header { border-bottom: 1px solid #e5e7eb; margin-bottom: 12px; }
    .doc-branding-print-footer { border-top: 1px solid #e5e7eb; margin-top: 12px; }
    @media print {
      .doc-branding-print-header thead { display: table-header-group; }
      .doc-branding-print-footer tfoot { display: table-footer-group; }
    }
  `;
}
