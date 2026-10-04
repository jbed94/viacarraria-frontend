import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Precompute CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToArc(px, py) {
  let minDist = Infinity;
  const segments = 50;
  let prevX = 25.5,
    prevY = 8.5;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    let cx, cy;
    if (t <= 0.5) {
      const u = t * 2;
      const inv = 1 - u;
      cx =
        inv * inv * inv * 25.5 +
        3 * inv * inv * u * 18 +
        3 * inv * u * u * 16.5 +
        u * u * u * 16.5;
      cy =
        inv * inv * inv * 8.5 +
        3 * inv * inv * u * 8.5 +
        3 * inv * u * u * 12 +
        u * u * u * 16;
    } else {
      const u = (t - 0.5) * 2;
      const inv = 1 - u;
      cx =
        inv * inv * inv * 16.5 +
        3 * inv * inv * u * 16.5 +
        3 * inv * u * u * 18 +
        u * u * u * 25.5;
      cy =
        inv * inv * inv * 16 +
        3 * inv * inv * u * 20 +
        3 * inv * u * u * 23.5 +
        u * u * u * 23.5;
    }
    const d = distToSegment(px, py, prevX, prevY, cx, cy);
    if (d < minDist) minDist = d;
    prevX = cx;
    prevY = cy;
  }
  return minDist;
}

function renderRgbaPixels(size) {
  const scale = size / 32;
  const buffer = Buffer.alloc(size * size * 4);
  const strokeWidth = 2.2 * scale;
  const halfStroke = strokeWidth / 2;

  const bg = [0x15, 0x1d, 0x16, 0xff]; // #151d16
  const border = [0x28, 0x39, 0x2a, 0xff];
  const mint = [0x8c, 0xe3, 0xb0, 0xff]; // #8ce3b0
  const coral = [0xff, 0x8a, 0x71, 0xff]; // #ff8a71

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;
      const samples = 3;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = (x + (sx + 0.5) / samples) / scale;
          const py = (y + (sy + 0.5) / samples) / scale;

          const qx = Math.abs(px - 15.5) - (15.5 - 7.5);
          const qy = Math.abs(py - 15.5) - (15.5 - 7.5);
          const dSquircle = Math.hypot(Math.max(0, qx), Math.max(0, qy)) - 7.5;

          if (dSquircle > 0.5) continue;

          let pr = bg[0],
            pg = bg[1],
            pb = bg[2],
            pa = 255;
          if (dSquircle > -1.0) {
            pr = border[0];
            pg = border[1];
            pb = border[2];
          }

          const dV1 = distToSegment(px, py, 7.5, 8.5, 13.5, 23.5);
          const dV2 = distToSegment(px, py, 13.5, 23.5, 19.5, 8.5);
          const dV = Math.min(dV1, dV2);
          const dC = distToArc(px, py);

          let dBridge = distToSegment(px, py, 19.5, 8.5, 25.5, 8.5);
          if (px > 21 && px < 24) dBridge = 999;

          const dStroke = Math.min(dV, dC, dBridge);

          const dN1 = Math.hypot(px - 7.5, py - 8.5) - 2.0;
          const dN2 = Math.hypot(px - 13.5, py - 23.5) - 2.1;
          const dNexus = Math.hypot(px - 19.5, py - 8.5) - 2.3;
          const dC1 = Math.hypot(px - 25.5, py - 8.5) - 1.9;
          const dC2 = Math.hypot(px - 25.5, py - 23.5) - 2.0;
          const dDot = Math.hypot(px - 16.5, py - 16) - 1.3;

          const dMintNodes = Math.min(dN1, dN2, dC1, dC2, dDot);

          if (dNexus <= 0) {
            pr = coral[0];
            pg = coral[1];
            pb = coral[2];
            pa = 255;
          } else if (dMintNodes <= 0 || dStroke <= halfStroke) {
            pr = mint[0];
            pg = mint[1];
            pb = mint[2];
            pa = 255;
          }

          rSum += pr;
          gSum += pg;
          bSum += pb;
          aSum += pa;
        }
      }

      const count = samples * samples;
      const offset = (y * size + x) * 4;
      buffer[offset + 0] = Math.round(rSum / count);
      buffer[offset + 1] = Math.round(gSum / count);
      buffer[offset + 2] = Math.round(bSum / count);
      buffer[offset + 3] = Math.round(aSum / count);
    }
  }
  return buffer;
}

function createPng(size) {
  const pixels = renderRgbaPixels(size);
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const scanlineOffset = y * (size * 4 + 1);
    scanlines[scanlineOffset] = 0; // Filter None
    pixels.copy(
      scanlines,
      scanlineOffset + 1,
      y * size * 4,
      (y + 1) * size * 4,
    );
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const compressedData = zlib.deflateSync(scanlines);

  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressedData),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const appleTouchIconPath = path.resolve(
  __dirname,
  '../public/apple-touch-icon.png',
);
const png180 = createPng(180);
fs.writeFileSync(appleTouchIconPath, png180);
console.log(
  `Generated apple-touch-icon.png successfully at ${appleTouchIconPath} (${png180.length} bytes)`,
);
