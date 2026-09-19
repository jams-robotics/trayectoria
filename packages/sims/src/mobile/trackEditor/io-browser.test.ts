import { describe, expect, test, vi } from 'vitest';

import { TRACK_FILE_NAME, downloadJson, readFileText } from './io-browser';

// F4-01b, decisión 6 de #126: `packages/sims` no puede usar `window`, así que la descarga vive
// aquí sobre `Blob`, `URL.createObjectURL` y `document.createElement('a')`, con el disparador
// inyectable para poder probarlo sin navegación real.
describe('io-browser (F4-01b)', () => {
  test('downloads the JSON as pista.json and releases the object URL', () => {
    const clicked: HTMLAnchorElement[] = [];
    const created: string[] = [];
    const revoked: string[] = [];
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        created.push(blob instanceof Blob ? 'blob' : 'other');
        return 'blob:pista';
      });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revoked.push(url);
    });

    downloadJson('{"segments":[],"lineWidth_m":0.02}', (anchor) => {
      clicked.push(anchor);
    });

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe(TRACK_FILE_NAME);
    expect(clicked[0]?.href).toContain('blob:pista');
    expect(created).toEqual(['blob']);
    expect(revoked).toEqual(['blob:pista']);
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  test('the default trigger clicks the anchor', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pista');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadJson('{}');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  test('reads the text of a picked file', async () => {
    const file = new File(['{"segments":[]}'], 'pista.json', { type: 'application/json' });
    await expect(readFileText(file)).resolves.toBe('{"segments":[]}');
  });
});
