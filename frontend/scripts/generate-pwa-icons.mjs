// One-off: rasterize the studio brand mark (the favicon's 4-square grid) into the
// PNG icon sizes a PWA needs. Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = resolve(__dirname, '../public')

// 512×512 source: full-bleed indigo background (safe for maskable) with the
// 4-square mark centered at ~50% so it survives iOS/Android icon masking.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#4f46e5"/>
  <g>
    <rect x="184" y="184" width="64" height="64" rx="16" fill="#ffffff"/>
    <rect x="264" y="184" width="64" height="64" rx="16" fill="#a5b4fc"/>
    <rect x="184" y="264" width="64" height="64" rx="16" fill="#a5b4fc"/>
    <rect x="264" y="264" width="64" height="64" rx="16" fill="#ffffff"/>
  </g>
</svg>`

const targets = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'maskable-512x512.png', size: 512 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
]

const buf = Buffer.from(svg)
for (const { file, size } of targets) {
  await sharp(buf).resize(size, size).png().toFile(resolve(out, file))
  console.log('wrote', file)
}
