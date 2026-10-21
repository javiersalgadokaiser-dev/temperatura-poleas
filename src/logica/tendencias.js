// Datos para los gráficos de tendencia. Sin dependencias del navegador (se prueba en Node).
import { estadoTemperatura } from './alertas.js';

export const PERIODOS = [
  { id: '6m', etiqueta: 'Últimos 6 meses', meses: 6 },
  { id: '1a', etiqueta: 'Último año', meses: 12 },
  { id: '2a', etiqueta: 'Últimos 2 años', meses: 24 },
  { id: 'todo', etiqueta: 'Todo el historial', meses: null },
];

/** Fecha 'AAAA-MM-DD' desde la que se muestran datos, o null para todo el historial. */
export function inicioPeriodo(periodoId, hoyISO) {
  const periodo = PERIODOS.find((p) => p.id === periodoId);
  if (!periodo?.meses) return null;
  const [a, m, d] = hoyISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 - periodo.meses, d));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Une el historial de Google Sheets con los registros finalizados del teléfono.
 * Si un registro está en ambos, manda el del teléfono (puede tener correcciones aún sin enviar).
 * @param {{registros: any[][], lecturas: any[][]} | null} nube respuesta de la acción "historial"
 */
export function combinarHistorial(nube, locales, estaciones) {
  const porNombre = new Map(estaciones.map((e) => [e.nombre.toLowerCase(), e.id]));
  const porId = new Map();

  if (nube) {
    for (const [id, fecha, hora, estacion, nombre, ambiente, velocidad] of nube.registros || []) {
      const estacionId = porNombre.get(String(estacion).trim().toLowerCase());
      if (!estacionId || !fecha) continue;
      porId.set(id, { id, estacionId, fecha, hora: hora || '', nombre, temperaturaAmbiente: ambiente ?? null, velocidad, lecturas: {}, origen: 'nube' });
    }
    for (const [id, celda, valor] of nube.lecturas || []) {
      const r = porId.get(id);
      if (r && typeof valor === 'number') r.lecturas[celda] = valor;
    }
  }
  for (const r of locales) {
    if (r.estado === 'completo') porId.set(r.id, { ...r, origen: 'local' });
  }
  return [...porId.values()];
}

/** Marca de tiempo local a partir de fecha y hora (las horas vacías se toman como mediodía). */
export function marcaTiempo(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = /^\d{1,2}:\d{2}$/.test(hora || '') ? hora.split(':').map(Number) : [12, 0];
  return new Date(a, m - 1, d, hh, mm).getTime();
}

/** Puntos de un componente (celda) de una estación, ordenados en el tiempo. */
export function serieComponente(registros, estacionId, celda, desdeISO, ajustes) {
  return registros
    .filter((r) => r.estacionId === estacionId && typeof r.lecturas[celda] === 'number' && (!desdeISO || r.fecha >= desdeISO))
    .map((r) => ({
      t: marcaTiempo(r.fecha, r.hora),
      fecha: r.fecha,
      hora: r.hora,
      valor: r.lecturas[celda],
      ambiente: typeof r.temperaturaAmbiente === 'number' ? r.temperaturaAmbiente : null,
      nombre: r.nombre || '',
      estado: estadoTemperatura(r.lecturas[celda], r.temperaturaAmbiente, ajustes),
      id: r.id,
    }))
    .sort((a, b) => a.t - b.t);
}

export function resumenSerie(puntos) {
  if (!puntos.length) return null;
  const maxima = puntos.reduce((m, p) => (p.valor > m.valor ? p : m), puntos[0]);
  const promedio = puntos.reduce((s, p) => s + p.valor, 0) / puntos.length;
  return { ultima: puntos.at(-1), maxima, promedio: Math.round(promedio * 10) / 10, cantidad: puntos.length };
}

/** Celdas de la estación que tienen al menos una lectura (para marcar en el filtro las que no tienen datos). */
export function componentesConDatos(registros, estacionId) {
  const celdas = new Set();
  for (const r of registros) if (r.estacionId === estacionId) for (const c of Object.keys(r.lecturas)) celdas.add(c);
  return celdas;
}

/**
 * Marcas del eje X al inicio de cada mes, espaciadas para que no haya más de `maximo` etiquetas.
 * Devuelve marcas de tiempo locales.
 */
export function marcasMensuales(minT, maxT, maximo = 6) {
  const inicio = new Date(minT);
  const fin = new Date(maxT);
  const totalMeses = (fin.getFullYear() - inicio.getFullYear()) * 12 + fin.getMonth() - inicio.getMonth() + 1;
  const paso = [1, 2, 3, 4, 6, 12, 24].find((p) => Math.ceil(totalMeses / p) <= maximo) ?? 24;
  const marcas = [];
  // Empieza en el primer mes "redondo" según el paso (ene, abr, jul, oct para trimestres, etc.)
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
  while (cursor.getMonth() % paso !== 0 && paso <= 12) cursor.setMonth(cursor.getMonth() + 1);
  for (; cursor.getTime() <= maxT; cursor.setMonth(cursor.getMonth() + paso)) marcas.push(cursor.getTime());
  return marcas;
}
