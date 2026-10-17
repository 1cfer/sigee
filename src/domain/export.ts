export function serializeCSV(headers: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    // Evitar fórmulas ejecutables al abrir el CSV en una hoja de cálculo.
    const raw = String(value);
    const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = serializeCSV(headers, rows);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
