import html2pdf from 'html2pdf.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import {
  PDF_BRANDING_FOOTER_HEIGHT_PT,
  PDF_BRANDING_HEADER_HEIGHT_PT,
  applyBrandingToAllPdfLibPages,
  embedBrandingImagesForPdfLib,
} from '@/lib/pdfLibDocumentBranding';

/** Margens ABNT (NBR 14724) + faixa para Identidade Visual (cabeçalho/rodapé) — [top, left, bottom, right] em mm */
function abntMarginWithBrandingMm(): [number, number, number, number] {
  const topExtra = (PDF_BRANDING_HEADER_HEIGHT_PT * 25.4) / 72;
  const botExtra = (PDF_BRANDING_FOOTER_HEIGHT_PT * 25.4) / 72;
  return [30 + topExtra, 30, 20 + botExtra, 20];
}

export function sanitizeCurriculumPdfFileName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  return base || 'curriculo';
}

function createPrintableClone(source: HTMLElement): { node: HTMLElement; cleanup: () => void } {
  const clone = source.cloneNode(true) as HTMLElement;

  // Remove visual spacing from the dashboard card/session wrapper.
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.border = '0';
  clone.style.borderRadius = '0';
  clone.style.boxShadow = 'none';
  clone.style.background = '#ffffff';
  clone.style.width = '100%';
  clone.style.maxWidth = 'none';

  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-10000px';
  mount.style.top = '0';
  mount.style.width = '210mm';
  mount.style.background = '#ffffff';
  mount.style.padding = '0';
  mount.style.margin = '0';
  mount.appendChild(clone);
  document.body.appendChild(mount);

  return {
    node: clone,
    cleanup: () => {
      if (mount.parentNode) mount.parentNode.removeChild(mount);
    },
  };
}

/**
 * Gera PDF A4 vertical a partir do nó da pré-visualização do currículo.
 * Usa margens ABNT e respeita `break-inside: avoid` / classe `.cv-pdf-keep-together` via html2pdf.js.
 */
export async function exportCurriculumPreviewToPdf(element: HTMLElement, filename: string): Promise<void> {
  const { node, cleanup } = createPrintableClone(element);
  const worker = html2pdf().set({
    margin: abntMarginWithBrandingMm(),
    filename,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: ['.cv-pdf-keep-together'],
    },
  });

  try {
    const blob = await worker.from(node).outputPdf('blob');
    const pdfDoc = await PDFDocument.load(await blob.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const branding = await fetchDocumentBranding().catch(() => defaultBranding());
    const embedded = await embedBrandingImagesForPdfLib(pdfDoc, branding);
    applyBrandingToAllPdfLibPages(pdfDoc, font, embedded, branding, 'Currículo');
    const bytes = await pdfDoc.save();
    const finalBlob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    cleanup();
  }
}
