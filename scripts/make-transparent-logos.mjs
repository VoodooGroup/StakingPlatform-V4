import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const desktopDir = 'C:/Users/ReMarkt/Desktop';
const assetsDir =
  'C:/Users/ReMarkt/.grok/sessions/C%3A%5CUsers%5CReMarkt/019f3875-8ff7-7c43-a3b3-ced67de58a46/assets';

function isDark(data, idx) {
  return Math.max(data[idx], data[idx + 1], data[idx + 2]) < 95;
}

function isWhite(data, idx) {
  return data[idx] > 205 && data[idx + 1] > 205 && data[idx + 2] > 205;
}

function flood(data, w, h, ch, mark, sx, sy, matchFn) {
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (mark[p]) continue;
    const idx = p * ch;
    if (!matchFn(data, idx)) continue;
    mark[p] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

async function stripBackground(src, stripWhite = false) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const mark = new Uint8Array(w * h);

  for (let x = 0; x < w; x++) {
    flood(data, w, h, ch, mark, x, 0, isDark);
    flood(data, w, h, ch, mark, x, h - 1, isDark);
  }
  for (let y = 0; y < h; y++) {
    flood(data, w, h, ch, mark, 0, y, isDark);
    flood(data, w, h, ch, mark, w - 1, y, isDark);
  }

  if (stripWhite) {
    const cx = w / 2;
    const cy = h / 2;
    for (let r = w * 0.3; r <= w * 0.48; r += 3) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
        const x = Math.floor(cx + Math.cos(a) * r);
        const y = Math.floor(cy + Math.sin(a) * r);
        if (isWhite(data, (y * w + x) * ch)) flood(data, w, h, ch, mark, x, y, isWhite);
      }
    }
    for (let p = 0; p < w * h; p++) {
      const idx = p * ch;
      if (data[idx] > 198 && data[idx + 1] > 198 && data[idx + 2] > 198) mark[p] = 1;
    }
  } else {
    const cx = w / 2;
    const cy = h / 2;
    for (let r = w * 0.3; r <= w * 0.48; r += 3) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
        const x = Math.floor(cx + Math.cos(a) * r);
        const y = Math.floor(cy + Math.sin(a) * r);
        if (isWhite(data, (y * w + x) * ch)) flood(data, w, h, ch, mark, x, y, isWhite);
      }
    }
  }

  for (let p = 0; p < w * h; p++) {
    const idx = p * ch;
    if (mark[p] || isDark(data, idx)) {
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 0;
    }
  }

  return sharp(data, { raw: { width: w, height: h, channels: ch } }).png();
}

async function saveLogo(src, name, stripWhite, sizes = [512]) {
  const stripped = await stripBackground(src, stripWhite);
  const outputs = [];

  for (const size of sizes) {
    const buf = await stripped.clone().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    for (const dir of [publicDir, desktopDir]) {
      const dst = path.join(dir, name);
      fs.writeFileSync(dst, buf);
      outputs.push(dst);
    }
  }
  outputs.forEach((d) => console.log('Saved', d));
}

const voodooSrc = path.join(assetsDir, 'image-b7d3f041-2811-437b-bfb7-c2adb77478a4.jpg');
const poisonSrc = path.join(assetsDir, 'image-ab4527dc-000c-4605-95b0-67332bcc29ec.jpg');

await saveLogo(voodooSrc, 'Voodoo-Token-Logo.png', true, [512]);
await saveLogo(voodooSrc, 'Magic-Reward-Token-Logo.png', true, [512]);
await saveLogo(poisonSrc, 'Poison-Reward-Token-Logo.png', false, [512]);

const fav32 = await stripBackground(voodooSrc, true);
await fav32.clone().resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(publicDir, 'favicon-32.png'));
await fav32.clone().resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(publicDir, 'favicon.png'));
console.log('Saved favicon.png + favicon-32.png');

if (fs.existsSync('C:/Users/ReMarkt/Desktop/voodoo-token-background.png')) {
  fs.copyFileSync('C:/Users/ReMarkt/Desktop/voodoo-token-background.png', path.join(publicDir, 'voodoo-token-background.png'));
}