/**
 * Temperatura poleas: recibe los registros de la app y los guarda en una planilla de Google.
 *
 * Instalación (una sola vez):
 *  1. Opción A: crea una planilla en Google Sheets → Extensiones → Apps Script.
 *     Opción B: entra a https://script.google.com → Nuevo proyecto (la planilla se crea sola en tu Drive).
 *  2. Borra el contenido de Código.gs y pega este archivo completo.
 *  3. Cambia CLAVE por una clave propia (la misma que escribirás en Ajustes de la app).
 *  4. Implementar → Nueva implementación → Tipo: Aplicación web
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *  5. Autoriza los permisos y copia la URL que termina en /exec en Ajustes de la app.
 *
 * Si cambias este código después: Implementar → Gestionar implementaciones → Editar → Versión: Nueva.
 *
 * Versión 1.2: agrega la acción "historial" (lectura para los gráficos de la app).
 */

const CLAVE = 'CAMBIA-ESTA-CLAVE';

const NOMBRE_PLANILLA = 'Registro temperatura poleas';
const HOJA_REGISTROS = 'Registros';
const HOJA_MEDICIONES = 'Mediciones';
const ENCABEZADOS_REGISTROS = [
  'ID', 'Fecha', 'Hora', 'Estación', 'Técnico', 'T° ambiente (°C)', 'Velocidad (m/s)',
  'Lecturas', 'Total puntos', 'En precaución', 'Críticas', 'Máxima (°C)', 'Polea con máxima', 'Observaciones', 'Recibido',
];
const ENCABEZADOS_MEDICIONES = [
  'ID registro', 'Fecha', 'Hora', 'Estación', 'Técnico', 'Sección', 'Polea', 'Celda Excel', 'Temperatura (°C)', 'Estado',
];

