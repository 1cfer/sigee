import { expect, it } from 'vitest';
import { serializeCSV } from './export';

it('exporta CSV con acentos, separadores, comillas y protección de fórmulas', () => {
  const csv = serializeCSV(
    ['Título', 'Cantidad'],
    [
      ['Texto "ficticio"; revisión', 2],
      ['=SUM(A1:A2)', 3],
      ['  +1', 4],
    ],
  );
  expect(csv).toBe(
    '\uFEFF"Título";"Cantidad"\r\n"Texto ""ficticio""; revisión";"2"\r\n"\'=SUM(A1:A2)";"3"\r\n"\'  +1";"4"',
  );
});
