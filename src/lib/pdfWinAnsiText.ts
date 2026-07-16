/** Texto seguro para StandardFonts (WinAnsi) no pdf-lib. */
export const PDF_TEXT_FALLBACK = '-';

export function sanitizeForPdfText(text: string): string {
  return String(text ?? '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/→/g, '->')
    .replace(/—/g, '-')
    .replace(/•/g, '-')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
