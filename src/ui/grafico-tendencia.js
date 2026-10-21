// Gráfico de líneas de un componente en el tiempo (Chart.js), con el tema de la app.
// Un solo eje en °C: la temperatura del componente es la serie principal y el ambiente es contexto en gris.
import { marcasMensuales } from '../logica/tendencias.js';
import { fechaLegible } from '../logica/exportar-excel.js';
import { formatoTemp } from './utilidades.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_MS = 864e5;

function leerTokens() {
  const estilos = getComputedStyle(document.documentElement);
  const v = (nombre) => estilos.getPropertyValue(nombre).trim();
  return {
    serie: v('--viz-serie'), contexto: v('--viz-contexto'), grilla: v('--viz-grilla'), eje: v('--viz-eje'),
    precaucion: v('--viz-precaucion'), critico: v('--viz-critico'),
    texto: v('--c-texto'), textoSuave: v('--c-texto-suave'), superficie: v('--c-superficie'), fuente: v('--fuente'),
  };
}

/** Rango del eje Y: incluye el umbral de precaución como referencia, y el crítico solo si los datos se acercan. */
function rangoY(puntos, umbrales) {
  const valores = puntos.flatMap((p) => (p.ambiente === null ? [p.valor] : [p.valor, p.ambiente]));
  const maxDatos = Math.max(...valores);
  let min = Math.min(...valores);
  let max = Math.max(maxDatos, umbrales.precaucion ?? -Infinity);
  const mostrarCritico = typeof umbrales.critico === 'number' && maxDatos >= (umbrales.precaucion ?? Infinity);
  if (mostrarCritico) max = Math.max(max, umbrales.critico);
  // Límites alineados con el paso de las marcas, para que el eje tenga un ritmo parejo (0, 20, 40, 60, 80)
  const paso = max - min > 50 ? 20 : max - min > 25 ? 10 : 5;
  min = Math.floor((min - 2) / paso) * paso;
  max = Math.ceil((max + 2) / paso) * paso;
  return { min, max, paso, mostrarCritico };
}

/**
 * @param {HTMLElement} caja contenedor con posición relativa; aquí se crean el canvas y el tooltip
 * @param {typeof window.Chart} Chart
 */
