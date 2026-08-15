import fs from "node:fs";
import zlib from "node:zlib";

const files = process.argv.slice(2);
if (!files.length) throw new Error("Usage: node scripts/check-png-content.mjs <png> [...png]");

for (const file of files) {
  const metrics = inspectPng(fs.readFileSync(file));
  const enoughColors = metrics.uniqueSampledColors >= 32;
  const enoughRange = metrics.channelRange >= 24;
  const enoughVariance = metrics.lumaStdDev >= 4;
  if (!enoughColors || !enoughRange || !enoughVariance) {
    throw new Error(
      `Screenshot looks blank or visually empty: ${file} `
      + `(sampledColors=${metrics.uniqueSampledColors}, channelRange=${metrics.channelRange}, lumaStdDev=${metrics.lumaStdDev.toFixed(2)}).`,
    );
  }
  console.log(
    `✓ screenshot has real visual content: ${file} `
    + `(${metrics.width}x${metrics.height}, sampledColors=${metrics.uniqueSampledColors}, `
    + `channelRange=${metrics.channelRange}, lumaStdDev=${metrics.lumaStdDev.toFixed(2)})`,
  );
}

function inspectPng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Not a PNG file.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error("Truncated PNG chunk.");
    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === "IDAT") {
      idat.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") break;
    offset = dataEnd + 4;
  }

  if (!width || !height || !idat.length) throw new Error("PNG is missing IHDR/IDAT data.");
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected Chromium 8-bit output.`);
  if (interlace !== 0) throw new Error("Interlaced PNG screenshots are not supported by this deterministic content check.");
  const bytesPerPixel = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!bytesPerPixel) throw new Error(`Unsupported PNG color type ${colorType}; expected grayscale/RGB/RGBA Chromium output.`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bytesPerPixel;
  const expected = height * (stride + 1);
  if (raw.length !== expected) throw new Error(`Unexpected decompressed PNG size ${raw.length}; expected ${expected}.`);

  let previous = Buffer.alloc(stride);
  const colors = new Set();
  const sampleEvery = Math.max(1, Math.floor((width * height) / 60000));
  let pixelIndex = 0;
  let samples = 0;
  let mean = 0;
  let m2 = 0;
  let minChannel = 255;
  let maxChannel = 0;
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    const encoded = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const row = Buffer.allocUnsafe(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] ?? 0 : 0;
      row[x] = (encoded[x] + predictor(filter, left, up, upLeft)) & 0xff;
    }

    for (let x = 0; x < width; x += 1, pixelIndex += 1) {
      if (pixelIndex % sampleEvery !== 0) continue;
      const base = x * bytesPerPixel;
      const [r, g, b] = rgb(row, base, colorType);
      colors.add(`${r},${g},${b}`);
      minChannel = Math.min(minChannel, r, g, b);
      maxChannel = Math.max(maxChannel, r, g, b);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      samples += 1;
      const delta = luma - mean;
      mean += delta / samples;
      m2 += delta * (luma - mean);
    }
    previous = row;
  }

  return {
    width,
    height,
    uniqueSampledColors: colors.size,
    channelRange: maxChannel - minChannel,
    lumaStdDev: samples > 1 ? Math.sqrt(m2 / samples) : 0,
  };
}

function predictor(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) return paeth(left, up, upLeft);
  throw new Error(`Unsupported PNG filter ${filter}.`);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function rgb(row, base, colorType) {
  if (colorType === 2 || colorType === 6) return [row[base], row[base + 1], row[base + 2]];
  const gray = row[base];
  return [gray, gray, gray];
}
