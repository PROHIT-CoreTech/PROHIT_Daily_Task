// One-off placeholder icon generator. Run with: node scripts/generate-icons.mjs
// Produces a simple Charcoal Navy / Emerald Teal monogram at PWA icon sizes.
// Replace public/icons/*.png with real branded artwork when it exists —
// this exists only so the manifest has installable icons in the meantime.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1B2A4A"/>
  <text x="256" y="330" font-family="Arial, sans-serif" font-size="260" font-weight="700"
        fill="#2A9D8F" text-anchor="middle">P</text>
</svg>`;

mkdirSync(new URL("../public/icons", import.meta.url), { recursive: true });

const sizes = [192, 512];
for (const size of sizes) {
  const outPath = fileURLToPath(new URL(`../public/icons/icon-${size}.png`, import.meta.url));
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(outPath);
  console.log(`wrote icon-${size}.png`);
}
