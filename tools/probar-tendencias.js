// Pruebas de la lógica de gráficos (src/logica/tendencias.js).
import assert from 'node:assert/strict';
import { ESTACIONES } from '../src/data/estaciones.js';
import { AJUSTES_POR_DEFECTO } from '../src/logica/alertas.js';
import {
  inicioPeriodo, combinarHistorial, serieComponente, resumenSerie, componentesConDatos, marcasMensuales, marcaTiempo,
} from '../src/logica/tendencias.js';

const ajustes = AJUSTES_POR_DEFECTO;

// Períodos
assert.equal(inicioPeriodo('6m', '2026-10-21'), '2026-04-21');
assert.equal(inicioPeriodo('1a', '2026-10-21'), '2025-10-21');
assert.equal(inicioPeriodo('todo', '2026-10-21'), null);

// Historial de la nube (formato compacto del script) + registros del teléfono
const nube = {
  registros: [
    ['forms-oasis-48', '2024-09-24', '11:15', 'Oasis', 'Daniel', 13, 3],
    ['forms-oasis-49', '2025-03-11', '', 'Oasis', 'Miguel', null, 5],
    ['reg-local', '2026-10-01', '09:00', 'Oasis', 'Viejo', 10, 4],     // también existe en el teléfono
    ['x-1', '2026-01-01', '10:00', 'Estación desconocida', 'X', 1, 3], // se ignora
  ],
  lecturas: [
    ['forms-oasis-48', 'D9', 18.5], ['forms-oasis-48', 'D12', 20.1],
    ['forms-oasis-49', 'D9', 55],
    ['reg-local', 'D9', 99],
    ['x-1', 'D9', 1],
  ],
};
const locales = [
  { id: 'reg-local', estacionId: 'oasis', fecha: '2026-10-01', hora: '09:00', nombre: 'Corregido', temperaturaAmbiente: 11, lecturas: { D9: 72 }, estado: 'completo' },
  { id: 'borrador', estacionId: 'oasis', fecha: '2026-10-20', hora: '08:00', lecturas: { D9: 30 }, estado: 'borrador' }, // no se grafica
];
const registros = combinarHistorial(nube, locales, ESTACIONES);
assert.equal(registros.length, 3);
assert.equal(registros.find((r) => r.id === 'reg-local').lecturas.D9, 72, 'manda la versión del teléfono');

const serie = serieComponente(registros, 'oasis', 'D9', null, ajustes);
assert.deepEqual(serie.map((p) => p.valor), [18.5, 55, 72], 'ordenada por fecha');
assert.deepEqual(serie.map((p) => p.estado.id), ['normal', 'precaucion', 'critico']);
assert.equal(serie[1].ambiente, null);
assert.equal(serie[1].t, marcaTiempo('2025-03-11', ''), 'sin hora se toma mediodía');
assert.deepEqual(serieComponente(registros, 'oasis', 'D9', '2025-01-01', ajustes).map((p) => p.valor), [55, 72]);

const r = resumenSerie(serie);
assert.equal(r.ultima.valor, 72);
assert.equal(r.maxima.valor, 72);
assert.equal(r.promedio, 48.5);
assert.equal(r.cantidad, 3);
assert.equal(resumenSerie([]), null);
assert.deepEqual([...componentesConDatos(registros, 'oasis')].sort(), ['D12', 'D9']);
assert.equal(combinarHistorial(null, locales, ESTACIONES).length, 1, 'sin nube: solo los finalizados del teléfono');

// Marcas del eje X: al inicio de mes, sin pasarse del máximo
const marcas = marcasMensuales(new Date(2024, 8, 24).getTime(), new Date(2026, 6, 29).getTime(), 6);
assert.ok(marcas.length >= 2 && marcas.length <= 6, `cantidad de marcas: ${marcas.length}`);
assert.ok(marcas.every((t) => new Date(t).getDate() === 1));
assert.ok(marcasMensuales(new Date(2026, 0, 5).getTime(), new Date(2026, 5, 5).getTime(), 7).length >= 4);
console.log('✔ tendencias: períodos, combinación nube + teléfono, series, resumen y eje de tiempo');
