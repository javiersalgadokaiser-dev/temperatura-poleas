// Gráficos: tendencia de temperatura por componente, con filtros de estación, componente y período.
// Datos: historial de Google Sheets (en caché para verlo sin señal) + registros finalizados del teléfono.
import { ESTACIONES } from '../data/estaciones.js';
import { registros as repo } from '../data/db.js';
import { descargarHistorial, historialEnCache } from '../data/nube.js';
import { nubeConfigurada } from '../logica/nube.js';
import {
  PERIODOS, inicioPeriodo, combinarHistorial, serieComponente, resumenSerie, componentesConDatos,
} from '../logica/tendencias.js';
import { fechaLegible } from '../logica/exportar-excel.js';
import { app } from './estado.js';
import { $, $$, esc, formatoTemp, hoyISO, cargarChartJS } from './utilidades.js';
import { crearGraficoTendencia } from './grafico-tendencia.js';

// Los filtros se recuerdan mientras la app esté abierta
const filtros = { estacionId: ESTACIONES[0].id, celda: null, periodo: '1a' };

const fechaHora = (iso) => {
  const d = new Date(iso);
  return `${fechaLegible(iso.slice(0, 10))} ${d.toTimeString().slice(0, 5)}`;
};

export async function vistaGraficos(contenedor) {
  let activa = true;
  let registros = [];
  let grafico = null;

  contenedor.innerHTML = `
    <section class="pagina">
      <header class="encabezado">
        <h1 class="encabezado__titulo">Gráficos</h1>
        <p class="encabezado__sub">Tendencia de temperatura por componente</p>
      </header>

      <div class="filtros" role="radiogroup" aria-label="Estación">
        ${ESTACIONES.map((e) => `<button class="chip-filtro" role="radio" data-estacion="${e.id}" aria-checked="${e.id === filtros.estacionId}">${esc(e.nombre)}</button>`).join('')}
      </div>

      <div class="fila-filtros">
        <div class="campo campo--componente">
          <label for="g-componente">Componente</label>
          <select id="g-componente"></select>
        </div>
        <div class="campo">
          <label for="g-periodo">Período</label>
          <select id="g-periodo">
            ${PERIODOS.map((p) => `<option value="${p.id}" ${p.id === filtros.periodo ? 'selected' : ''}>${esc(p.etiqueta)}</option>`).join('')}
          </select>
        </div>
      </div>

      <p id="g-origen" class="ayuda" aria-live="polite"></p>

      <div id="g-resumen" class="resumen-grafico"></div>

      <section class="tarjeta tarjeta-grafico" aria-labelledby="g-titulo">
        <div class="tarjeta-grafico__cabecera">
          <h2 class="tarjeta__titulo" id="g-titulo"></h2>
          <p class="ayuda" id="g-subtitulo"></p>
        </div>
        <ul class="leyenda" id="g-leyenda" aria-label="Leyenda"></ul>
        <div class="caja-grafico" id="g-caja"></div>
        <p class="vacio" id="g-vacio" hidden></p>
        <p class="ayuda ayuda--grafico">Toca el gráfico o usa las flechas del teclado para ver cada lectura.</p>
      </section>

      <details class="tarjeta" id="g-tabla-detalle">
        <summary class="tarjeta__titulo">Ver datos en tabla</summary>
        <div class="tabla-desplazable"><table class="tabla" id="g-tabla"></table></div>
      </details>
    </section>`;

  const estacionActual = () => ESTACIONES.find((e) => e.id === filtros.estacionId);
  const selectComponente = $('#g-componente', contenedor);
  const origen = $('#g-origen', contenedor);

  function llenarComponentes() {
    const estacion = estacionActual();
    const conDatos = componentesConDatos(registros, estacion.id);
    const todas = estacion.secciones.flatMap((s) => s.poleas.map((p) => p.celda));
    if (!filtros.celda || !todas.includes(filtros.celda)) filtros.celda = todas.find((c) => conDatos.has(c)) ?? todas[0];
    selectComponente.innerHTML = estacion.secciones.map((s) => `
      <optgroup label="${esc(s.titulo)}">
        ${s.poleas.map((p) => `<option value="${p.celda}" ${p.celda === filtros.celda ? 'selected' : ''}>${esc(p.nombre)}${conDatos.has(p.celda) ? '' : ' (sin datos)'}</option>`).join('')}
      </optgroup>`).join('');
  }

  function pintar() {
    if (!activa) return;
    const estacion = estacionActual();
    const seccion = estacion.secciones.find((s) => s.poleas.some((p) => p.celda === filtros.celda));
    const polea = seccion.poleas.find((p) => p.celda === filtros.celda);
    const ajustes = app.ajustes;
    const puntos = serieComponente(registros, estacion.id, filtros.celda, inicioPeriodo(filtros.periodo, hoyISO()), ajustes);
    const resumen = resumenSerie(puntos);
    const periodo = PERIODOS.find((p) => p.id === filtros.periodo);

    $('#g-titulo', contenedor).textContent = polea.nombre;
    $('#g-subtitulo', contenedor).textContent = `${estacion.nombre} · ${seccion.titulo} · ${periodo.etiqueta.toLowerCase()}`;

    // Resumen en cifras (la última lectura incluye su estado con ícono y texto)
    const estadoChip = (estado) => (!estado || estado.id === 'normal'
      ? '<span class="chip chip--normal">Normal</span>'
      : `<span class="chip chip--${estado.id}">${estado.id === 'critico' ? '⛔' : '⚠'} ${esc(estado.etiqueta)}</span>`);
    $('#g-resumen', contenedor).innerHTML = resumen ? `
      <div class="cifra"><span class="cifra__etiqueta">Última lectura</span><span class="cifra__valor">${esc(formatoTemp(resumen.ultima.valor))}</span>
        <span class="cifra__detalle">${esc(fechaLegible(resumen.ultima.fecha))} ${estadoChip(resumen.ultima.estado)}</span></div>
      <div class="cifra"><span class="cifra__etiqueta">Máxima</span><span class="cifra__valor">${esc(formatoTemp(resumen.maxima.valor))}</span>
        <span class="cifra__detalle">${esc(fechaLegible(resumen.maxima.fecha))}</span></div>
      <div class="cifra"><span class="cifra__etiqueta">Promedio</span><span class="cifra__valor">${esc(formatoTemp(resumen.promedio))}</span>
        <span class="cifra__detalle">${resumen.cantidad} lectura${resumen.cantidad === 1 ? '' : 's'}</span></div>` : '';

    // Leyenda: siempre presente con dos series; claves de línea, texto en tinta de texto
    const hayAmbiente = puntos.some((p) => p.ambiente !== null);
    $('#g-leyenda', contenedor).innerHTML = puntos.length ? `
      <li><span class="leyenda__llave leyenda__llave--serie"></span>${esc(polea.nombre)}</li>
      ${hayAmbiente ? '<li><span class="leyenda__llave leyenda__llave--contexto"></span>Temperatura ambiente</li>' : ''}
      <li><span class="leyenda__llave leyenda__llave--precaucion"></span>⚠ Precaución desde ${esc(formatoTemp(ajustes.umbralPrecaucion))}</li>
      <li><span class="leyenda__llave leyenda__llave--critico"></span>⛔ Crítico desde ${esc(formatoTemp(ajustes.umbralCritico))}</li>` : '';

    const vacio = $('#g-vacio', contenedor);
    const caja = $('#g-caja', contenedor);
    vacio.hidden = puntos.length > 0;
    caja.hidden = puntos.length === 0;
    vacio.textContent = registros.some((r) => r.estacionId === estacion.id)
      ? `No hay lecturas de ${polea.nombre} en ${periodo.etiqueta.toLowerCase()}. Prueba con un período más largo u otro componente.`
      : `Aún no hay registros de ${estacion.nombre}.`;

    grafico?.actualizar({
      puntos,
      umbrales: { precaucion: ajustes.umbralPrecaucion, critico: ajustes.umbralCritico },
      nombreSerie: polea.nombre,
      descripcion: resumen
        ? `Gráfico de líneas de ${polea.nombre} en ${estacion.nombre}: ${resumen.cantidad} lecturas, última ${formatoTemp(resumen.ultima.valor)} el ${fechaLegible(resumen.ultima.fecha)}, máxima ${formatoTemp(resumen.maxima.valor)}. Los datos están en la tabla.`
        : 'Sin datos',
    });

    // Tabla equivalente (más reciente primero)
    $('#g-tabla', contenedor).innerHTML = puntos.length ? `
      <thead><tr><th scope="col">Fecha</th><th scope="col">Hora</th><th scope="col" class="num">Temperatura</th><th scope="col" class="num">Ambiente</th><th scope="col">Estado</th><th scope="col">Técnico</th></tr></thead>
      <tbody>${[...puntos].reverse().map((p) => `
        <tr><td>${esc(fechaLegible(p.fecha))}</td><td>${esc(p.hora)}</td><td class="num">${esc(formatoTemp(p.valor))}</td>
        <td class="num">${p.ambiente === null ? '—' : esc(formatoTemp(p.ambiente))}</td><td>${esc(p.estado?.etiqueta ?? '')}</td><td>${esc(p.nombre)}</td></tr>`).join('')}
      </tbody>` : '<tbody><tr><td>Sin datos para mostrar.</td></tr></tbody>';
  }

  // ---------- Filtros ----------
  $('.filtros', contenedor).addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-estacion]');
    if (!boton || boton.dataset.estacion === filtros.estacionId) return;
    filtros.estacionId = boton.dataset.estacion;
    filtros.celda = null;
    $$('[data-estacion]', contenedor).forEach((b) => b.setAttribute('aria-checked', String(b === boton)));
    llenarComponentes();
    pintar();
  });
  selectComponente.addEventListener('change', () => {
    filtros.celda = selectComponente.value;
    pintar();
  });
  $('#g-periodo', contenedor).addEventListener('change', (ev) => {
    filtros.periodo = ev.target.value;
    pintar();
  });

  // ---------- Datos: primero lo guardado (instantáneo), luego se actualiza desde Google ----------
  const locales = await repo.listar();
  let enCache = null;
  try {
    enCache = await historialEnCache();
  } catch {
    /* sin caché: se sigue con los datos locales */
  }
  registros = combinarHistorial(enCache, locales, ESTACIONES);
  if (!activa) return undefined;
  llenarComponentes();

  try {
    const Chart = await cargarChartJS();
    if (!activa) return undefined;
    grafico = crearGraficoTendencia($('#g-caja', contenedor), Chart);
  } catch (e) {
    $('#g-caja', contenedor).innerHTML = `<p class="vacio">${esc(e.message)} Puedes ver los datos en la tabla.</p>`;
  }
  pintar();

  const describirOrigen = (h, extra = '') => {
    if (!nubeConfigurada(app.ajustes)) {
      origen.innerHTML = 'Solo se muestran los registros de este teléfono. <a href="#/ajustes">Configura Google Sheets</a> para ver el historial completo.';
    } else if (h) {
      origen.textContent = `Historial de Google Sheets del ${fechaHora(h.descargadoEn)} (${h.registros.length} registros)${extra}`;
    } else {
      origen.textContent = `Sin historial de Google Sheets guardado${extra}`;
    }
  };
  describirOrigen(enCache);

  if (nubeConfigurada(app.ajustes)) {
    if (!navigator.onLine) {
      describirOrigen(enCache, ' · sin conexión, se actualizará cuando vuelva la señal.');
    } else {
      describirOrigen(enCache, ' · actualizando…');
      $('#g-caja', contenedor).classList.add('actualizando'); // se mantiene el gráfico anterior atenuado
      descargarHistorial(app.ajustes)
        .then((h) => {
          if (!activa) return;
          registros = combinarHistorial(h, locales, ESTACIONES);
          llenarComponentes();
          pintar();
          describirOrigen(h);
        })
        .catch((e) => activa && describirOrigen(enCache, ` · no se pudo actualizar: ${e.message}`))
        .finally(() => activa && $('#g-caja', contenedor)?.classList.remove('actualizando'));
    }
  }

  return () => {
    activa = false;
    grafico?.destruir();
  };
}
