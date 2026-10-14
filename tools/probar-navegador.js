// Prueba de punta a punta en un navegador real (Chrome o Edge instalados):  npm run test:e2e
// Simula a un técnico en un teléfono: crea un registro de Cumbre, ingresa lecturas, finaliza y exporta.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import ExcelJS from 'exceljs';
import { codificarConfiguracion } from '../src/logica/nube.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'salida-pruebas');
const DESCARGAS = path.join(SALIDA, 'descargas');
const PUERTO = 5199;
// APP_URL permite probar la versión publicada, p. ej.: APP_URL=https://usuario.github.io/temperatura-poleas/
const URL_APP = process.env.APP_URL || `http://localhost:${PUERTO}/`;

const NAVEGADORES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter((p) => p && fs.existsSync(p));
if (!NAVEGADORES.length) throw new Error('No se encontró Chrome ni Edge. Define CHROME_PATH.');

fs.rmSync(DESCARGAS, { recursive: true, force: true });
fs.mkdirSync(DESCARGAS, { recursive: true });

let servidor = null;
if (!process.env.APP_URL) {
  servidor = spawn(process.execPath, [path.join(RAIZ, 'tools', 'servidor.js')], { env: { ...process.env, PORT: String(PUERTO) } });
  await new Promise((r) => servidor.stdout.once('data', r));
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pulsarEnDialogo = (pagina, texto) =>
  pagina.evaluate((t) => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === t).click(), texto);

