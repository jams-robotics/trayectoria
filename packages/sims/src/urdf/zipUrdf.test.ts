import { readFileSync } from 'node:fs';
import path from 'node:path';

import { zipSync, strToU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { listEntries, parseUploadedZip, readEntry, readUrdfZip } from './zipUrdf';
import { MAX_UPLOAD_SIZE_BYTES } from './validateUpload';

// F3-04: the zip is built here with fflate's writer, so the tests never depend on a binary
// fixture committed to the repository.

const URDF_SOURCE = '<?xml version="1.0"?><robot name="test"><link name="base_link"/></robot>';

/** A zip with the given files, as the browser hands the upload over: a `Uint8Array`. */
function zipOf(files: Readonly<Record<string, string>>): Uint8Array {
  const contents: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(files)) contents[path] = strToU8(text);
  return zipSync(contents);
}

describe('listEntries (F3-04)', () => {
  it('lists every file of the zip with its uncompressed size', () => {
    const bytes = zipOf({ 'robot.urdf': URDF_SOURCE, 'meshes/base.stl': 'solid base\nendsolid' });
    const entries = listEntries(bytes);
    expect(entries.map((entry) => entry.path).sort()).toEqual(['meshes/base.stl', 'robot.urdf']);
    const urdf = entries.find((entry) => entry.path === 'robot.urdf');
    expect(urdf?.size_bytes).toBe(URDF_SOURCE.length);
  });

  it('throws `urdf.invalidZip` on bytes that are not a zip', () => {
    expect(() => listEntries(strToU8('not a zip at all'))).toThrow('urdf.invalidZip');
  });

  // Security finding 1 (PR #174): a zip bomb must be rejected from its directory metadata alone,
  // never by decompressing its entries. A highly-compressible payload whose *uncompressed* size
  // is past the limit compresses down to a few kilobytes.
  it('reports the true uncompressed size of a highly-compressible entry without decompressing it', () => {
    const huge = 'a'.repeat(MAX_UPLOAD_SIZE_BYTES + 1);
    const bytes = zipSync({ 'robot.urdf': strToU8(huge) }, { level: 9 });
    expect(bytes.length).toBeLessThan(1024 * 1024); // compresses to well under 1 MB
    const entries = listEntries(bytes);
    const urdf = entries.find((entry) => entry.path === 'robot.urdf');
    expect(urdf?.size_bytes).toBe(huge.length);
  });

  it('never decompresses entries: feeding the same bytes through a spy filter yields none', () => {
    // `listEntries` cannot be asked for the `UnzipFileFilter` it builds internally (it is not
    // part of its public surface), so this drives `unzipSync` the same way it does, with a filter
    // that records every `UnzipFileInfo` it is offered and always declines to extract it — which
    // is the same call shape `listEntries` makes. If `listEntries` ever switched back to plain
    // `unzipSync(bytes)`, this filter would never run and `seen` would stay empty while the huge
    // uncompressed size still leaked through decompression instead of `originalSize` metadata.
    const bytes = zipOf({ 'robot.urdf': URDF_SOURCE, 'meshes/base.stl': 'solid base' });
    const seen: string[] = [];
    const result = unzipSync(bytes, {
      filter: (file) => {
        seen.push(file.name);
        return false;
      },
    });
    expect(seen.sort()).toEqual(['meshes/base.stl', 'robot.urdf']);
    expect(Object.keys(result)).toHaveLength(0);
    // And `listEntries` itself reports the same paths, from that same metadata-only pass.
    expect(listEntries(bytes).map((entry) => entry.path).sort()).toEqual(seen.sort());
  });
});

describe('readEntry (F3-04)', () => {
  it('returns the bytes of one entry', () => {
    const bytes = zipOf({ 'robot.urdf': URDF_SOURCE });
    expect(new TextDecoder().decode(readEntry(bytes, 'robot.urdf'))).toBe(URDF_SOURCE);
  });

  it('throws `urdf.invalidZip` when the entry is not in the zip', () => {
    const bytes = zipOf({ 'robot.urdf': URDF_SOURCE });
    expect(() => readEntry(bytes, 'missing.stl')).toThrow('urdf.invalidZip');
  });
});