function doGet() {
  return responder({ ok: true, mensaje: 'Servicio de Temperatura poleas activo.' });
}

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    if (CLAVE === 'CAMBIA-ESTA-CLAVE') return responder({ ok: false, error: 'Falta configurar la CLAVE en el script de Google.' });
    if (datos.clave !== CLAVE) return responder({ ok: false, error: 'Clave incorrecta.' });
    if (['ping', 'guardar', 'historial'].indexOf(datos.accion) === -1) return responder({ ok: false, error: 'Acción desconocida.' });
    if (datos.accion === 'guardar') validarEnvio(datos);

    // Un solo envío a la vez: evita filas mezcladas y que se creen dos planillas en el primer uso
    const candado = LockService.getScriptLock();
    candado.waitLock(30000);
    try {
      const libro = obtenerLibro();
      if (datos.accion === 'guardar') guardarRegistro(libro, datos);
      const respuesta = { ok: true, planilla: libro.getName(), urlPlanilla: libro.getUrl() };
      if (datos.accion === 'historial') {
        const historial = leerHistorial(libro);
        respuesta.registros = historial.registros;
        respuesta.lecturas = historial.lecturas;
      }
      return responder(respuesta);
    } finally {
      candado.releaseLock();
    }
  } catch (err) {
    return responder({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Planilla donde se guardan los datos: la del script si se creó desde Extensiones → Apps Script;
 * si el script es independiente (script.google.com), crea una en tu Drive la primera vez y la recuerda.
 */
function obtenerLibro() {
  const activo = SpreadsheetApp.getActive();
  if (activo) return activo;
  const propiedades = PropertiesService.getScriptProperties();
  const id = propiedades.getProperty('ID_PLANILLA');
  if (id) return SpreadsheetApp.openById(id);
  const nuevo = SpreadsheetApp.create(NOMBRE_PLANILLA);
  propiedades.setProperty('ID_PLANILLA', nuevo.getId());
  return nuevo;
}

/** Ejecútalo desde el editor (▶ Ejecutar) para crear o ver la planilla; la URL aparece en el registro de ejecución. */
function verPlanilla() {
  const libro = obtenerLibro();
  Logger.log('Planilla: ' + libro.getName() + ' → ' + libro.getUrl());
}

/** Inserta o reemplaza un registro (si se reenvía tras una corrección, no queda duplicado). */
function guardarRegistro(libro, datos) {
  const hojaR = obtenerHoja(libro, HOJA_REGISTROS, ENCABEZADOS_REGISTROS);
  const hojaM = obtenerHoja(libro, HOJA_MEDICIONES, ENCABEZADOS_MEDICIONES);
  const id = datos.registro[0];

  borrarFilasDe(hojaR, id);
  borrarFilasDe(hojaM, id);

  const fila = datos.registro.map(textoSeguro).concat([new Date()]);
  hojaR.getRange(hojaR.getLastRow() + 1, 1, 1, fila.length).setValues([fila]);
  if (datos.mediciones.length) {
    const filas = datos.mediciones.map((m) => m.map(textoSeguro));
    hojaM.getRange(hojaM.getLastRow() + 1, 1, filas.length, ENCABEZADOS_MEDICIONES.length).setValues(filas);
  }
}

/**
 * Historial compacto para los gráficos de la app:
 *  registros: [ID, fecha 'yyyy-MM-dd', hora 'HH:mm', estación, técnico, T° ambiente, velocidad]
 *  lecturas:  [ID registro, celda Excel, temperatura]
 */
function leerHistorial(libro) {
  const zona = libro.getSpreadsheetTimeZone();
  const registros = [];
  const lecturas = [];

  const hojaR = libro.getSheetByName(HOJA_REGISTROS);
  if (hojaR && hojaR.getLastRow() > 1) {
    const rango = hojaR.getRange(2, 1, hojaR.getLastRow() - 1, 7);
    const valores = rango.getValues();
    const visibles = rango.getDisplayValues(); // la hora se lee como se ve: evita desfases de zona horaria
    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      const fecha = aFechaISO(f[1], visibles[i][1], zona);
      if (!f[0] || !fecha) continue;
      registros.push([String(f[0]), fecha, aHora(visibles[i][2]), String(f[3]), String(f[4]), aNumero(f[5]), aNumero(f[6])]);
    }
  }

  const hojaM = libro.getSheetByName(HOJA_MEDICIONES);
  if (hojaM && hojaM.getLastRow() > 1) {
    const valores = hojaM.getRange(2, 1, hojaM.getLastRow() - 1, 9).getValues();
    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      const temperatura = aNumero(f[8]);
      if (f[0] && f[7] && temperatura !== null) lecturas.push([String(f[0]), String(f[7]), temperatura]);
    }
  }
  return { registros: registros, lecturas: lecturas };
}

function aFechaISO(valor, visible, zona) {
  if (valor instanceof Date) return Utilities.formatDate(valor, zona, 'yyyy-MM-dd');
  const texto = String(visible || valor || '');
  let m = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = texto.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
}

function aHora(visible) {
  const m = String(visible || '').match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

function aNumero(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor === null || valor === undefined ? '' : valor).replace(',', '.').trim();
  return texto !== '' && !isNaN(Number(texto)) ? Number(texto) : null;
}

function validarEnvio(datos) {
  if (!Array.isArray(datos.registro) || datos.registro.length !== ENCABEZADOS_REGISTROS.length - 1) {
    throw new Error('Formato de registro no válido. Actualiza la app y el script a la misma versión.');
  }
  if (!Array.isArray(datos.mediciones) || datos.mediciones.some((m) => !Array.isArray(m) || m.length !== ENCABEZADOS_MEDICIONES.length)) {
    throw new Error('Formato de mediciones no válido.');
  }
  if (!datos.registro[0]) throw new Error('El registro no tiene ID.');
}

/** Borra las filas de un registro agrupando las consecutivas (mucho más rápido que fila por fila). */
function borrarFilasDe(hoja, id) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return;
  const ids = hoja.getRange(2, 1, ultima - 1, 1).getValues();
  let fin = -1;
  for (let i = ids.length - 1; i >= -1; i--) {
    const coincide = i >= 0 && ids[i][0] === id;
    if (coincide && fin === -1) fin = i;
    if (!coincide && fin !== -1) {
      hoja.deleteRows(i + 3, fin - i); // fila de hoja = índice + 2
      fin = -1;
    }
  }
}

function obtenerHoja(libro, nombre, encabezados) {
  let hoja = libro.getSheetByName(nombre);
  if (hoja) return hoja;
  hoja = libro.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
    .setFontWeight('bold').setBackground('#1d4e6b').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
  if (nombre === HOJA_MEDICIONES) {
    const columnaEstado = hoja.getRange(2, encabezados.indexOf('Estado') + 1, hoja.getMaxRows() - 1, 1);
    hoja.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Crítico').setBackground('#f4a3a3').setRanges([columnaEstado]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Precaución').setBackground('#ffe08a').setRanges([columnaEstado]).build(),
    ]);
  }
  return hoja;
}

/** Evita que un texto que empieza con =, +, - o @ se interprete como fórmula. */
function textoSeguro(valor) {
  if (typeof valor === 'string' && /^[=+\-@]/.test(valor)) return "'" + valor;
  return valor === null || valor === undefined ? '' : valor;
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
