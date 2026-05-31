// Minimal ZIP writer using the "stored" (no compression) method.
// Avoids pulling in a third-party zip dependency for simple text bundles.

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  name: string;
  content: string;
}

/** Builds a ZIP archive (stored, no compression) from the given text files. */
export function createZip(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const records = files.map((file) => ({
    nameBytes: encoder.encode(file.name),
    data: encoder.encode(file.content),
  }));

  let size = 22; // End of central directory record.
  for (const record of records) {
    size += 30 + record.nameBytes.length + record.data.length; // Local header + name + data.
    size += 46 + record.nameBytes.length; // Central directory header + name.
  }

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const localOffsets: number[] = [];
  const crcs: number[] = [];

  for (const record of records) {
    const crc = crc32(record.data);
    crcs.push(crc);
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    offset += 4;
    view.setUint16(offset, 20, true); // Version needed.
    offset += 2;
    view.setUint16(offset, 0x0800, true); // Flags: UTF-8 filenames.
    offset += 2;
    view.setUint16(offset, 0, true); // Method: stored.
    offset += 2;
    view.setUint16(offset, 0, true); // Mod time.
    offset += 2;
    view.setUint16(offset, 0x21, true); // Mod date (1980-01-01).
    offset += 2;
    view.setUint32(offset, crc, true);
    offset += 4;
    view.setUint32(offset, record.data.length, true); // Compressed size.
    offset += 4;
    view.setUint32(offset, record.data.length, true); // Uncompressed size.
    offset += 4;
    view.setUint16(offset, record.nameBytes.length, true);
    offset += 2;
    view.setUint16(offset, 0, true); // Extra field length.
    offset += 2;
    bytes.set(record.nameBytes, offset);
    offset += record.nameBytes.length;
    bytes.set(record.data, offset);
    offset += record.data.length;
  }

  const centralStart = offset;
  records.forEach((record, index) => {
    view.setUint32(offset, 0x02014b50, true);
    offset += 4;
    view.setUint16(offset, 20, true); // Version made by.
    offset += 2;
    view.setUint16(offset, 20, true); // Version needed.
    offset += 2;
    view.setUint16(offset, 0x0800, true); // Flags.
    offset += 2;
    view.setUint16(offset, 0, true); // Method.
    offset += 2;
    view.setUint16(offset, 0, true); // Mod time.
    offset += 2;
    view.setUint16(offset, 0x21, true); // Mod date.
    offset += 2;
    view.setUint32(offset, crcs[index], true);
    offset += 4;
    view.setUint32(offset, record.data.length, true);
    offset += 4;
    view.setUint32(offset, record.data.length, true);
    offset += 4;
    view.setUint16(offset, record.nameBytes.length, true);
    offset += 2;
    view.setUint16(offset, 0, true); // Extra field length.
    offset += 2;
    view.setUint16(offset, 0, true); // Comment length.
    offset += 2;
    view.setUint16(offset, 0, true); // Disk number start.
    offset += 2;
    view.setUint16(offset, 0, true); // Internal attributes.
    offset += 2;
    view.setUint32(offset, 0, true); // External attributes.
    offset += 4;
    view.setUint32(offset, localOffsets[index], true); // Local header offset.
    offset += 4;
    bytes.set(record.nameBytes, offset);
    offset += record.nameBytes.length;
  });

  const centralSize = offset - centralStart;
  view.setUint32(offset, 0x06054b50, true);
  offset += 4;
  view.setUint16(offset, 0, true); // Disk number.
  offset += 2;
  view.setUint16(offset, 0, true); // Disk with central directory.
  offset += 2;
  view.setUint16(offset, records.length, true);
  offset += 2;
  view.setUint16(offset, records.length, true);
  offset += 2;
  view.setUint32(offset, centralSize, true);
  offset += 4;
  view.setUint32(offset, centralStart, true);
  offset += 4;
  view.setUint16(offset, 0, true); // Comment length.

  return new Blob([buffer], { type: "application/zip" });
}
