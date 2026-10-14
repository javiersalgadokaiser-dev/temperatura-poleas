// Prepara los archivos estáticos de la app:  npm run setup
//  1) Copia ExcelJS desde node_modules a vendor/ (la app no depende de un CDN y funciona sin conexión)
//  2) Genera los íconos PNG de la app instalable (sin dependencias, con zlib de Node)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 1) ExcelJS ----------
const origen = path.join(RAIZ, 'node_modules', 'exceljs', 'dist', 'exceljs.min.js');
if (!fs.existsSync(origen)) {
  console.error('Falta ExcelJS. Ejecuta primero: npm install');
  process.exit(1);
}
fs.mkdirSync(path.join(RAIZ, 'vendor'), { recursive: true });
fs.copyFileSync(origen, path.join(RAIZ, 'vendor', 'exceljs.min.js'));
console.log('✔ vendor/exceljs.min.js');

// ---------- 2) Íconos ----------
// Colores del tema
const AZUL = [0x1d, 0x4e, 0x6b];
const BLANCO = [0xff, 0xff, 0xff];
const ROJO = [0xe5, 0x39, 0x35];

// Figuras en coordenadas normalizadas (0..1). Se pintan en orden, la última queda encima.
const circulo = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;
const capsula = (cx, y1, y2, ancho) => (x, y) =>
  Math.abs(x - cx) <= ancho / 2 && y >= y1 && y <= y2 || Math.hypot(x - cx, y - y1) <= ancho / 2;
const rectRedondeado = (r) => (x, y) => {
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return Math.hypot(dx, dy) <= r;
};

function figuras(maskable) {
  // En íconos "maskable" el contenido se reduce para quedar dentro de la zona segura (80 %)
  const e = maskable ? 0.78 : 1;
  const t = (v) => 0.5 + (v - 0.5) * e;
  const s = (v) => v * e;
  return [
    [maskable ? () => true : rectRedondeado(0.22), AZUL],
    // Polea: anillo exterior, garganta, disco y eje
    [circulo(t(0.41), t(0.45), s(0.27)), BLANCO],
    [circulo(t(0.41), t(0.45), s(0.205)), AZUL],
    [circulo(t(0.41), t(0.45), s(0.165)), BLANCO],
    [circulo(t(0.41), t(0.45), s(0.055)), AZUL],
    // Termómetro
    [capsula(t(0.76), t(0.40), t(0.78), s(0.11)), BLANCO],
    [circulo(t(0.76), t(0.80), s(0.085)), BLANCO],
    [capsula(t(0.76), t(0.56), t(0.80), s(0.045)), ROJO],
    [circulo(t(0.76), t(0.80), s(0.055)), ROJO],
  ];
}

function rasterizar(tam, maskable) {
  const capas = figuras(maskable);
  const SS = 4; // supermuestreo para bordes suaves
  const px = Buffer.alloc(tam * tam * 4);
  for (let py = 0; py < tam; py++) {
    for (let pxx = 0; pxx < tam; pxx++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxx + (sx + 0.5) / SS) / tam;
          const y = (py + (sy + 0.5) / SS) / tam;
          let color = null;
          for (const [dentro, c] of capas) if (dentro(x, y)) color = c;
          if (color) { r += color[0]; g += color[1]; b += color[2]; a += 255; }
        }
      }
      const n = SS * SS, i = (py * tam + pxx) * 4;
      const cobertura = a / 255;
      px[i] = cobertura ? r / cobertura : 0;
      px[i + 1] = cobertura ? g / cobertura : 0;
      px[i + 2] = cobertura ? b / cobertura : 0;
      px[i + 3] = a / n;
    }
  }
  return px;
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([largo, td, crc]);
}
function png(tam, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const filas = Buffer.alloc(tam * (tam * 4 + 1));
  for (let y = 0; y < tam; y++) rgba.copy(filas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', zlib.deflateSync(filas, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

const ICONOS = [
  ['icono-192.png', 192, false],
  ['icono-512.png', 512, false],
  ['icono-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true], // iOS recorta las esquinas por su cuenta
];
fs.mkdirSync(path.join(RAIZ, 'icons'), { recursive: true });
for (const [nombre, tam, maskable] of ICONOS) {
  fs.writeFileSync(path.join(RAIZ, 'icons', nombre), png(tam, rasterizar(tam, maskable)));
  console.log(`✔ icons/${nombre}`);
}
