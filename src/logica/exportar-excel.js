// Genera archivos Excel. Recibe ExcelJS como parámetro para funcionar igual en el navegador y en Node (pruebas).
import { CELDAS_GENERALES, CELDAS_VELOCIDAD } from '../data/estaciones.js';
import { estadoTemperatura } from './alertas.js';

const RELLENOS = {
  precaucion: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE08A' } },
  critico: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4A3A3' } },
};

/** 'AAAA-MM-DD' -> 'DD-MM-AAAA' */
export const fechaLegible = (iso) => (iso ? iso.split('-').reverse().join('-') : '');

export function nombreArchivoRegistro(registro, estacion) {
  const hora = (registro.hora || '').replace(':', '');
  return `Registro ${estacion.nombre} ${registro.fecha}${hora ? ' ' + hora : ''}.xlsx`;
}

/**
 * Rellena la planilla original con un registro y deja solo la hoja de su estación.
 * @returns {Promise<ArrayBuffer>}
 */
export async function crearExcelRegistro(ExcelJS, plantilla, registro, estacion, ajustes) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(plantilla);
  libro.creator = 'Temperatura poleas';
  libro.lastModifiedBy = registro.nombre || 'Temperatura poleas';

  // Quitar las hojas de las otras estaciones
  for (const hoja of [...libro.worksheets]) {
    if (hoja.name !== estacion.hojaExcel) libro.removeWorksheet(hoja.id);
  }
  const hoja = libro.getWorksheet(estacion.hojaExcel);
  if (!hoja) throw new Error(`La plantilla no tiene la hoja "${estacion.hojaExcel}".`);

  hoja.getCell(CELDAS_GENERALES.nombre).value = registro.nombre || '';
  hoja.getCell(CELDAS_GENERALES.fecha).value = fechaLegible(registro.fecha);
  hoja.getCell(CELDAS_GENERALES.hora).value = registro.hora || '';
  hoja.getCell(CELDAS_GENERALES.temperaturaAmbiente).value = registro.temperaturaAmbiente ?? null;

  // Velocidad: se marca la opción elegida con ☒ y las demás con ☐
  for (const [velocidad, ref] of Object.entries(CELDAS_VELOCIDAD)) {
    const marcada = Number(velocidad) === registro.velocidad;
    hoja.getCell(ref).value = `${marcada ? '☒' : '☐'} ${velocidad} m/s`;
  }

  for (const seccion of estacion.secciones) {
    for (const polea of seccion.poleas) {
      const valor = registro.lecturas[polea.celda];
      if (typeof valor !== 'number') continue;
      const celda = hoja.getCell(polea.celda);
      celda.value = valor;
      // ExcelJS comparte el objeto de estilo entre celdas con el mismo formato:
      // se copia antes de modificarlo para que el color no se traspase a otras celdas.
      const estado = estadoTemperatura(valor, registro.temperaturaAmbiente, ajustes);
      const estilo = { ...celda.style, numFmt: '0.0 "°C"' };
      if (estado && RELLENOS[estado.id]) estilo.fill = RELLENOS[estado.id];
      celda.style = estilo;
    }
  }

  if (registro.observaciones?.trim()) {
    const fila = hoja.rowCount + 2;
    hoja.getCell(`C${fila}`).value = 'Observaciones';
    hoja.getCell(`C${fila}`).font = { bold: true };
    hoja.mergeCells(`D${fila}:F${fila}`);
    const obs = hoja.getCell(`D${fila}`);
    obs.value = registro.observaciones.trim();
    obs.alignment = { wrapText: true, vertical: 'top' };
    hoja.getRow(fila).height = 60;
    hoja.pageSetup.printArea = `C2:F${fila}`; // que las observaciones también se impriman
  }

  return libro.xlsx.writeBuffer();
}

/**
 * Historial en formato tabla (una fila por medición), listo para filtrar o hacer tablas dinámicas.
 * @returns {Promise<ArrayBuffer>}
 */
export async function crearExcelHistorial(ExcelJS, registros, estaciones, ajustes) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Temperatura poleas';
  const hoja = libro.addWorksheet('Historial', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Estación', key: 'estacion', width: 11 },
    { header: 'Técnico', key: 'nombre', width: 22 },
    { header: 'T° ambiente (°C)', key: 'ambiente', width: 16 },
    { header: 'Velocidad (m/s)', key: 'velocidad', width: 15 },
    { header: 'Sección', key: 'seccion', width: 38 },
    { header: 'Polea', key: 'polea', width: 34 },
    { header: 'Temperatura (°C)', key: 'temperatura', width: 17 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Observaciones', key: 'observaciones', width: 40 },
  ];
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4E6B' } };

  const porId = new Map(estaciones.map((e) => [e.id, e]));
  const ordenados = [...registros].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));

  for (const registro of ordenados) {
    const estacion = porId.get(registro.estacionId);
    if (!estacion) continue;
    for (const seccion of estacion.secciones) {
      for (const polea of seccion.poleas) {
        const valor = registro.lecturas[polea.celda];
        if (typeof valor !== 'number') continue;
        const estado = estadoTemperatura(valor, registro.temperaturaAmbiente, ajustes);
        const fila = hoja.addRow({
          fecha: fechaLegible(registro.fecha),
          hora: registro.hora,
          estacion: estacion.nombre,
          nombre: registro.nombre,
          ambiente: registro.temperaturaAmbiente ?? null,
          velocidad: registro.velocidad ?? null,
          seccion: seccion.titulo,
          polea: polea.nombre,
          temperatura: valor,
          estado: estado?.etiqueta ?? '',
          observaciones: registro.observaciones || '',
        });
        if (estado && RELLENOS[estado.id]) {
          fila.getCell('temperatura').fill = RELLENOS[estado.id];
          fila.getCell('estado').fill = RELLENOS[estado.id];
        }
      }
    }
  }
  hoja.autoFilter = { from: 'A1', to: 'K1' };
  return libro.xlsx.writeBuffer();
}
