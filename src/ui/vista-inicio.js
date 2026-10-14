// Inicio: elegir estación para un nuevo registro y retomar borradores.
import { ESTACIONES } from '../data/estaciones.js';
import { registros as repo } from '../data/db.js';
import { fechaLegible } from '../logica/exportar-excel.js';
import { nubeConfigurada } from '../logica/nube.js';
import { estaPendiente } from '../data/nube.js';
import { app } from './estado.js';
import { $, esc } from './utilidades.js';
import { tarjetaRegistro, totalPuntos } from './componentes.js';

export async function vistaInicio(contenedor) {
  contenedorVisible = contenedor;
  const lista = await repo.listar();
  if (contenedorVisible !== contenedor) return undefined; // se cambió de pantalla mientras se leían los datos
  const borradores = lista.filter((r) => r.estado !== 'completo');
  const recientes = lista.filter((r) => r.estado === 'completo').slice(0, 5);
  const ultimoPorEstacion = (id) => lista.find((r) => r.estacionId === id && r.estado === 'completo');
  const configurada = nubeConfigurada(app.ajustes);
  const sinEnviar = lista.filter(estaPendiente).length;

  const bannerNube = !configurada
    ? `<div class="banner" role="note">
         <span>Los registros se guardan solo en este equipo. Activa la copia en Google Sheets para no perderlos.</span>
         <a class="boton boton--texto" href="#/ajustes">Configurar</a>
       </div>`
    : sinEnviar
      ? `<div class="banner banner--pendiente" role="status">
           <span>${sinEnviar} registro${sinEnviar > 1 ? 's' : ''} sin enviar a Google Sheets.</span>
           <button class="boton boton--texto" id="btn-enviar-ahora">Enviar ahora</button>
         </div>`
      : '';

  contenedor.innerHTML = `
    <section class="pagina">
      <header class="encabezado">
        <h1 class="encabezado__titulo">Temperatura de poleas</h1>
        <p class="encabezado__sub">Elige la estación para comenzar un registro</p>
      </header>

      ${bannerNube}

      <ul class="estaciones" role="list">
        ${ESTACIONES.map((e) => {
          const ultimo = ultimoPorEstacion(e.id);
          return `
          <li>
            <a class="estacion" href="#/nuevo/${e.id}">
              <span class="estacion__nombre">${esc(e.nombre)}</span>
              <span class="estacion__dato">${totalPuntos(e)} puntos de medición</span>
              <span class="estacion__dato">${ultimo ? `Último: ${esc(fechaLegible(ultimo.fecha))}` : 'Sin registros'}</span>
              <span class="estacion__accion">Nuevo registro +</span>
            </a>
          </li>`;
        }).join('')}
      </ul>

      ${borradores.length ? `
        <h2 class="titulo-seccion">Borradores en curso</h2>
        <ul class="lista" role="list">${borradores.map((r) => tarjetaRegistro(r, app.ajustes)).join('')}</ul>` : ''}

      <h2 class="titulo-seccion">Últimos registros</h2>
      ${recientes.length
        ? `<ul class="lista" role="list">${recientes.map((r) => tarjetaRegistro(r, app.ajustes)).join('')}</ul>
           <a class="boton boton--texto" href="#/historial">Ver todo el historial</a>`
        : '<p class="vacio">Aún no hay registros finalizados.</p>'}
    </section>`;

  $('#btn-enviar-ahora', contenedor)?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = 'Enviando…';
    await app.sincronizar({ silencioso: false });
  });

  return () => {
    contenedorVisible = null;
  };
}

// Al terminar un envío (manual o automático) se vuelve a pintar el inicio, solo si sigue en pantalla
let contenedorVisible = null;
document.addEventListener('nube:actualizada', () => {
  if (contenedorVisible) vistaInicio(contenedorVisible);
});
