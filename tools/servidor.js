// Servidor local para probar la app:  npm start  → http://localhost:5173
// Sin dependencias. Solo para desarrollo; en producción se publica la carpeta en un hosting con HTTPS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PORT) || 5173;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
// Solo se sirven archivos de la app (nunca node_modules ni herramientas)
const PERMITIDOS = ['index.html', 'manifest.webmanifest', 'sw.js', 'src/', 'vendor/', 'plantilla/', 'icons/'];

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ) || !PERMITIDOS.some((p) => ruta === p || ruta.startsWith(p))) {
    res.writeHead(404).end('No encontrado');
    return;
  }
  fs.readFile(archivo, (err, datos) => {
    if (err) {
      res.writeHead(404).end('No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`La app ya está abierta en http://localhost:${PUERTO} (en otra ventana).`);
  else console.error(e);
  process.exit(1);
}).listen(PUERTO, () => {
  console.log(`App en http://localhost:${PUERTO}`);
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
  ips.forEach((i) => console.log(`En la misma red Wi-Fi: http://${i.address}:${PUERTO}  (sin modo offline: requiere HTTPS)`));
});
