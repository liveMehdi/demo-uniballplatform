function escapeCsvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);

  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: (string | number | null)[][]): string {
  return (
    "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")
  );
}
