# Temperatura de poleas

App web instalable (PWA) para registrar la temperatura de las poleas en las estaciones **Oasis**, **Tupahue** y **Cumbre**. Funciona sin conexión, guarda los registros en el teléfono, envía una copia a Google Sheets y exporta a Excel con el formato de la planilla original.

**App publicada:** https://javiersalgadokaiser-dev.github.io/temperatura-poleas/

## Usarla en el teléfono

1. Abre la URL de arriba.
2. Instálala:
   - **Android (Chrome):** Menú ⋮ → *Instalar app* (o *Agregar a pantalla de inicio*).
   - **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*.
3. Después de abrirla una vez, funciona **sin señal**.

## Dónde quedan los datos

- **En el teléfono:** cada registro se guarda al instante en la memoria del navegador y no se pierde al cerrar la app ni al apagar el teléfono.
- **En Google Sheets:** cada registro finalizado se copia a una planilla de tu Drive. Si no hay señal, queda en cola y se envía solo al volver la conexión. Para activarlo, sigue las [instrucciones de Google Sheets](google-apps-script/INSTRUCCIONES.md); es una sola vez.
- **Respaldo manual:** *Ajustes → Descargar respaldo* (archivo JSON).

## Publicar cambios

La app se publica con GitHub Pages desde la rama `main`. Para publicar un cambio:

1. Sube `VERSION` en `sw.js` (por ejemplo, de `v1.1.0` a `v1.1.1`) para que los teléfonos descarguen la versión nueva.
2. Ejecuta `npm test`.
3. Haz `git commit` y `git push`. GitHub Pages se actualiza en 1 o 2 minutos.

## Desarrollo en el PC

Requisitos: Node.js 18 o superior (probado con 24.19.0). Para las pruebas en navegador también necesitas Chrome o Edge.

- **Lo más fácil:** doble clic en **`Abrir app.cmd`**. Abre http://localhost:5173; no cierres la ventana negra mientras la uses.
- **Desde la terminal:**
  ```bash
  npm install        # ExcelJS 4.4.0 y puppeteer-core 25.12.0 (solo para pruebas)
  npm run setup      # copia ExcelJS a vendor/ y genera los íconos
  npm start          # http://localhost:5173
  ```

> No abras `index.html` con doble clic: el navegador bloquea la app cuando se abre como archivo (`file://`) y queda en blanco.

### Pruebas

```bash
npm test           # alertas, exportación a Excel y script de Google (con una planilla simulada)
npm run test:e2e   # flujo completo en Chrome/Edge headless, con capturas en salida-pruebas/
APP_URL=https://javiersalgadokaiser-dev.github.io/temperatura-poleas/ npm run test:e2e   # contra la versión publicada
```

### Importar registros antiguos de Microsoft Forms

Deja en la carpeta del proyecto los Excel exportados de Forms (`Temperatura de poleas estación <Estación>(…).xlsx`) y ejecuta:

```bash
node tools/importar-forms.js --simular                                  # revisa y muestra el reporte, sin enviar
NUBE_URL="<url /exec>" NUBE_CLAVE="<clave>" node tools/importar-forms.js # envía a Google Sheets
```

El importador hace lo siguiente:
- Corrige el punto decimal omitido (ej. `261` → `26.1`) y anota cada corrección en *Observaciones*.
- Usa IDs fijos, así que repetirlo no duplica registros.
- No publica esos Excel en GitHub, porque contienen correos de los técnicos.

### Si cambia la planilla

1. Reemplaza `plantilla/registro-temperatura.xlsx`.
2. Ejecuta `node tools/generar-estaciones.js` para regenerar `src/data/estaciones.js`.
3. Ejecuta `npm test` para verificar.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| "No se pudo cargar el generador de Excel" | Falta `vendor/exceljs.min.js`: ejecuta `npm run setup`. |
| Los cambios no se ven en el teléfono | No se subió `VERSION` en `sw.js`, o falta cerrar y volver a abrir la app. |
| "Respuesta inesperada" al probar Google Sheets | La implementación no tiene acceso *Cualquier usuario*, o la URL no termina en `/exec`. |
| "Clave incorrecta" | La clave de *Ajustes* no coincide con `CLAVE` en el script de Google. |
| Los registros de `localhost` no aparecen en la app publicada | Son sitios distintos y cada uno guarda sus propios datos. Usa *Descargar respaldo* en uno y *Restaurar respaldo* en el otro. |
