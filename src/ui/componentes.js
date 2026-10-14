// Piezas de interfaz reutilizables entre vistas.
import { ESTACIONES } from '../data/estaciones.js';
import { resumenRegistro } from '../logica/alertas.js';
import { fechaLegible } from '../logica/exportar-excel.js';
import { nubeConfigurada } from '../logica/nube.js';
import { estaPendiente } from '../data/nube.js';
import { esc, formatoTemp } from './utilidades.js';

export const estacionPorId = (id) => ESTACIONES.find((e) => e.id === id);

export const totalPuntos = (estacion) => estacion.secciones.reduce((n, s) => n + s.poleas.length, 0);

/** Fila de lista con fecha, estación, técnico, avance y alertas de un registro. */
export function tarjetaRegistro(registro, ajustes) {
  const estacion = estacionPorId(registro.estacionId);
  if (!estacion) return '';
  const r = resumenRegistro(registro, estacion, ajustes);
  const chips = [
    registro.estado !== 'completo' ? `<span class="chip chip--borrador">Borrador · ${r.medidas}/${r.total}</span>` : '',
    r.critico ? `<span class="chip chip--critico">${r.critico} crítica${r.critico > 1 ? 's' : ''}</span>` : '',
    r.precaucion ? `<span class="chip chip--precaucion">${r.precaucion} en precaución</span>` : '',
    registro.estado === 'completo' && !r.critico && !r.precaucion ? '<span class="chip chip--normal">Todo normal</span>' : '',
    registro.estado === 'completo' && nubeConfigurada(ajustes)
      ? estaPendiente(registro)
        ? '<span class="chip chip--pendiente">Sin enviar</span>'
        : '<span class="chip chip--nube">✓ En Sheets</span>'
      : '',
  ].join('');
  return `
    <li>
      <a class="registro-item" href="#/registro/${esc(registro.id)}">
        <span class="registro-item__estacion" aria-hidden="true">${esc(estacion.nombre.charAt(0))}</span>
        <span class="registro-item__cuerpo">
          <span class="registro-item__titulo">${esc(estacion.nombre)} · ${esc(fechaLegible(registro.fecha))} ${esc(registro.hora || '')}</span>
          <span class="registro-item__detalle">${esc(registro.nombre || 'Sin técnico')}${r.maxima ? ` · máx. ${esc(formatoTemp(r.maxima.valor))}` : ''}</span>
          <span class="registro-item__chips">${chips}</span>
        </span>
        <span class="registro-item__flecha" aria-hidden="true">›</span>
      </a>
    </li>`;
}