const navegador = await puppeteer.launch({ executablePath: NAVEGADORES[0], headless: true });
const errores = [];
try {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  pagina.on('pageerror', (e) => errores.push(e.message));
  // Los fallos de red simulados ("sin señal") son esperados; cualquier otro error de consola hace fallar la prueba
  pagina.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errores.push(m.text()));
  const cdp = await pagina.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS });

  // ---- Inicio ----
  await pagina.goto(URL_APP, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('.estacion');
  assert.equal(await pagina.$$eval('.estacion', (e) => e.length), 3);
  await pagina.screenshot({ path: path.join(SALIDA, '1-inicio.png') });
  console.log('✔ inicio con 3 estaciones');

  // ---- Nuevo registro de Cumbre ----
  await pagina.click('a[href="#/nuevo/cumbre"]');
  await pagina.waitForSelector('#form-registro');
  await pagina.type('#f-nombre', 'Juan Pérez');
  await pagina.type('#f-ambiente', '12,5');
  await pagina.click('input[name="velocidad"][value="4"]');

  // Primeras lecturas con Enter para avanzar (normal, precaución, crítico, inválido)
  await pagina.focus('#m-D9');
  for (const v of ['35', '55,5', '72']) {
    await pagina.keyboard.type(v);
    await pagina.keyboard.press('Enter');
  }
  const enfocado = await pagina.evaluate(() => document.activeElement.id);
  assert.equal(enfocado, 'm-D12', 'Enter debe saltar a la siguiente polea');
  await pagina.keyboard.type('abc');
  const estados = await pagina.$$eval('.medicion', (m) => m.slice(0, 4).map((x) => x.dataset.estado));
  assert.deepEqual(estados, ['normal', 'precaucion', 'critico', 'vacio']);
  assert.equal(await pagina.$eval('#m-D12', (i) => i.getAttribute('aria-invalid')), 'true');
  console.log('✔ alertas en vivo y validación de números');
  await pagina.click('#m-D12', { count: 3 });
  await pagina.keyboard.type('41');

  await pagina.screenshot({ path: path.join(SALIDA, '2-formulario.png') });
  await pagina.waitForFunction(() => /Guardado/.test(document.querySelector('#estado-guardado').textContent));
  console.log('✔ autoguardado');

  // ---- Persistencia: recargar y comprobar que los datos siguen ----
  await pagina.reload({ waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-registro');
  assert.equal(await pagina.$eval('#m-F9', (i) => i.value), '55,5');
  assert.equal(await pagina.$eval('#f-nombre', (i) => i.value), 'Juan Pérez');
  console.log('✔ datos persisten tras recargar');

  // ---- Finalizar (incompleto) ----
  await pagina.click('#btn-finalizar');
  await pagina.waitForSelector('dialog[open]');
  assert.match(await pagina.$eval('dialog[open]', (d) => d.textContent), /Faltan 19 de 23 lecturas/);
  await pagina.screenshot({ path: path.join(SALIDA, '3-incompleto.png') });
  await pagina.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Finalizar').click());
  await pagina.waitForFunction(() => document.querySelector('dialog[open] h2')?.textContent === 'Registro finalizado');
  assert.match(await pagina.$eval('dialog[open]', (d) => d.textContent), /Rodamiento Inferior — 72 °C/);
  await pagina.screenshot({ path: path.join(SALIDA, '4-finalizado.png') });
  console.log('✔ resumen al finalizar con lecturas críticas');

  // ---- Exportar Excel ----
  await pagina.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Exportar Excel').click());
  await pagina.waitForFunction(() => document.querySelector('dialog[open] h2')?.textContent === 'Excel listo', { timeout: 20000 });
  await pagina.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Descargar').click());
  let archivo;
  for (let i = 0; i < 50 && !archivo; i++) {
    await new Promise((r) => setTimeout(r, 200));
    archivo = fs.readdirSync(DESCARGAS).find((f) => f.endsWith('.xlsx'));
  }
  assert.ok(archivo, 'debe descargarse el Excel');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(path.join(DESCARGAS, archivo));
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell('D4').value, 'Juan Pérez');
  assert.equal(hoja.getCell('F5').value, 12.5);
  assert.equal(hoja.getCell('D7').value, '☒ 4 m/s');
  assert.equal(hoja.getCell('F9').value, 55.5);
  assert.equal(hoja.getCell('D10').value, 72);
  console.log(`✔ Excel descargado y verificado: ${archivo}`);

  // ---- Historial y ajustes ----
  await pagina.goto(`${URL_APP}#/historial`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('.registro-item');
  assert.match(await pagina.$eval('.registro-item', (e) => e.textContent), /Cumbre[\s\S]*1 crítica[\s\S]*1 en precaución/);
  await pagina.screenshot({ path: path.join(SALIDA, '5-historial.png') });
  await pagina.goto(`${URL_APP}#/ajustes`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-ajustes');
  await pagina.screenshot({ path: path.join(SALIDA, '6-ajustes.png') });
  console.log('✔ historial y ajustes');

  // ---- Sin conexión (service worker) ----
  await pagina.goto(URL_APP, { waitUntil: 'networkidle0' });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await pagina.setOfflineMode(true);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('.estacion', { timeout: 10000 });
  await pagina.setOfflineMode(false);
  console.log('✔ la app abre sin conexión');

  // ---- Copia en Google Sheets (Google simulado) ----
  const envios = [];
  let modoNube = 'ok';
  await pagina.setRequestInterception(true);
  const simularGoogle = (req) => {
    if (!req.url().startsWith('https://script.google.com/')) return req.continue();
    if (modoNube === 'sinSenal') return req.abort('internetdisconnected');
    const cuerpo = JSON.parse(req.postData());
    envios.push(cuerpo);
    const ok = cuerpo.clave === 'secreta';
    req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(ok ? { ok: true, planilla: 'Planilla de prueba' } : { ok: false, error: 'Clave incorrecta.' }),
    });
  };
  pagina.on('request', simularGoogle);

  await pagina.goto(`${URL_APP}#/`, { waitUntil: 'networkidle0' });
  assert.match(await pagina.$eval('.banner', (b) => b.textContent), /Activa la copia en Google Sheets/);
  await pagina.goto(`${URL_APP}#/ajustes`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-nube');
  await pagina.type('#n-url', 'https://script.google.com/macros/s/PRUEBA/editar');
  await pagina.type('#n-clave', 'secreta');
  await pagina.click('#form-nube [type="submit"]');
  assert.match(await pagina.$eval('#errores-nube', (e) => e.textContent), /exec/);
  await pagina.$eval('#n-url', (i) => { i.value = 'https://script.google.com/macros/s/PRUEBA/exec'; });
  await pagina.click('#form-nube [type="submit"]');
  await pagina.waitForFunction(() => /todo enviado/.test(document.querySelector('#estado-nube').textContent), { timeout: 10000 });
  assert.equal(envios[0].accion, 'ping');
  const guardado = envios.find((e) => e.accion === 'guardar');
  assert.equal(guardado.registro[3], 'Cumbre');
  assert.equal(guardado.mediciones.length, 4);
  await pagina.screenshot({ path: path.join(SALIDA, '8-ajustes-nube.png') });
  console.log('✔ Google Sheets: prueba de conexión y envío del registro finalizado');

  // Corregir un registro ya enviado sin señal → queda pendiente → se envía al volver la señal
  modoNube = 'sinSenal';
  await pagina.goto(`${URL_APP}#/historial`, { waitUntil: 'networkidle0' });
  assert.match(await pagina.$eval('.registro-item', (e) => e.textContent), /En Sheets/);
  await pagina.click('.registro-item');
  await pagina.waitForSelector('#form-registro');
  await pagina.click('#m-F12');
  await pagina.keyboard.type('47');
  await pagina.click('#btn-volver');
  await pagina.waitForSelector('.registro-item');
  await esperar(800);
  await pagina.goto(`${URL_APP}#/historial`, { waitUntil: 'networkidle0' });
  assert.match(await pagina.$eval('.registro-item', (e) => e.textContent), /Sin enviar/);
  await pagina.goto(`${URL_APP}#/`, { waitUntil: 'networkidle0' });
  assert.match(await pagina.$eval('.banner', (b) => b.textContent), /1 registro sin enviar/);
  await pagina.screenshot({ path: path.join(SALIDA, '9-inicio-pendiente.png') });
  modoNube = 'ok';
  await pagina.click('#btn-enviar-ahora');
  await pagina.waitForFunction(() => !document.querySelector('.banner'), { timeout: 10000 });
  const ultimo = envios.filter((e) => e.accion === 'guardar').at(-1);
  assert.equal(ultimo.mediciones.length, 5);
  assert.ok(ultimo.mediciones.some((m) => m[7] === 'F12' && m[8] === 47));
  console.log('✔ sin señal queda en cola y se reenvía corregido al volver la conexión');

  // Enlace de configuración para otro teléfono
  const otra = { urlNube: 'https://script.google.com/macros/s/OTRA/exec', claveNube: 'secreta' };
  await pagina.goto(`${URL_APP}#/configurar/${codificarConfiguracion(otra)}`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('dialog[open]');
  await pulsarEnDialogo(pagina, 'Aplicar');
  await pagina.waitForFunction(() => location.hash === '#/ajustes' && document.querySelector('#n-url'));
  await pagina.waitForFunction((u) => document.querySelector('#n-url').value === u, {}, otra.urlNube);
  console.log('✔ enlace de configuración aplicado');
  pagina.off('request', simularGoogle);
  await pagina.setRequestInterception(false);

  // ---- Escritorio y modo oscuro ----
  await pagina.setViewport({ width: 1280, height: 900 });
  await pagina.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await pagina.goto(`${URL_APP}#/historial`, { waitUntil: 'networkidle0' });
  await pagina.click('.registro-item');
  await pagina.waitForSelector('#form-registro');
  await pagina.screenshot({ path: path.join(SALIDA, '7-escritorio-oscuro.png') });

  assert.deepEqual(errores, [], 'no debe haber errores en la consola');
  console.log('\nTodo OK. Capturas en salida-pruebas/');
} finally {
  await navegador.close();
  servidor?.kill();
}
