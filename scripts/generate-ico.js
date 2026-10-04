// Script to generate a standards-compliant multi-resolution favicon.ico
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // Cubic bezier: P0=(25.5, 8.5), P1=(18, 8.5), P2=(16.5, 12), P3=(16.5, 16)
  // and P0=(16.5, 16), P1=(16.5, 20), P2=(18, 23.5), P3=(25.5, 23.5)
  let minDist = Infinity;
  const segments = 40;
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

function renderIconBitmap(size) {
  const scale = size / 32;
  const buffer = Buffer.alloc(size * size * 4);
  const strokeWidth = 2.2 * scale;
  const halfStroke = strokeWidth / 2;

  // Colors
  const bg = [0x15, 0x1d, 0x16, 0xff]; // #151d16
  const border = [0x28, 0x39, 0x2a, 0xff];
  const mint = [0x8c, 0xe3, 0xb0, 0xff]; // #8ce3b0
  const coral = [0xff, 0x8a, 0x71, 0xff]; // #ff8a71

  for (let y = 0; y < size; y++) {
    // In BMP format, row 0 is at bottom!
    const bmpY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      // 4x Supersampling for anti-aliasing
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;
      const samples = 4;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = (x + (sx + 0.5) / samples) / scale;
          const py = (y + (sy + 0.5) / samples) / scale;

          // Squircle container
          const qx = Math.abs(px - 15.5) - (15.5 - 7.5);
          const qy = Math.abs(py - 15.5) - (15.5 - 7.5);
          const dSquircle = Math.hypot(Math.max(0, qx), Math.max(0, qy)) - 7.5;

          if (dSquircle > 0.5) {
            // Transparent outside
            continue;
          }

          // Inside squircle base
          let pr = bg[0],
            pg = bg[1],
            pb = bg[2],
            pa = 255;
          if (dSquircle > -1.0) {
            pr = border[0];
            pg = border[1];
            pb = border[2];
          }

          // V lines
          const dV1 = distToSegment(px, py, 7.5, 8.5, 13.5, 23.5);
          const dV2 = distToSegment(px, py, 13.5, 23.5, 19.5, 8.5);
          const dV = Math.min(dV1, dV2);

          // C arc
          const dC = distToArc(px, py);

          // Bridge line (dash)
          let dBridge = distToSegment(px, py, 19.5, 8.5, 25.5, 8.5);
          if (px > 21 && px < 24) dBridge = 999; // subtle gap/dash

          const dStroke = Math.min(dV, dC, dBridge);

          // Nodes
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
      const offset = (bmpY * size + x) * 4;
      // BGRA format for BMP
      buffer[offset + 0] = Math.round(bSum / count);
      buffer[offset + 1] = Math.round(gSum / count);
      buffer[offset + 2] = Math.round(rSum / count);
      buffer[offset + 3] = Math.round(aSum / count);
    }
  }

  return buffer;
}

function createIcoFile(sizes) {
  const images = sizes.map((size) => {
    const rawPixels = renderIconBitmap(size);
    const andMaskSize = Math.ceil(size / 32) * 4 * size;
    const andMask = Buffer.alloc(andMaskSize); // all zeroes

    // BITMAPINFOHEADER (40 bytes)
    const bih = Buffer.alloc(40);
    bih.writeUInt32LE(40, 0); // biSize
    bih.writeInt32LE(size, 4); // biWidth
    bih.writeInt32LE(size * 2, 8); // biHeight (doubled for XOR + AND masks)
    bih.writeUInt16LE(1, 12); // biPlanes
    bih.writeUInt16LE(32, 14); // biBitCount
    bih.writeUInt32LE(0, 16); // biCompression (BI_RGB)
    bih.writeUInt32LE(rawPixels.length + andMask.length, 20); // biSizeImage
    bih.writeInt32LE(0, 24); // biXPelsPerMeter
    bih.writeInt32LE(0, 28); // biYPelsPerMeter
    bih.writeUInt32LE(0, 32); // biClrUsed
    bih.writeUInt32LE(0, 36); // biClrImportant

    const data = Buffer.concat([bih, rawPixels, andMask]);
    return { size, data };
  });

  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(images.length, 4); // Image count

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Offset
    entries.push(entry);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((img) => img.data)]);
}

const outPath = path.resolve(__dirname, '../public/favicon.ico');
const icoBuffer = createIcoFile([32, 16]);
fs.writeFileSync(outPath, icoBuffer);
console.log(
  `Generated favicon.ico successfully at ${outPath} (${icoBuffer.length} bytes)`,
);
