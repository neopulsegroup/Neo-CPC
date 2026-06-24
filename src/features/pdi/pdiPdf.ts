import type { PdiDoc } from '@/lib/pdi/types';

type TGetter = { get: (key: string, params?: Record<string, string>) => string };

export async function downloadPdiPdf(
  pdi: PdiDoc,
  trailTitles: Map<string, string>,
  t: TGetter
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595, 842];
  const margin = 48;
  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawLine = (text: string, bold = false) => {
    if (y < margin + 20) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
    page.drawText(text, {
      x: margin,
      y,
      size: bold ? 12 : 10,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= bold ? 18 : 14;
  };

  drawLine(t.get('pdi.migrant.title'), true);
  drawLine(`${t.get('pdi.fields.version')}: ${pdi.version}`);
  drawLine(`${t.get('pdi.fields.status')}: ${t.get(`pdi.status.${pdi.status}`)}`);
  drawLine(
    `${t.get('pdi.fields.scoreGlobal')}: ${pdi.score_global?.toFixed(2) ?? '—'} → ${pdi.target_global?.toFixed(2) ?? '—'}`
  );
  y -= 8;

  drawLine(t.get('pdi.sections.trilhas'), true);
  for (const tr of pdi.trilhas.filter((x) => x.recommended_state !== 'NAO_INCLUIDA')) {
    drawLine(
      `• ${trailTitles.get(tr.trail_id) ?? tr.trail_id} — ${t.get(`pdi.trailState.${tr.recommended_state}`)}`
    );
  }

  y -= 8;
  drawLine(t.get('pdi.sections.apoios'), true);
  for (const a of pdi.apoios) {
    drawLine(`• ${t.get(`pdi.apoios.${a.type}`)}${a.notes ? `: ${a.notes}` : ''}`);
  }

  if (pdi.notes) {
    y -= 8;
    drawLine(t.get('pdi.sections.objetivos'), true);
    drawLine(pdi.notes);
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PDI_v${pdi.version}_${pdi.participant_id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
