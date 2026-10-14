// Genera src/data/estaciones.js leyendo la plantilla Excel.
// Ejecutar solo si cambia la plantilla:  node tools/generar-estaciones.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANTILLA = path.join(RAIZ, 'plantilla', 'registro-temperatura.xlsx');
const DESTINO = path.join(RAIZ, 'src', 'data', 'estaciones.js');

// Hojas de la planilla (ojo: " Tupahue" tiene un espacio al inicio en el Excel)
const HOJAS = [
  { id: 'oasis', nombre: 'Oasis', hoja: 'Oasis' },
  { id: 'tupahue', nombre: 'Tupahue', hoja: ' Tupahue' },
  { id: 'cumbre', nombre: 'Cumbre', hoja: 'Cumbre' },
];

// Títulos más claros para la app (el Excel exportado conserva los originales).
// En Tupahue las filas 58 y 61 repiten "desviación entrada bajada", pero por su contenido son de salida.
const TITULOS_CORREGIDOS = {
  tupahue: {
    11: 'Subida · poleas de entrada',
    17: 'Subida · desviación entrada',
    22: 'Subida · bananas desviación horizontal',
    28: 'Subida · desviación salida',
    33: 'Subida · poleas de salida',
    39: 'Bajada · poleas de entrada',
    45: 'Bajada · desviación entrada',
    48: 'Bajada · bananas desviación horizontal',
    58: 'Bajada · desviación salida',
    61: 'Bajada · poleas de salida',
  },
  cumbre: { 17: 'Poleas de salida' },
};

const texto = (celda) => {
  const v = celda.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
  return String(v);
};

// Limpia los sufijos numéricos que Excel dejó para diferenciar nombres repetidos ("...)2")
const limpiarNombre = (s) =>
  s.replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\)\d+$/, ')')
    .replace(/"\)\d+$/, '")')
    .replace(/^Guarnicion$/, 'Guarnición')
    .trim();

const limpiarTitulo = (s) => {
  const t = s.replace(/^Indique las temperaturas de (la|las)\s+/i, '').replace(/Desviación/g, 'desviación').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

async function main() {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(PLANTILLA);
  const estaciones = [];

  for (const def of HOJAS) {
    const hoja = libro.getWorksheet(def.hoja);
    if (!hoja) throw new Error(`No se encontró la hoja "${def.hoja}"`);
    const secciones = [];
    let actual = null;

    for (let fila = 8; fila <= hoja.rowCount; fila++) {
      const c = texto(hoja.getCell(`C${fila}`)).trim();
      if (/^Indique/i.test(c)) {
        const titulo = TITULOS_CORREGIDOS[def.id]?.[fila] ?? limpiarTitulo(c);
        actual = { titulo, filaExcel: fila, poleas: [] };
        secciones.push(actual);
        continue;
      }
      if (!actual) continue;
      // Etiqueta en C -> valor en D; etiqueta en E -> valor en F
      for (const [colEtiqueta, colValor] of [['C', 'D'], ['E', 'F']]) {
        const etiqueta = texto(hoja.getCell(`${colEtiqueta}${fila}`)).trim();
        if (etiqueta) actual.poleas.push({ celda: `${colValor}${fila}`, nombre: limpiarNombre(etiqueta) });
      }
    }
    estaciones.push({ id: def.id, nombre: def.nombre, hojaExcel: def.hoja, secciones });
  }

  const total = (e) => e.secciones.reduce((n, s) => n + s.poleas.length, 0);
  const contenido =
    '// Archivo generado por tools/generar-estaciones.js a partir de plantilla/registro-temperatura.xlsx.\n' +
    '// Cada polea guarda la celda del Excel donde se escribe su temperatura.\n\n' +
    '// Celdas de los datos generales (iguales en las tres hojas)\n' +
    "export const CELDAS_GENERALES = { nombre: 'D4', fecha: 'F4', hora: 'D5', temperaturaAmbiente: 'F5' };\n\n" +
    '// Celdas con las opciones de velocidad del sistema\n' +
    "export const CELDAS_VELOCIDAD = { 3: 'C7', 4: 'D7', 5: 'F7' };\n\n" +
    `export const ESTACIONES = ${JSON.stringify(estaciones, null, 2)};\n`;
  fs.writeFileSync(DESTINO, contenido, 'utf8');
  estaciones.forEach((e) => console.log(`${e.nombre}: ${e.secciones.length} secciones, ${total(e)} puntos de medición`));
}

main().catch((e) => { console.error(e); process.exit(1); });
