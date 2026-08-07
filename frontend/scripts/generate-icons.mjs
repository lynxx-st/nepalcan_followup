import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ponytail: maskable uses the logo at 80% scale, centered — safe zone for OS masks
const MASKABLE_BG = '#f5f5f5';

const jobs = [
  { file: 'pwa-icon-192.png', size: 192, scale: 1 },
  { file: 'pwa-icon-512.png', size: 512, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'pwa-icon-512-maskable.png', size: 512, scale: 0.8, padBg: MASKABLE_BG },
];

const src = path.resolve(root, '..', '..', 'logo.png');

for (const { file, size, scale, padBg } of jobs) {
  let img = sharp(src).resize(Math.round(size * scale), Math.round(size * scale));
  if (padBg) {
    const pad = Math.round(size * (1 - scale) / 2);
    img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: padBg });
  }
  await img.png().toFile(path.join(root, file));
  console.log('wrote', path.join(root, file));
}