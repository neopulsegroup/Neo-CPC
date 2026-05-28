export function escapeHtmlForMessagesExport(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMessageExportDate(value: unknown, locale: string): string {
  if (!value) return '—';
  try {
    if (value instanceof Date) return value.toLocaleString(locale);
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale);
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      const d = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale);
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      const d = new Date((value as { seconds: number }).seconds * 1000);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale);
    }
  } catch {
    return '—';
  }
  return '—';
}

export function buildCpcMessagesPrintHtml(args: {
  documentTitle: string;
  intro: string;
  tableCaption: string;
  conversationHeaders: string[];
  conversationRows: string[][];
  messagesSectionTitle: string;
  messagesNote: string;
  messageHeaders: string[];
  messageRows: string[][];
}): string {
  const th = (labels: string[]) => labels.map((h) => `<th>${escapeHtmlForMessagesExport(h)}</th>`).join('');
  const trs = (rows: string[][]) =>
    rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeHtmlForMessagesExport(String(cell ?? ''))}</td>`).join('')}</tr>`
      )
      .join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlForMessagesExport(args.documentTitle)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .intro { font-size: 13px; color: #555; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    caption { text-align: left; font-weight: 600; margin-bottom: 8px; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    .note { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    @media print { @page { margin: 14mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtmlForMessagesExport(args.documentTitle)}</h1>
  <p class="intro">${escapeHtmlForMessagesExport(args.intro)}</p>
  <table>
    <caption>${escapeHtmlForMessagesExport(args.tableCaption)}</caption>
    <thead><tr>${th(args.conversationHeaders)}</tr></thead>
    <tbody>${trs(args.conversationRows)}</tbody>
  </table>
  <h2>${escapeHtmlForMessagesExport(args.messagesSectionTitle)}</h2>
  <p class="note">${escapeHtmlForMessagesExport(args.messagesNote)}</p>
  <table>
    <thead><tr>${th(args.messageHeaders)}</tr></thead>
    <tbody>${trs(args.messageRows)}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body>
</html>`;
}

export function buildCpcMessagesXlsx(
  XLSX: typeof import('xlsx'),
  args: {
    conversationsSheetName: string;
    conversationHeaders: string[];
    conversationRows: string[][];
    messagesSheetName: string;
    messageHeaders: string[];
    messageRows: string[][];
  }
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const convAoa = [args.conversationHeaders, ...args.conversationRows];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(convAoa), args.conversationsSheetName.slice(0, 31));
  const msgAoa = [args.messageHeaders, ...args.messageRows];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(msgAoa), args.messagesSheetName.slice(0, 31));
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export async function buildCpcMessagesDocx(
  docx: typeof import('docx'),
  args: {
    title: string;
    paragraphs: string[];
    conversationHeaders: string[];
    conversationRows: string[][];
    messagesHeading: string;
    messageHeaders: string[];
    messageRows: string[][];
  }
): Promise<Blob> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = docx;

  const mkTable = (headers: string[], rows: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
              })
          ),
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: r.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ text: String(c ?? '') })],
                  })
              ),
            })
        ),
      ],
    });

  const titlePara = new Paragraph({
    text: args.title,
    heading: HeadingLevel.HEADING_1,
  });

  const introParas = args.paragraphs.map((p) => new Paragraph({ text: p }));

  const convTable = mkTable(args.conversationHeaders, args.conversationRows);
  const msgHeading = new Paragraph({ text: args.messagesHeading, heading: HeadingLevel.HEADING_2 });
  const msgTable = mkTable(args.messageHeaders, args.messageRows);

  const doc = new Document({
    sections: [
      {
        children: [
          titlePara,
          ...introParas,
          new Paragraph({ text: '' }),
          convTable,
          new Paragraph({ text: '' }),
          msgHeading,
          msgTable,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'CPC', bold: true })],
          }),
        ],
      },
    ],
  });

  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const packer = Packer as unknown as {
    toBlob?: (d: unknown) => Promise<Blob>;
    toArrayBuffer?: (d: unknown) => Promise<ArrayBuffer>;
    toBuffer?: (d: unknown) => Promise<Uint8Array>;
    toBase64String?: (d: unknown) => Promise<string>;
  };

  if (typeof packer.toBlob === 'function') {
    const blob = await packer.toBlob(doc);
    return blob.type ? blob : new Blob([await new Response(blob).arrayBuffer()], { type: mime });
  }
  if (typeof packer.toArrayBuffer === 'function') {
    const ab = await packer.toArrayBuffer(doc);
    return new Blob([ab], { type: mime });
  }
  if (typeof packer.toBuffer === 'function') {
    const buf = await packer.toBuffer(doc);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Blob([ab], { type: mime });
  }
  if (typeof packer.toBase64String === 'function') {
    const b64 = await packer.toBase64String(doc);
    const atobFn = typeof globalThis.atob === 'function' ? globalThis.atob.bind(globalThis) : null;
    if (atobFn) {
      const bin = atobFn(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
      return new Blob([arr.buffer], { type: mime });
    }
  }
  throw new Error('DOCX export unavailable.');
}
