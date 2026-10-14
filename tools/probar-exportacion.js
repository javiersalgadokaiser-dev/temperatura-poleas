// Pruebas de la lógica (alertas y Excel) en Node:  npm test
// Genera archivos de ejemplo en salida-pruebas/ para abrirlos y revisarlos en Excel.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { ESTACIONES, CELDAS_GENERALES, CELDAS_VELOCIDAD } from '../src/data/estaciones.js';
import { AJUSTES_POR_DEFECTO, estadoTemperatura, resumenRegistro, validarAjustes } from '../src/logica/alertas.js';
import { crearExcelRegistro, crearExcelHistorial, nombreArchivoRegistro } from '../src/logica/exportar-excel.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'salida-pruebas');
fs.mkdirSync(SALIDA, { recursive: true });
const plantilla = fs.readFileSync(path.join(RAIZ, 'plantilla', 'registro-temperatura.xlsx'));
const ajustes = { ...AJUSTES_POR_DEFECTO, margenSobreAmbiente: 30 };

// --- Alertas ---
assert.equal(estadoTemperatura(null, 10, ajustes), null);
assert.equal(estadoTemperatura(35, 10, ajustes).id, 'normal');
assert.equal(estadoTemperatura(41, 10, ajustes).id, 'precaucion'); // 31 °C sobre ambiente
assert.equal(estadoTemperatura(50, 30, ajustes).id, 'precaucion'); // umbral absoluto
assert.equal(estadoTemperatura(70, 30, ajustes).id, 'critico');
assert.deepEqual(validarAjustes({ ...ajustes, umbralCritico: 40 }), ['El umbral crítico debe ser mayor que el de precaución.']);
assert.deepEqual(validarAjustes(AJUSTES_POR_DEFECTO), []);
console.log('✔ alertas');

// --- Excel por estación ---
const registros = [];
for (const estacion of ESTACIONES) {
  const lecturas = {};
  let i = 0;
  for (const s of estacion.secciones) for (const p of s.poleas) lecturas[p.celda] = 25 + ((i++ * 7) % 50) + 0.5;
  const registro = {
    id: estacion.id, estacionId: estacion.id, nombre: 'Técnico de prueba', fecha: '2026-10-14', hora: '08:30',
    temperaturaAmbiente: 12, velocidad: 4, lecturas, observaciones: 'Prueba automática de exportación.',
  };
  registros.push(registro);

  const buffer = await crearExcelRegistro(ExcelJS, plantilla, registro, estacion, ajustes);
  const archivo = path.join(SALIDA, nombreArchivoRegistro(registro, estacion));
  fs.writeFileSync(archivo, Buffer.from(buffer));

  // Releer y verificar
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  assert.equal(libro.worksheets.length, 1, 'solo debe quedar la hoja de la estación');
  const hoja = libro.worksheets[0];
  assert.equal(hoja.name, estacion.hojaExcel);
  assert.equal(hoja.getCell(CELDAS_GENERALES.nombre).value, 'Técnico de prueba');
  assert.equal(hoja.getCell(CELDAS_GENERALES.fecha).value, '14-10-2026');
  assert.equal(hoja.getCell(CELDAS_GENERALES.temperaturaAmbiente).value, 12);
  assert.equal(hoja.getCell(CELDAS_VELOCIDAD[4]).value, '☒ 4 m/s');
  assert.equal(hoja.getCell(CELDAS_VELOCIDAD[3]).value, '☐ 3 m/s');
  for (const [celda, valor] of Object.entries(lecturas)) assert.equal(hoja.getCell(celda).value, valor, celda);
  // Las etiquetas originales no deben cambiar y los bordes deben conservarse
  assert.match(String(hoja.getCell('C12').value), /^Polea 1/);
  assert.ok(hoja.getCell('D12').border, 'la celda D12 debe conservar su borde');
  // El color de alerta no debe filtrarse a celdas vecinas que comparten estilo
  const rojas = Object.keys(lecturas).filter((c) => hoja.getCell(c).fill?.fgColor?.argb === 'FFF4A3A3');
  const esperadas = Object.keys(lecturas).filter((c) => estadoTemperatura(lecturas[c], 12, ajustes).id === 'critico');
  assert.deepEqual(rojas.sort(), esperadas.sort());
  const normalesConColor = Object.keys(lecturas).filter(
    (c) => estadoTemperatura(lecturas[c], 12, ajustes).id === 'normal' && hoja.getCell(c).fill?.pattern === 'solid',
  );
  assert.deepEqual(normalesConColor, [], 'las lecturas normales no deben quedar coloreadas');
  assert.notEqual(hoja.getCell('C12').fill?.fgColor?.argb, 'FFF4A3A3');

  const r = resumenRegistro(registro, estacion, ajustes);
  console.log(`✔ ${estacion.nombre}: ${r.medidas}/${r.total} lecturas, ${r.precaucion} precaución, ${r.critico} críticas → ${path.basename(archivo)}`);
}

// --- Historial ---
const historial = await crearExcelHistorial(ExcelJS, registros, ESTACIONES, ajustes);
fs.writeFileSync(path.join(SALIDA, 'Historial.xlsx'), Buffer.from(historial));
const libroH = new ExcelJS.Workbook();
await libroH.xlsx.load(historial);
const total = ESTACIONES.reduce((n, e) => n + e.secciones.reduce((m, s) => m + s.poleas.length, 0), 0);
assert.equal(libroH.worksheets[0].rowCount, total + 1);
console.log(`✔ historial: ${total} filas`);
console.log(`\nArchivos de ejemplo en: ${SALIDA}`);
