// Historial: todos los registros, filtro por estación y exportación consolidada a Excel.
import { ESTACIONES } from '../data/estaciones.js';
import { registros as repo } from '../data/db.js';
import { crearExcelHistorial } from '../logica/exportar-excel.js';
import { app } from './estado.js';
import { $, $$, esc, aviso, cargarExcelJS, blobExcel, entregarArchivo, hoyISO } from './utilidades.js';
import { tarjetaRegistro } from './componentes.js';

export async function vistaHistorial(contenedor) {
  const todos = await repo.listar();
  let filtro = 'todas';

  contenedor.innerHTML = `
    <section class="pagina">
      <header class="encabezado">
        <h1 class="encabezado__titulo">Historial</h1>
        <p class="encabezado__sub">${todos.length} registro${todos.length === 1 ? '' : 's'} guardado${todos.length === 1 ? '' : 's'} en este equipo</p>
      </header>

      <div class="filtros" role="radiogroup" aria-label="Filtrar por estación">
        ${[{ id: 'todas', nombre: 'Todas' }, ...ESTACIONES].map((e) => `
          <button class="chip-filtro" role="radio" data-filtro="${e.id}" aria-checked="${e.id === filtro}">${esc(e.nombre)}</button>`).join('')}
      </div>

      <ul class="lista" id="lista-historial" role="list"></ul>

      <button class="boton boton--relleno boton--ancho" id="btn-exportar-historial" ${todos.length ? '' : 'disabled'}>
        Exportar historial a Excel
      </button>
      <p class="ayuda">Incluye una fila por medición de los registros filtrados, lista para filtrar o hacer tablas dinámicas.</p>
    </section>`;

  const visibles = () => (filtro === 'todas' ? todos : todos.filter((r) => r.estacionId === filtro));
  const pintar = () => {
    const lista = visibles();
    $('#lista-historial', contenedor).innerHTML = lista.length
      ? lista.map((r) => tarjetaRegistro(r, app.ajustes)).join('')
      : '<li class="vacio">No hay registros para esta estación.</li>';
  };
  pintar();

  $('.filtros', contenedor).addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-filtro]');
    if (!boton) return;
    filtro = boton.dataset.filtro;
    $$('[data-filtro]', contenedor).forEach((b) => b.setAttribute('aria-checked', String(b === boton)));
    pintar();
  });

  $('#btn-exportar-historial', contenedor).addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    const lista = visibles();
    if (!lista.length) return aviso('No hay registros para exportar.');
    boton.disabled = true;
    boton.textContent = 'Generando…';
    try {
      const ExcelJS = await cargarExcelJS();
      const buffer = await crearExcelHistorial(ExcelJS, lista, ESTACIONES, app.ajustes);
      const sufijo = filtro === 'todas' ? '' : ` ${ESTACIONES.find((e) => e.id === filtro).nombre}`;
      await entregarArchivo(blobExcel(buffer), `Historial temperatura poleas${sufijo} ${hoyISO()}.xlsx`, 'Historial listo');
    } catch (e) {
      console.error(e);
      aviso(e.message || 'No se pudo generar el Excel.', { tipo: 'error', duracion: 6000 });
    } finally {
      boton.disabled = false;
      boton.textContent = 'Exportar historial a Excel';
    }
  });
}
