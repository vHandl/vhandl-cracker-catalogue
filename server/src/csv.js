/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and line breaks inside quotes,
 * CRLF / LF / CR line endings and an optional UTF-8 BOM.
 * Returns an array of rows; each row is { line, cells } where `line` is the 1-based line number
 * in the file on which the row starts. Completely blank lines are skipped.
 */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      cell += ch;
    }
  }
  if (inQuotes) {
    const err = new Error('The CSV has an opening quote (") that is never closed.');
    err.csv = true;
    throw err;
  }
  if (cell !== '' || cells.length > 0) endRow();
  return rows;
}
