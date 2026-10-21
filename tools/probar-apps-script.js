// Prueba google-apps-script/Codigo.gs en Node con una planilla simulada (sin cuenta de Google).
// Verifica clave, inserción, reemplazo sin duplicados y protección contra fórmulas.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESTACIONES } from '../src/data/estaciones.js';
import { AJUSTES_POR_DEFECTO } from '../src/logica/alertas.js';
import { construirEnvio, codificarConfiguracion, decodificarConfiguracion, validarUrlNube } from '../src/logica/nube.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODIGO = fs.readFileSync(path.join(RAIZ, 'google-apps-script', 'Codigo.gs'), 'utf8');

// ---------- Simulación mínima de Google Sheets ----------
class HojaFalsa {
  constructor() { this.filas = []; }
  getLastRow() { return this.filas.length; }
  getMaxRows() { return 1000; }
  deleteRows(desde, cantidad) { this.filas.splice(desde - 1, cantidad); }
  setFrozenRows() {}
  setConditionalFormatRules(reglas) { this.reglas = reglas; }
  getRange(fila, col, nFilas = 1, nCols = 1) {
    const hoja = this;
    const rango = {
      getValues: () => Array.from({ length: nFilas }, (_, i) => Array.from({ length: nCols }, (_, j) => hoja.filas[fila - 1 + i]?.[col - 1 + j] ?? '')),
      // Como Google Sheets: las fechas se muestran en formato local y las horas como "11:00:00"
      getDisplayValues: () => rango.getValues().map((f) => f.map((v) => (v instanceof Date
        ? `${v.getUTCDate()}/${v.getUTCMonth() + 1}/${v.getUTCFullYear()}`
        : /^\d{2}:\d{2}$/.test(v) ? `${v}:00` : String(v)))),
      setValues(valores) {
        assert.equal(valores.length, nFilas, 'setValues: cantidad de filas');
        valores.forEach((v, i) => {
          assert.equal(v.length, nCols, 'setValues: cantidad de columnas');
          hoja.filas[fila - 1 + i] ??= [];
          v.forEach((x, j) => { hoja.filas[fila - 1 + i][col - 1 + j] = x; });
        });
        return rango;
      },
      setFontWeight: () => rango, setBackground: () => rango, setFontColor: () => rango,
    };
    return rango;
  }
}

function crearLibroFalso(nombre, id) {
  const hojas = new Map();
  return {
    hojas,
    getName: () => nombre,
    getId: () => id,
    getSpreadsheetTimeZone: () => 'UTC',
    getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
    getSheetByName: (n) => hojas.get(n) ?? null,
    insertSheet: (n) => { const h = new HojaFalsa(); hojas.set(n, h); return h; },
  };
}

