// Importa a Google Sheets los registros históricos exportados de Microsoft Forms (un .xlsx por estación).
//
// Uso:
//   node tools/importar-forms.js --simular                      → solo revisa y muestra el reporte (no envía nada)
//   NUBE_URL=... NUBE_CLAVE=... node tools/importar-forms.js    → envía los registros a la planilla
//
// La URL y la clave se pasan por variables de entorno: nunca se guardan en el código.
// Cada registro usa un ID fijo (forms-<estación>-<ID de Forms>): si se vuelve a ejecutar, reemplaza en vez de duplicar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { ESTACIONES } from '../src/data/estaciones.js';
import { AJUSTES_POR_DEFECTO } from '../src/logica/alertas.js';
import { construirEnvio, validarUrlNube } from '../src/logica/nube.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIMULAR = process.argv.includes('--simular');
const ARCHIVOS = { oasis: /Oasis.*\.xlsx$/i, tupahue: /Tupahue.*\.xlsx$/i, cumbre: /Cumbre.*\.xlsx$/i };
const PRIMERA_COLUMNA_POLEAS = 10; // columnas 1-9: ID, inicio, fin, correo, nombre, fecha, T° ambiente, hora, velocidad
const RANGO_RAZONABLE = { min: -10, max: 120 }; // °C: fuera de esto se reporta como posible error de tipeo

const normalizar = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\)\d+$/, ')').trim().toLowerCase();

const texto = (v) => (v && typeof v === 'object' && 'richText' in v ? v.richText.map((t) => t.text).join('') : v);

function leerTemperatura(v) {
  v = texto(v);
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  // Acepta "40,7", "12°" y "48'4" (apóstrofo usado como separador decimal)
  const t = String(v).replace(/[°ºC\s]/gi, '').replace(/[,']/, '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const fechaISO = (d) => d.toISOString().slice(0, 10); // Forms exporta la hora local como si fuera UTC

function leerFecha(v) {
  v = texto(v);
  if (v instanceof Date) return fechaISO(v);
  const m = String(v ?? '').match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function leerHora(v, respaldo) {
  v = texto(v);
  if (v instanceof Date) return v.toISOString().slice(11, 16);
  const m = String(v ?? '').trim().match(/^(\d{1,2})(?:\s*[:.,hH]\s*(\d{1,2}))?/);
  if (m && Number(m[1]) < 24) return `${m[1].padStart(2, '0')}:${(m[2] || '0').padStart(2, '0')}`;
  return respaldo instanceof Date ? respaldo.toISOString().slice(11, 16) : '';
}

function leerVelocidad(v) {
  const m = String(texto(v) ?? '').match(/[345]/);
  return m ? Number(m[0]) : null;
}

async function leerEstacion(estacion, archivo, avisos) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  const hoja = libro.worksheets[0];
  const encabezados = hoja.getRow(1).values.slice(PRIMERA_COLUMNA_POLEAS);

  // Emparejar columnas con poleas por orden, saltando secciones que el formulario no tiene (p. ej. el volante de Tupahue)
  const poleas = estacion.secciones.flatMap((s) => s.poleas);
  const columnas = [];
  let p = 0;
  for (const [i, enc] of encabezados.entries()) {
    while (p < poleas.length && normalizar(poleas[p].nombre) !== normalizar(enc)) p++;
    if (p === poleas.length) throw new Error(`${estacion.nombre}: la columna "${enc}" no coincide con ninguna polea en orden.`);
    columnas.push({ col: PRIMERA_COLUMNA_POLEAS + i, celda: poleas[p].celda, nombre: poleas[p].nombre });
    p++;
  }
  const omitidas = poleas.filter((x) => !columnas.some((c) => c.celda === x.celda)).map((x) => x.nombre);
  if (omitidas.length) avisos.push(`${estacion.nombre}: el formulario no tenía ${omitidas.join(', ')} (quedan vacías).`);

  const registros = [];
  for (let f = 2; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);
    const idForms = texto(fila.getCell(1).value);
    if (!idForms) continue;
    const ref = `${estacion.nombre} ID ${idForms}`;
    const inicio = fila.getCell(2).value;
    const fecha = leerFecha(fila.getCell(6).value) ?? (inicio instanceof Date ? fechaISO(inicio) : null);
    if (!fecha) avisos.push(`${ref}: sin fecha válida, se omite.`);
    if (!fecha) continue;
    if (inicio instanceof Date && Math.abs(new Date(fecha) - new Date(fechaISO(inicio))) > 3 * 864e5) {
      avisos.push(`${ref}: la fecha indicada (${fecha}) difiere de cuando se llenó el formulario (${fechaISO(inicio)}). Se usa la indicada.`);
    }
    const ambiente = leerTemperatura(fila.getCell(7).value);
    if (Number.isNaN(ambiente)) avisos.push(`${ref}: T° ambiente "${fila.getCell(7).value}" no es un número, queda vacía.`);

    const lecturas = {};
    const correcciones = [];
    for (const c of columnas) {
      const original = fila.getCell(c.col).value;
      let valor = leerTemperatura(original);
      if (valor === null) continue;
      if (Number.isNaN(valor)) {
        avisos.push(`${ref}: ${c.nombre} = "${original}" no es un número, se omite.`);
        continue;
      }
      if (typeof original === 'string' && /'/.test(original)) correcciones.push(`${c.nombre} "${original}" → ${valor}`);
      // Punto decimal omitido al digitar (ej. 261 en vez de 26,1): se corrige solo si el resultado es razonable
      if (valor > RANGO_RAZONABLE.max && valor / 10 <= RANGO_RAZONABLE.max) {
        const corregido = Math.round(valor) / 10;
        correcciones.push(`${c.nombre} ${valor} → ${corregido}`);
        valor = corregido;
      } else if (valor < RANGO_RAZONABLE.min || valor > RANGO_RAZONABLE.max) {
        avisos.push(`${ref} (${fecha}): ${c.nombre} = ${valor} °C fuera de rango. Se importa tal cual.`);
      }
      lecturas[c.celda] = valor;
    }
    if (correcciones.length) avisos.push(`${ref} (${fecha}): corregido punto decimal → ${correcciones.join('; ')}`);

    registros.push({
      id: `forms-${estacion.id}-${idForms}`,
      estacionId: estacion.id,
      nombre: String(texto(fila.getCell(5).value) ?? '').trim(),
      fecha,
      hora: leerHora(fila.getCell(8).value, inicio),
      temperaturaAmbiente: Number.isNaN(ambiente) ? null : ambiente,
      velocidad: leerVelocidad(fila.getCell(9).value),
      lecturas,
      observaciones: `Importado desde Microsoft Forms (ID ${idForms}).` +
        (correcciones.length ? ` Corregido punto decimal: ${correcciones.join('; ')}.` : ''),
      estado: 'completo',
    });
  }
  return registros;
}

async function enviar(url, cuerpo, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo), redirect: 'follow' });
      const datos = await r.json();
      if (!datos.ok) throw new Error(datos.error);
      return datos;
    } catch (e) {
      if (i >= intentos || /Clave|Formato|CLAVE/.test(e.message)) throw e;
      await new Promise((ok) => setTimeout(ok, 2000 * i));
    }
  }
}

