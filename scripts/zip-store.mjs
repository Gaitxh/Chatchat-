// Small, deterministic ZIP32 writer. Stored entries need no compression dependency.
export const ZIP_LIMITS = Object.freeze({ files: 4096, fileBytes: 32 * 1024 * 1024, totalBytes: 128 * 1024 * 1024, depth: 24 });

export function assertSafePath(name) {
  if (typeof name !== "string" || !name || Buffer.byteLength(name) > 240 || /[\\\x00-\x1f\x7f<>:"|?*]/u.test(name)) {
    throw new Error("Unsafe archive path");
  }
  const parts = name.split("/");
  if (parts.length > ZIP_LIMITS.depth || parts.some((part) => !part || part === "." || part === ".." || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error("Unsafe archive path");
  }
  return name;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function createStoredZip(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > ZIP_LIMITS.files) throw new Error("ZIP file count limit");
  let total = 0;
  const names = new Set();
  const files = entries.map(({ name, data }) => {
    assertSafePath(name);
    const key = name.normalize("NFC").toLowerCase();
    if (names.has(key)) throw new Error("Duplicate archive path");
    names.add(key);
    if (!Buffer.isBuffer(data) || data.length > ZIP_LIMITS.fileBytes) throw new Error("ZIP file size limit");
    total += data.length;
    if (total > ZIP_LIMITS.totalBytes) throw new Error("ZIP total size limit");
    return { name, data };
  }).sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
  for (const { name } of files) {
    const parts = name.normalize("NFC").toLowerCase().split("/");
    parts.pop();
    while (parts.length) {
      if (names.has(parts.join("/"))) throw new Error("Archive file/directory collision");
      parts.pop();
    }
  }

  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const encoded = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // ZIP 2.0
    header.writeUInt16LE(0x0800, 6); // UTF-8; method 0 (stored)
    header.writeUInt16LE(0x0021, 12); // 1980-01-01; no environment-dependent times
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(encoded.length, 26);
    local.push(header, encoded, data);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4); // DOS origin; no host permissions or user metadata
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(0x0021, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(encoded.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, encoded);
    offset += header.length + encoded.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}
