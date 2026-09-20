import { describe, expect, it } from 'vitest';

import { CSV_BOM, CSV_HEADER, csvEscape, fileName, toCsv, type CsvRecord } from './csv';

const RECORD: CsvRecord = {
  studentName: 'Ana',
  topicId: 'ruta-1/m00-t01',
  status: 'completed',
  bestScore: 1,
  attempts: 1,
  completedAt: '2026-09-19T10:00:00.000Z',
};

/** The data lines of the file, without the BOM and without the header. */
function dataLines(csv: string): string[] {
  return csv
    .slice(CSV_BOM.length)
    .split('\r\n')
    .slice(1)
    .filter((line) => line !== '');
}

describe('csvEscape (F3-02b)', () => {
  it('F3-02b golden: quotes a field with a comma and doubles its quotes', () => {
    expect(csvEscape('Ana, "la" 1')).toBe('"Ana, ""la"" 1"');
  });

  it('F3-02b golden: leaves a plain field alone', () => {
    expect(csvEscape('Luis')).toBe('Luis');
  });

  it('quotes a field with a line break or a lone quote', () => {
    expect(csvEscape('a\nb')).toBe('"a\nb"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape('')).toBe('');
  });
});

describe('toCsv (F3-02b)', () => {
  it('starts with the BOM and the exact header, and ends every line with CRLF', () => {
    const csv = toCsv([RECORD]);

    expect(csv.startsWith(`${CSV_BOM}${CSV_HEADER}\r\n`)).toBe(true);
    expect(CSV_HEADER).toBe('estudiante,tema,estado,mejor_puntuacion,intentos,completado_en');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes the completed record with two decimals and the ISO date', () => {
    expect(dataLines(toCsv([RECORD]))).toEqual([
      'Ana,ruta-1/m00-t01,completado,1.00,1,2026-09-19T10:00:00.000Z',
    ]);
  });

  it('writes the Spanish state of every status and leaves null fields empty', () => {
    const csv = toCsv([
      { ...RECORD, status: 'pending', bestScore: null, attempts: 0, completedAt: null },
      { ...RECORD, status: 'in_progress', bestScore: 0.5, attempts: 2, completedAt: null },
    ]);

    expect(dataLines(csv)).toEqual([
      'Ana,ruta-1/m00-t01,pendiente,,0,',
      'Ana,ruta-1/m00-t01,en_curso,0.50,2,',
    ]);
  });

  it('escapes a student name with commas and quotes', () => {
    const csv = toCsv([{ ...RECORD, studentName: 'Ana, "la" 1' }]);

    expect(dataLines(csv)[0]).toBe(
      '"Ana, ""la"" 1",ruta-1/m00-t01,completado,1.00,1,2026-09-19T10:00:00.000Z',
    );
  });

  it('with no records it is only the BOM and the header', () => {
    expect(toCsv([])).toBe(`${CSV_BOM}${CSV_HEADER}\r\n`);
  });
});

/** Noon of a local calendar day: the day the teacher sees, whatever the time zone. */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe('fileName (F3-02b)', () => {
  it('F3-02b golden: "Física 3ºA" on 2026-09-19 becomes progreso-fisica-3a-2026-09-19.csv', () => {
    expect(fileName('Física 3ºA', localNoon(2026, 9, 19))).toBe(
      'progreso-fisica-3a-2026-09-19.csv',
    );
  });

  it('collapses separators and drops accents and punctuation', () => {
    expect(fileName('  Mecatrónica 2026-2 · A  ', localNoon(2026, 1, 5))).toBe(
      'progreso-mecatronica-2026-2-a-2026-01-05.csv',
    );
  });

  it('falls back to "grupo" when the name has no usable characters', () => {
    expect(fileName('···', localNoon(2026, 9, 19))).toBe('progreso-grupo-2026-09-19.csv');
  });

  it('takes the calendar day of the browser, not of UTC', () => {
    const lastMinute = new Date(2026, 8, 19, 23, 59, 59);

    expect(fileName('Grupo', lastMinute)).toBe('progreso-grupo-2026-09-19.csv');
  });
});
