# Activar la copia en Google Sheets (unos 5 minutos, una sola vez)

Con esto, cada registro finalizado en la app se copia automáticamente a una planilla de Google en tu Drive. Si el teléfono no tiene señal, el registro queda en cola y se envía solo cuando vuelve la conexión.

> Hazlo en el **computador**. La app de Google Sheets del teléfono no tiene el menú de Apps Script.

## 1. Crear el script

Hay dos opciones. Usa la B si la A no abre.

**Opción A: desde una planilla**
1. Entra a [sheets.new](https://sheets.new) y nombra la planilla **"Registro temperatura poleas"**.
2. En el menú, abre **Extensiones → Apps Script**.

**Opción B: directo en Apps Script.** La planilla se crea sola en tu Drive con el primer envío.
1. Entra a [script.google.com](https://script.google.com) y pulsa **+ Nuevo proyecto**.
2. Arriba a la izquierda, cambia "Proyecto sin título" por **Temperatura poleas**.

Luego, en las dos opciones:

3. Borra todo lo que aparece en `Código.gs` y pega el contenido completo de [`Codigo.gs`](Codigo.gs).
4. Busca esta línea y cambia `CAMBIA-ESTA-CLAVE` por una clave inventada, por ejemplo `Poleas-2026-Tx7`:
   ```js
   const CLAVE = 'CAMBIA-ESTA-CLAVE';
   ```
5. Guarda con el ícono 💾 o con Ctrl+S.

## 2. Publicarlo como aplicación web

1. Arriba a la derecha, pulsa **Implementar → Nueva implementación**.
2. En el engranaje ⚙ junto a "Seleccionar tipo", elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo (tu correo)
   - **Quién tiene acceso:** Cualquier usuario
4. Pulsa **Implementar** y luego **Autorizar acceso**. Elige tu cuenta.
   - Si aparece "Google no ha verificado esta aplicación", pulsa **Configuración avanzada → Ir a … (no seguro)**. Es normal: el script es tuyo y solo escribe en tu planilla.
5. Copia la **URL de la aplicación web**. Termina en `/exec`.

> "Cualquier usuario" significa que la app puede enviar datos sin iniciar sesión en Google. Lo que protege la planilla es la **clave**: sin ella, el script rechaza cualquier envío. Nadie puede leer la planilla desde esa URL.

## 3. Configurar la app

1. En la app, entra a **Ajustes → Copia en Google Sheets**.
2. Pega la URL y escribe la misma clave del paso 1.4.
3. Pulsa **Guardar y probar**. Debe aparecer *Conectado con la planilla "…"*.
4. Para los demás teléfonos, pulsa **Compartir configuración** y envía el enlace por WhatsApp o correo. Quien lo abra en su teléfono solo tiene que pulsar *Aplicar*.
   - **iPhone:** si la app está instalada en la pantalla de inicio, abre el enlace desde Safari y luego copia la URL y la clave a mano en Ajustes de la app instalada. iOS guarda por separado los datos de Safari y los de la app instalada.

## Qué queda en la planilla

- **Registros:** una fila por registro, con fecha, hora, estación, técnico, temperatura ambiente, velocidad, cantidad de lecturas, cuántas están en precaución y cuántas son críticas, la temperatura máxima y en qué polea se midió.
- **Mediciones:** una fila por polea medida, con su estado. Las celdas de *Crítico* y *Precaución* salen coloreadas.

Si un registro se corrige en la app después de enviarlo, se vuelve a enviar y **reemplaza** al anterior, así que no quedan duplicados. Si se borra un registro en la app, la copia en la planilla **se mantiene**.

## Si Apps Script no abre

| Qué ves | Solución |
|---|---|
| "No se puede abrir el archivo en este momento" o "Sorry, unable to open the file" | Tienes **varias cuentas de Google** abiertas en el navegador. Abre una ventana de incógnito (**Ctrl+Shift+N**), entra solo con tu cuenta y repite. |
| "Tu administrador ha inhabilitado…" o no aparece la opción | Es una cuenta del trabajo o de una institución que bloquea Apps Script. Usa una cuenta **Gmail personal**. |
| Se hace clic y no pasa nada | El navegador bloqueó la ventana nueva. Permite las ventanas emergentes de docs.google.com o usa la opción B. |
| No existe el menú "Extensiones" | Estás en el teléfono o en la app de Sheets. Hazlo en el computador desde el navegador. |

Con la opción B, para encontrar la planilla usa el botón **Abrir planilla** en Ajustes de la app, después de *Guardar y probar*. También la encuentras en tu Google Drive con el nombre "Registro temperatura poleas".

## Si cambias el código del script

Ve a **Implementar → Gestionar implementaciones → ✏ Editar → Versión: Nueva versión → Implementar**. Así la URL no cambia.