/** independiente: simula un script creado en script.google.com (sin planilla asociada). */
function cargarScript(clave, { independiente = false } = {}) {
  const libro = crearLibroFalso('Planilla de prueba', 'ID-ASOCIADA');
  const creados = [];
  const propiedades = new Map();
  const cadena = new Proxy({}, { get: (_, p) => (p === 'build' ? () => ({}) : () => cadena) });
  const contexto = vm.createContext({
    SpreadsheetApp: {
      getActive: () => (independiente ? null : libro),
      create: (nombre) => { const l = crearLibroFalso(nombre, `ID-NUEVA-${creados.length + 1}`); creados.push(l); return l; },
      openById: (id) => creados.find((l) => l.getId() === id),
      newConditionalFormatRule: () => cadena,
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => propiedades.get(k) ?? null, setProperty: (k, v) => propiedades.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Logger: { log() {} },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  });
  const fuente = clave ? CODIGO.replace("const CLAVE = 'CAMBIA-ESTA-CLAVE';", `const CLAVE = '${clave}';`) : CODIGO;
  vm.runInContext(fuente, contexto);
  const post = (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto);
  return { post, hojas: libro.hojas, creados };
}

// ---------- Lógica de la app ----------
assert.equal(validarUrlNube('https://script.google.com/macros/s/ABC/exec'), '');
assert.match(validarUrlNube('https://script.google.com/macros/s/ABC/edit'), /exec/);
assert.match(validarUrlNube('http://ejemplo.com/exec'), /script\.google\.com/);
const config = { urlNube: 'https://script.google.com/macros/s/AKfy-cb_12/exec', claveNube: 'clave con ñ y espacios' };
assert.deepEqual(decodificarConfiguracion(codificarConfiguracion(config)), config);
assert.throws(() => decodificarConfiguracion('basura'));
console.log('✔ validación de URL y enlace de configuración');

// ---------- Script de Google ----------
const ajustes = { ...AJUSTES_POR_DEFECTO, claveNube: 'secreta' };
const oasis = ESTACIONES.find((e) => e.id === 'oasis');
const registro = {
  id: 'reg-1', estacionId: 'oasis', nombre: '=HYPERLINK("x")', fecha: '2026-10-14', hora: '09:15',
  temperaturaAmbiente: -2, velocidad: 5, observaciones: '', estado: 'completo',
  lecturas: { D9: 30, F9: 55, D10: 80, D12: 41.5 },
};

// Sin configurar la clave en el script → rechaza
assert.match(cargarScript(null).post(construirEnvio(registro, oasis, ajustes)).error, /CLAVE/);

const { post, hojas } = cargarScript('secreta');
assert.equal(post({ accion: 'ping', clave: 'otra' }).error, 'Clave incorrecta.');
const RESPUESTA_OK = { ok: true, planilla: 'Planilla de prueba', urlPlanilla: 'https://docs.google.com/spreadsheets/d/ID-ASOCIADA/edit' };
assert.deepEqual(post({ accion: 'ping', clave: 'secreta' }), RESPUESTA_OK);

// Primer envío
assert.deepEqual(post(construirEnvio(registro, oasis, ajustes)), RESPUESTA_OK);
const regs = hojas.get('Registros');
const meds = hojas.get('Mediciones');
assert.equal(regs.filas.length, 2); // encabezado + 1
assert.equal(meds.filas.length, 5); // encabezado + 4 lecturas
assert.equal(regs.filas[1][4], '\'=HYPERLINK("x")', 'texto que parece fórmula debe ir escapado');
assert.equal(regs.filas[1][5], -2, 'los números negativos no se alteran');
assert.deepEqual(regs.filas[1].slice(7, 13), [4, 29, 1, 1, 80, 'Volante principal · Rodamiento Inferior']);
assert.ok(regs.filas[1][14] instanceof Date || typeof regs.filas[1][14] === 'object', 'fecha de recepción');
assert.deepEqual(meds.filas.slice(1).map((f) => f[9]), ['Normal', 'Precaución', 'Crítico', 'Normal']);

// Otro registro y luego reenvío corregido del primero → reemplaza, sin duplicar
post(construirEnvio({ ...registro, id: 'reg-2', nombre: 'Ana' }, oasis, ajustes));
post(construirEnvio({ ...registro, lecturas: { D9: 31 } }, oasis, ajustes));
assert.equal(regs.filas.length, 3);
assert.equal(meds.filas.length, 1 + 4 + 1);
assert.deepEqual(meds.filas.filter((f) => f[0] === 'reg-1').map((f) => f[8]), [31]);
assert.equal(meds.filas.filter((f) => f[0] === 'reg-2').length, 4, 'el otro registro queda intacto');

// Formato inválido
assert.match(post({ accion: 'guardar', clave: 'secreta', registro: ['x'], mediciones: [] }).error, /Formato/);

// Historial para gráficos. Google convierte "2026-10-14" en fecha al escribirla: se simula aquí.
regs.filas[1][1] = new Date(Date.UTC(2026, 9, 14));
const historial = post({ accion: 'historial', clave: 'secreta' });
assert.equal(historial.ok, true);
assert.deepEqual(historial.registros.find((r) => r[0] === 'reg-1'), ['reg-1', '2026-10-14', '09:15', 'Oasis', '\'=HYPERLINK("x")', -2, 5]);
assert.deepEqual(historial.lecturas.filter((l) => l[0] === 'reg-1'), [['reg-1', 'D9', 31]]);
assert.equal(historial.lecturas.length, 5);
assert.equal(post({ accion: 'historial', clave: 'mala' }).error, 'Clave incorrecta.');
console.log('✔ script de Google: historial para gráficos (fechas convertidas por Google incluidas)');
console.log('✔ script de Google: clave, inserción, reemplazo sin duplicados y escape de fórmulas');

// Script independiente (creado en script.google.com): crea la planilla una sola vez y la reutiliza
const ind = cargarScript('secreta', { independiente: true });
const ping = ind.post({ accion: 'ping', clave: 'secreta' });
assert.equal(ping.planilla, 'Registro temperatura poleas');
ind.post(construirEnvio(registro, oasis, ajustes));
ind.post(construirEnvio({ ...registro, id: 'reg-2' }, oasis, ajustes));
assert.equal(ind.creados.length, 1, 'no debe crear más de una planilla');
assert.equal(ind.creados[0].hojas.get('Registros').filas.length, 3);
console.log('✔ script independiente: crea la planilla en Drive la primera vez y luego la reutiliza');