export function crearGraficoTendencia(caja, Chart) {
  caja.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip-grafico';
  tooltip.hidden = true;
  caja.append(canvas, tooltip);

  let puntos = [];
  let umbrales = {};
  let nombreSerie = '';
  let tokens = leerTokens();
  let indiceTeclado = null;

  // Línea vertical que sigue al puntero y se ajusta a la fecha más cercana
  const pluginCursor = {
    id: 'cursorVertical',
    afterDatasetsDraw(chart) {
      const activo = chart.tooltip?.getActiveElements?.()[0];
      if (!activo) return;
      const { ctx, chartArea } = chart;
      const x = activo.element.x;
      ctx.save();
      ctx.strokeStyle = tokens.textoSuave;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  // Etiquetas directas: valor de la última lectura y nombre de cada umbral (en tinta de texto, nunca en color de serie)
  const pluginEtiquetas = {
    id: 'etiquetasDirectas',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      ctx.font = `12px ${tokens.fuente}`;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillStyle = tokens.textoSuave;
      const umbralesVisibles = [['Precaución', umbrales.precaucion, 2], ['Crítico', umbrales.critico, 3]];
      for (const [nombre, valor, indice] of umbralesVisibles) {
        if (typeof valor !== 'number' || chart.data.datasets[indice]?.hidden) continue;
        const y = scales.y.getPixelForValue(valor);
        if (y < chartArea.top || y > chartArea.bottom) continue;
        ctx.fillText(`${nombre} ${formatoTemp(valor)}`, chartArea.left + 6, y - 3);
      }
      const ultimo = chart.getDatasetMeta(0).data.at(-1);
      if (ultimo && puntos.length) {
        ctx.font = `600 12px ${tokens.fuente}`;
        ctx.fillStyle = tokens.texto;
        ctx.textBaseline = 'middle';
        ctx.fillText(formatoTemp(puntos.at(-1).valor), ultimo.x + 8, ultimo.y);
      }
      ctx.restore();
    },
  };

  const colorPunto = (p) => (p.estado?.id === 'critico' ? tokens.critico : p.estado?.id === 'precaucion' ? tokens.precaucion : tokens.serie);

  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets: [] },
    plugins: [pluginCursor, pluginEtiquetas],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      layout: { padding: { right: 56, top: 8 } },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, filter: (item) => item.datasetIndex === 0, external: (ctx) => pintarTooltip(ctx) },
      },
      scales: {
        x: { type: 'linear', ticks: {}, grid: {}, border: {} },
        y: { type: 'linear', ticks: {}, grid: {}, border: {} },
      },
    },
  });

  function pintarTooltip({ chart: c, tooltip: modelo }) {
    const item = modelo.dataPoints?.find((d) => d.datasetIndex === 0);
    if (!modelo.opacity || !item) {
      tooltip.hidden = true;
      return;
    }
    const p = puntos[item.dataIndex];
    tooltip.replaceChildren();
    const linea = (clase, valor, etiqueta, color) => {
      const fila = document.createElement('div');
      fila.className = `tooltip-grafico__fila ${clase}`;
      if (color) {
        const llave = document.createElement('span');
        llave.className = 'tooltip-grafico__llave';
        llave.style.background = color;
        fila.append(llave);
      }
      const fuerte = document.createElement('strong');
      fuerte.textContent = valor;
      const suave = document.createElement('span');
      suave.textContent = etiqueta;
      fila.append(fuerte, suave);
      tooltip.append(fila);
    };
    const titulo = document.createElement('div');
    titulo.className = 'tooltip-grafico__titulo';
    titulo.textContent = `${fechaLegible(p.fecha)}${p.hora ? ` · ${p.hora}` : ''}`;
    tooltip.append(titulo);
    linea('', formatoTemp(p.valor), nombreSerie, colorPunto(p));
    if (p.estado && p.estado.id !== 'normal') {
      linea('tooltip-grafico__estado', p.estado.id === 'critico' ? '⛔ Crítico' : '⚠ Precaución', '', null);
    }
    if (p.ambiente !== null) linea('', formatoTemp(p.ambiente), 'Ambiente', tokens.contexto);
    if (p.nombre) {
      const pie = document.createElement('div');
      pie.className = 'tooltip-grafico__pie';
      pie.textContent = p.nombre;
      tooltip.append(pie);
    }
    tooltip.hidden = false;
    // Se ubica al lado del punto sin salirse del gráfico
    const ancho = tooltip.offsetWidth;
    const x = item.element.x;
    const izquierda = x + 12 + ancho > c.width ? x - 12 - ancho : x + 12; // c.width ya está en píxeles CSS
    tooltip.style.left = `${Math.max(0, izquierda)}px`;
    tooltip.style.top = `${c.chartArea.top}px`;
  }

  function aplicarTema() {
    tokens = leerTokens();
    const o = chart.options;
    for (const eje of [o.scales.x, o.scales.y]) {
      eje.ticks.color = tokens.textoSuave;
      eje.ticks.font = { size: 12, family: tokens.fuente };
      eje.grid.color = tokens.grilla;
      eje.grid.lineWidth = 1;
      eje.border.color = tokens.eje;
    }
    o.scales.x.grid.display = false;
    const [serie, ambiente, precaucion, critico] = chart.data.datasets;
    if (serie) {
      serie.borderColor = tokens.serie;
      serie.pointBackgroundColor = puntos.map(colorPunto);
      serie.pointBorderColor = tokens.superficie;
      serie.pointHoverBorderColor = tokens.superficie;
      serie.pointHoverBackgroundColor = puntos.map(colorPunto);
      ambiente.borderColor = tokens.contexto;
      ambiente.pointHoverBackgroundColor = tokens.contexto;
      precaucion.borderColor = tokens.precaucion;
      critico.borderColor = tokens.critico;
    }
  }

  /** @param {{puntos: any[], umbrales: {precaucion:number, critico:number}, nombreSerie: string, descripcion: string}} datos */
  function actualizar(datos) {
    puntos = datos.puntos;
    umbrales = datos.umbrales;
    nombreSerie = datos.nombreSerie;
    indiceTeclado = null;
    tooltip.hidden = true;
    if (!puntos.length) {
      chart.data.datasets = [];
      chart.update();
      return;
    }
    const minT = puntos[0].t;
    const maxT = puntos.at(-1).t;
    const margen = Math.max((maxT - minT) * 0.03, 10 * DIA_MS);
    const { min, max, paso, mostrarCritico } = rangoY(puntos, umbrales);
    const linea = (valor, oculto) => ({
      data: [{ x: minT - margen, y: valor }, { x: maxT + margen, y: valor }],
      borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0, hidden: oculto,
    });

    chart.data.datasets = [
      {
        label: 'Componente',
        data: puntos.map((p) => ({ x: p.t, y: p.valor })),
        borderWidth: 2, borderJoinStyle: 'round', borderCapStyle: 'round', tension: 0,
        pointRadius: 4, pointBorderWidth: 2, pointHoverRadius: 6, pointHoverBorderWidth: 2, pointHitRadius: 12,
      },
      {
        label: 'Ambiente',
        data: puntos.filter((p) => p.ambiente !== null).map((p) => ({ x: p.t, y: p.ambiente })),
        borderWidth: 2, tension: 0, pointRadius: 0, pointHoverRadius: 4,
      },
      linea(umbrales.precaucion, typeof umbrales.precaucion !== 'number'),
      linea(umbrales.critico, !mostrarCritico),
    ];
    const marcas = marcasMensuales(minT, maxT, caja.clientWidth < 480 ? 4 : 7);
    const x = chart.options.scales.x;
    x.min = minT - margen;
    x.max = maxT + margen;
    x.afterBuildTicks = (eje) => {
      eje.ticks = (marcas.length >= 2 ? marcas : [minT, maxT]).map((value) => ({ value }));
    };
    x.ticks.callback = (valor) => {
      const d = new Date(valor);
      return `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    };
    const y = chart.options.scales.y;
    y.min = min;
    y.max = max;
    y.ticks.stepSize = paso;
    y.ticks.callback = (valor) => `${valor} °C`;
    aplicarTema();
    chart.update();
    canvas.setAttribute('aria-label', datos.descripcion);
  }

  // Teclado: flechas para recorrer las lecturas (muestra lo mismo que el puntero)
  function enfocarPunto(indice) {
    if (!puntos.length) return;
    indiceTeclado = Math.max(0, Math.min(puntos.length - 1, indice));
    const elemento = chart.getDatasetMeta(0).data[indiceTeclado];
    const activos = [{ datasetIndex: 0, index: indiceTeclado }];
    chart.setActiveElements(activos);
    chart.tooltip.setActiveElements(activos, { x: elemento.x, y: elemento.y });
    chart.update();
  }
  const alTeclear = (ev) => {
    const mapa = { ArrowRight: 1, ArrowLeft: -1 };
    if (ev.key in mapa) enfocarPunto((indiceTeclado ?? puntos.length - 1) + (indiceTeclado === null ? 0 : mapa[ev.key]));
    else if (ev.key === 'Home') enfocarPunto(0);
    else if (ev.key === 'End') enfocarPunto(puntos.length - 1);
    else return;
    ev.preventDefault();
  };
  const alSalir = () => {
    indiceTeclado = null;
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    tooltip.hidden = true;
    chart.update();
  };
  canvas.addEventListener('keydown', alTeclear);
  canvas.addEventListener('blur', alSalir);
  canvas.addEventListener('mouseleave', () => (tooltip.hidden = true));

  // Cambio de tema (sistema o selector del visor): se vuelven a leer los colores
  const consultaOscuro = matchMedia('(prefers-color-scheme: dark)');
  const alCambiarTema = () => {
    aplicarTema();
    chart.update();
  };
  consultaOscuro.addEventListener('change', alCambiarTema);
  const observador = new MutationObserver(alCambiarTema);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    actualizar,
    destruir() {
      consultaOscuro.removeEventListener('change', alCambiarTema);
      observador.disconnect();
      chart.destroy();
    },
  };
}
