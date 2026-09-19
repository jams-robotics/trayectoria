import { describe, expect, test } from 'vitest';

import { parseReferences, resolveReferences } from './references';

// Golden values read from docs/REFERENCES.md (#97, decision 2): the table is `| clave |
// referencia |` and a row starting with "Ídem." repeats the work of the previous row.
const TABLE = `# Referencias

| Clave | Referencia |
|---|---|
| young-freedman-1 | Young, H. D. y Freedman, R. A. *Física universitaria*, vol. 1. Cap. 1, "Unidades, cantidades físicas y vectores". |
| young-freedman-2 | Ídem. Cap. 2, "Movimiento rectilíneo". |
| siegwart-3 | Siegwart, R. *Introduction to Autonomous Mobile Robots*, 2.ª ed. Cap. 3, "Mobile Robot Kinematics". |
`;

describe('F2-13 references', () => {
  const table = parseReferences(TABLE);

  test('reads every key of the table', () => {
    expect([...table.keys()]).toEqual(['young-freedman-1', 'young-freedman-2', 'siegwart-3']);
  });

  test('keeps the full text of a row that names its work', () => {
    expect(table.get('young-freedman-1')).toBe(
      'Young, H. D. y Freedman, R. A. *Física universitaria*, vol. 1. Cap. 1, "Unidades, cantidades físicas y vectores".',
    );
  });

  test('resolves «Ídem.» with the work of the previous row', () => {
    expect(table.get('young-freedman-2')).toBe(
      'Young, H. D. y Freedman, R. A. *Física universitaria*, vol. 1. Cap. 2, "Movimiento rectilíneo".',
    );
  });

  test('a row after an «Ídem.» starts a new work', () => {
    expect(table.get('siegwart-3')).toBe(
      'Siegwart, R. *Introduction to Autonomous Mobile Robots*, 2.ª ed. Cap. 3, "Mobile Robot Kinematics".',
    );
  });

  test('resolveReferences returns the entries in the order they are asked for', () => {
    expect(resolveReferences(['siegwart-3', 'young-freedman-2'], 'ruta-1/m00-t01', table)).toEqual([
      { key: 'siegwart-3', text: table.get('siegwart-3') },
      { key: 'young-freedman-2', text: table.get('young-freedman-2') },
    ]);
  });

  test('an unknown key fails the build naming the topic and the key', () => {
    expect(() => resolveReferences(['no-existe'], 'ruta-1/m00-t01', table)).toThrow(
      'ruta-1/m00-t01: unknown reference key "no-existe" (docs/REFERENCES.md)',
    );
  });

  test('every key of docs/REFERENCES.md resolves without «Ídem.»', () => {
    const real = parseReferences(undefined);
    expect(real.size).toBeGreaterThan(0);
    for (const text of real.values()) expect(text.startsWith('Ídem.')).toBe(false);
  });
});