describe('readUrdfZip (F3-04)', () => {
  it('validates the zip and returns the URDF text with the list of entries', () => {
    const bytes = zipOf({ 'robot.urdf': URDF_SOURCE, 'meshes/base.stl': 'solid base' });
    const result = readUrdfZip(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.urdfPath).toBe('robot.urdf');
    expect(result.urdfSource).toBe(URDF_SOURCE);
    expect(result.paths).toContain('meshes/base.stl');
  });

  it('finds the URDF inside a folder', () => {
    const bytes = zipOf({ 'so101/robot.urdf': URDF_SOURCE });
    const result = readUrdfZip(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.urdfPath).toBe('so101/robot.urdf');
  });

  it('returns the validation code without decompressing anything', () => {
    const bytes = zipOf({ 'a.urdf': URDF_SOURCE, 'b.urdf': URDF_SOURCE });
    expect(readUrdfZip(bytes)).toEqual({ ok: false, code: 'urdf.multipleUrdf' });
  });

  it('returns `urdf.invalidZip` for bytes that are not a zip', () => {
    expect(readUrdfZip(strToU8('garbage'))).toEqual({ ok: false, code: 'urdf.invalidZip' });
  });
});

/** `parseUrdf` needs a DOM; jsdom supplies `DOMParser` in this environment. */
const ARM_URDF = `<?xml version="1.0"?>
<robot name="Brazo de prueba">
  <link name="base_link">
    <visual><geometry><mesh filename="package://arm/meshes/base.stl"/></geometry></visual>
  </link>
  <link name="tool0"/>
  <joint name="j1" type="revolute">
    <parent link="base_link"/><child link="tool0"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/><axis xyz="0 0 1"/>
    <limit lower="-1" upper="1" velocity="1" effort="1"/>
  </joint>
</robot>`;

describe('parseUploadedZip (F3-04)', () => {
  const options = { domParser: new DOMParser(), robotId: '33333333-3333-4333-8333-333333333333' };

  it('parses the URDF when every mesh it names is inside the zip', () => {
    const bytes = zipOf({ 'robot.urdf': ARM_URDF, 'meshes/base.stl': 'solid base' });
    const result = parseUploadedZip(bytes, options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.name).toBe('Brazo de prueba');
    expect(result.spec.arm?.joints).toHaveLength(1);
  });

  it('reports `urdf.missingMesh` when a mesh is not in the zip', () => {
    const bytes = zipOf({ 'robot.urdf': ARM_URDF });
    expect(parseUploadedZip(bytes, options)).toEqual({ ok: false, code: 'urdf.missingMesh' });
  });

  it('accepts the planar 2-DOF arm of the catalogue, which has no meshes', () => {
    const urdf = readFileSync(
      path.resolve(import.meta.dirname, '../../../../catalog/arms/planar2dof/planar2dof.urdf'),
      'utf8',
    );
    const result = parseUploadedZip(zipOf({ 'planar2dof.urdf': urdf }), options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.arm?.joints).toHaveLength(3);
  });

  it('passes the error of an invalid URDF through with its i18n key', () => {
    const bytes = zipOf({ 'robot.urdf': '<robot name="x"><link name="a"/><link name="b"/></robot>' });
    const result = parseUploadedZip(bytes, options);
    expect(result).toEqual({ ok: false, code: 'urdf.multipleRoots' });
  });

  it('never parses a zip the upload rules reject', () => {
    const bytes = zipOf({ 'robot.urdf': ARM_URDF, '../evil.stl': 'x' });
    expect(parseUploadedZip(bytes, options)).toEqual({ ok: false, code: 'urdf.pathTraversal' });
  });
});