async function main() {
  const avisos = [];
  const todos = [];
  const archivos = fs.readdirSync(RAIZ);
  for (const estacion of ESTACIONES) {
    const nombre = archivos.find((a) => ARCHIVOS[estacion.id].test(a) && !a.startsWith('~$'));
    if (!nombre) throw new Error(`No se encontró el archivo de Forms de ${estacion.nombre}.`);
    const registros = await leerEstacion(estacion, path.join(RAIZ, nombre), avisos);
    const fechas = registros.map((r) => r.fecha).sort();
    console.log(`✔ ${estacion.nombre}: ${registros.length} registros (${fechas[0]} a ${fechas.at(-1)}) ← ${nombre}`);
    todos.push(...registros);
  }
  todos.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  console.log(`\nTotal: ${todos.length} registros, ${todos.reduce((n, r) => n + Object.keys(r.lecturas).length, 0)} mediciones.`);
  if (avisos.length) console.log(`\nRevisar (${avisos.length}):\n- ${avisos.join('\n- ')}`);

  if (SIMULAR) return console.log('\nSimulación: no se envió nada.');

  const url = process.env.NUBE_URL;
  const clave = process.env.NUBE_CLAVE;
  if (!url || !clave || validarUrlNube(url)) throw new Error('Define NUBE_URL (termina en /exec) y NUBE_CLAVE.');
  const ajustes = { ...AJUSTES_POR_DEFECTO, claveNube: clave };
  console.log(`\nEnviando a Google Sheets (${(await enviar(url, { accion: 'ping', clave })).planilla})…`);
  let enviados = 0;
  for (const r of todos) {
    const estacion = ESTACIONES.find((e) => e.id === r.estacionId);
    await enviar(url, construirEnvio(r, estacion, ajustes));
    enviados++;
    if (enviados % 10 === 0 || enviados === todos.length) console.log(`  ${enviados}/${todos.length}`);
  }
  console.log(`✔ ${enviados} registros enviados.`);
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
