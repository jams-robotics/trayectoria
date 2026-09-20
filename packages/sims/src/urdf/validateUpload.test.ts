import { describe, expect, it } from 'vitest';

import { MAX_UPLOAD_SIZE_BYTES, validateUpload, type ZipEntry } from './validateUpload';

// Golden values of ticket F3-04. `validateUpload` runs before anything is decompressed, so every
// case here is expressed as the entry list plus the compressed size in bytes.

/** The entry list of a zip, as `listEntries` hands it over; sizes are irrelevant to these rules. */
function entries(...paths: readonly string[]): readonly ZipEntry[] {
  return paths.map((path) => ({ path, size_bytes: 1024 }));
}

const ONE_MEGABYTE_BYTES = 1024 * 1024;

describe('validateUpload (F3-04)', () => {
  it('accepts a URDF with its mesh and points at the URDF (golden: 1 MB)', () => {
    const result = validateUpload(entries('robot.urdf', 'meshes/base.stl'), ONE_MEGABYTE_BYTES);
    expect(result).toEqual({ ok: true, urdfPath: 'robot.urdf' });
  });

  it('rejects an entry that escapes the root with `..` (golden: urdf.pathTraversal)', () => {
    const result = validateUpload(entries('robot.urdf', '../x.stl'), ONE_MEGABYTE_BYTES);
    expect(result).toEqual({ ok: false, code: 'urdf.pathTraversal' });
  });

  it('rejects two URDF files (golden: urdf.multipleUrdf)', () => {
    const result = validateUpload(entries('a.urdf', 'b.urdf'), ONE_MEGABYTE_BYTES);
    expect(result).toEqual({ ok: false, code: 'urdf.multipleUrdf' });
  });

  it('rejects a xacro file (golden: urdf.xacroUnsupported)', () => {
    const result = validateUpload(entries('robot.xacro'), ONE_MEGABYTE_BYTES);
    expect(result).toEqual({ ok: false, code: 'urdf.xacroUnsupported' });
  });

  it('rejects one byte over the limit (golden: 20 971 521 bytes → urdf.tooLarge)', () => {
    const result = validateUpload(entries('robot.urdf'), MAX_UPLOAD_SIZE_BYTES + 1);
    expect(result).toEqual({ ok: false, code: 'urdf.tooLarge' });
  });

  it('accepts exactly the limit of 20 MB', () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(20_971_520);
    const result = validateUpload(entries('robot.urdf'), MAX_UPLOAD_SIZE_BYTES);
    expect(result).toEqual({ ok: true, urdfPath: 'robot.urdf' });
  });

  it('rejects an absolute path, with a slash or with a drive letter', () => {
    expect(validateUpload(entries('/robot.urdf'), 1024)).toEqual({
      ok: false,
      code: 'urdf.pathTraversal',
    });
    expect(validateUpload(entries('robot.urdf', 'C:/meshes/base.stl'), 1024)).toEqual({
      ok: false,
      code: 'urdf.pathTraversal',
    });
  });

  it('rejects a backslash separator', () => {
    expect(validateUpload(entries('robot.urdf', 'meshes\\base.stl'), 1024)).toEqual({
      ok: false,
      code: 'urdf.pathTraversal',
    });
  });

  it('rejects an extension outside the allowed list', () => {
    expect(validateUpload(entries('robot.urdf', 'notes.txt'), 1024)).toEqual({
      ok: false,
      code: 'urdf.badExtension',
    });
  });

  it('accepts every allowed mesh and texture extension, whatever the case', () => {
    const result = validateUpload(
      entries(
        'robot.urdf',
        'meshes/a.STL',
        'meshes/b.dae',
        'meshes/c.obj',
        'textures/d.png',
        'textures/e.jpg',
        'textures/f.jpeg',
      ),
      1024,
    );
    expect(result).toEqual({ ok: true, urdfPath: 'robot.urdf' });
  });

  it('ignores directories and the __MACOSX/ folder of macOS archives', () => {
    const result = validateUpload(
      [
        { path: 'meshes/', size_bytes: 0 },
        { path: '__MACOSX/', size_bytes: 0 },
        { path: '__MACOSX/._robot.urdf', size_bytes: 220 },
        { path: 'robot.urdf', size_bytes: 1024 },
      ],
      1024,
    );
    expect(result).toEqual({ ok: true, urdfPath: 'robot.urdf' });
  });

  it('rejects a zip with no URDF at all (golden: urdf.noUrdf, not multipleUrdf)', () => {
    expect(validateUpload(entries('meshes/base.stl'), 1024)).toEqual({
      ok: false,
      code: 'urdf.noUrdf',
    });
  });

  it('rejects two entries with the same path as duplicates', () => {
    const duplicated: readonly ZipEntry[] = [
      { path: 'robot.urdf', size_bytes: 100 },
      { path: 'robot.urdf', size_bytes: 100 },
    ];
    expect(validateUpload(duplicated, 1024)).toEqual({ ok: false, code: 'urdf.multipleUrdf' });
  });

  it('rejects an oversized total of uncompressed entries even when the zip itself is small', () => {
    const bombed: readonly ZipEntry[] = [
      { path: 'robot.urdf', size_bytes: MAX_UPLOAD_SIZE_BYTES + 1 },
    ];
    const result = validateUpload(bombed, 1024);
    expect(result).toEqual({ ok: false, code: 'urdf.tooLarge' });
  });

  it('checks the size before the entries, so an oversized zip is never inspected', () => {
    // Both rules would fire; the size wins because it is checked without reading the directory.
    const result = validateUpload(entries('../x.stl'), MAX_UPLOAD_SIZE_BYTES + 1);
    expect(result).toEqual({ ok: false, code: 'urdf.tooLarge' });
  });
});
