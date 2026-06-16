/**
 * T-02 (Bloco 4) · Branding mínimo para exports XLSX e DOCX.
 *
 * Os exports em **PDF** já têm header+footer com logos via
 * `applyBrandingToAllPdfLibPages` (ver `src/lib/pdfLibDocumentBranding.ts`).
 *
 * Para XLSX e DOCX o suporte a imagens é mais complexo (SheetJS Community
 * não embute imagens; `docx` aceita imagens mas precisa de bytes da imagem
 * pré-fetched). Para a primeira ronda, aplicamos texto identificativo:
 *
 *   - **XLSX**: 2 rows extra no topo (organização + título) + 1 row no fim.
 *   - **DOCX**: `headers` e `footers` text-only no Section.
 *
 * Imagens binárias podem ser adicionadas mais tarde sem alterar a API destes
 * helpers.
 */

const BRAND_ORG = 'CPC — Conexão Pessoas & Companhias';
const BRAND_TAGLINE = 'Plataforma EMPIS · CIBEA';

/**
 * Prepend de 3 rows (org / tagline / blank) ao topo de um AOA antes de
 * `XLSX.utils.aoa_to_sheet`. Append de 1 row de assinatura no fim.
 */
export function withSheetBranding(
  aoa: string[][],
  args: { title: string; generatedAtIso?: string } = { title: '' }
): string[][] {
  const generatedAt = args.generatedAtIso ?? new Date().toISOString().slice(0, 10);
  const top: string[][] = [
    [BRAND_ORG],
    [BRAND_TAGLINE],
    args.title ? [args.title] : [''],
    [`Gerado em ${generatedAt}`],
    [''],
  ];
  const footer: string[][] = [[''], [`${BRAND_ORG} · ${BRAND_TAGLINE}`]];
  return [...top, ...aoa, ...footer];
}

/**
 * Constrói os objectos `headers` e `footers` para `Section` da lib `docx`,
 * sem depender do tipo da lib (dependência opcional / lazy). O caller passa
 * o módulo `docx` já importado.
 */
export function buildDocxBrandingSections(
  docx: typeof import('docx')
): { headers: import('docx').IHeaderOptions; footers: import('docx').IFooterOptions } {
  const { AlignmentType, Footer, Header, Paragraph, TextRun } = docx;
  return {
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: BRAND_ORG, bold: true, size: 18 })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: BRAND_TAGLINE, italics: true, size: 16 })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${BRAND_ORG} · ${BRAND_TAGLINE}`, size: 14, color: '666666' })],
          }),
        ],
      }),
    },
  };
}

export const EXPORT_BRANDING_ORG = BRAND_ORG;
export const EXPORT_BRANDING_TAGLINE = BRAND_TAGLINE;
