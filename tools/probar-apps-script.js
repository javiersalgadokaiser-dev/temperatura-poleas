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

function cargarScript(clave) {
  const hojas = new Map();
  const libro = {
    getName: () => 'Planilla de prueba',
    getSheetByName: (n) => hojas.get(n) ?? null,
    insertSheet: (n) => { const h = new HojaFalsa(); hojas.set(n, h); return h; },
  };
  const cadena = new Proxy({}, { get: (_, p) => (p === 'build' ? () => ({}) : () => cadena) });
  const contexto = vm.createContext({
    SpreadsheetApp: { getActive: () => libro, newConditionalFormatRule: () => cadena },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  });
  const fuente = clave ? CODIGO.replace("const CLAVE = 'CAMBIA-ESTA-CLAVE';", `const CLAVE = '${clave}';`) : CODIGO;
  vm.runInContext(fuente, contexto);
  const post = (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto);
  return { post, hojas };
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
assert.deepEqual(post({ accion: 'ping', clave: 'secreta' }), { ok: true, planilla: 'Planilla de prueba' });

// Primer envío
assert.deepEqual(post(construirEnvio(registro, oasis, ajustes)), { ok: true });
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
console.log('✔ script de Google: clave, inserción, reemplazo sin duplicados y escape de fórmulas');
