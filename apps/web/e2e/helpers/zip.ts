/**
 * Store-only zip writer for the e2e tests (F3-04, decision 8): it builds the archives the upload
 * tests need in memory, so no binary fixture is committed to the repository.
 *
 * Only method 0 (stored, no compression) is written, which is all the browser side needs to read
 * back: every entry carries its CRC-32 and its size twice, and the central directory closes the
 * file. `apps/web` never uses this at runtime — it is test scaffolding only.
 */

/** Table of the standard CRC-32 polynomial, built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** CRC-32 of the bytes, as the zip format stores it. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = ((crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** One file of the archive: its path inside the zip and its bytes. */
export interface ZipFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** Little-endian writer over a growing list of byte chunks. */
class Writer {
  private readonly chunks: Uint8Array[] = [];
  public length = 0;

  public push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  public u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  public u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  public toBytes(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** Header fields shared by the local header and the central directory entry. */
interface Meta {
  readonly name: Uint8Array;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
}

function writeLocalHeader(writer: Writer, meta: Meta): void {
  writer.u32(0x04034b50);
  writer.u16(20); // version needed
  writer.u16(0); // flags
  writer.u16(0); // method 0: stored
  writer.u16(0); // time
  writer.u16(0x21); // date: 1 January 1996, a valid MS-DOS date
  writer.u32(meta.crc);
  writer.u32(meta.size);
  writer.u32(meta.size);
  writer.u16(meta.name.length);
  writer.u16(0); // extra field length
  writer.push(meta.name);
}

function writeCentralEntry(writer: Writer, meta: Meta): void {
  writer.u32(0x02014b50);
  writer.u16(20); // version made by
  writer.u16(20); // version needed
  writer.u16(0);
  writer.u16(0);
  writer.u16(0);
  writer.u16(0x21);
  writer.u32(meta.crc);
  writer.u32(meta.size);
  writer.u32(meta.size);
  writer.u16(meta.name.length);
  writer.u16(0); // extra
  writer.u16(0); // comment
  writer.u16(0); // disk number
  writer.u16(0); // internal attributes
  writer.u32(0); // external attributes
  writer.u32(meta.offset);
  writer.push(meta.name);
}

/** A zip holding the given files, stored without compression. */
export function makeZip(files: readonly ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const body = new Writer();
  const metas: Meta[] = [];

  for (const file of files) {
    const meta: Meta = {
      name: encoder.encode(file.path),
      crc: crc32(file.bytes),
      size: file.bytes.length,
      offset: body.length,
    };
    metas.push(meta);
    writeLocalHeader(body, meta);
    body.push(file.bytes);
  }

  const directory = new Writer();
  for (const meta of metas) writeCentralEntry(directory, meta);

  const out = new Writer();
  out.push(body.toBytes());
  out.push(directory.toBytes());
  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(metas.length);
  out.u16(metas.length);
  out.u32(directory.length);
  out.u32(body.length);
  out.u16(0); // comment length
  return out.toBytes();
}

/** A zip of text files, the shape every test here needs. */
export function makeTextZip(files: Readonly<Record<string, string>>): Uint8Array {
  const encoder = new TextEncoder();
  return makeZip(
    Object.entries(files).map(([path, text]) => ({ path, bytes: encoder.encode(text) })),
  );
}
