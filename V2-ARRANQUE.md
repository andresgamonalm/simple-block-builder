# Arranque de v2 — brief para la sesión nueva

Este documento + `AUDITORIA.md` son el puente entre el proyecto actual y el nuevo.
**Copia AMBOS archivos al repo nuevo** antes de empezar (o pégalos en el primer mensaje).

## Objetivo

Reconstruir Simple Block Builder con arquitectura limpia, **sin romper el proyecto
actual** (que sigue vivo en su repo). Tomar el aprendizaje del actual (ver `AUDITORIA.md`)
y el **sistema de diseño** del usuario (se pega en la sesión nueva).

## Decisiones de arquitectura ya tomadas

1. **Modular, no monolito.** Un archivo por bloque. Estructura:
   ```
   /css/            estilos de pantalla
   /js/core/        estado, guardado, render del lienzo, deshacer/rehacer
   /js/edicion/     edición directa (data-edit / data-edit-img / data-edit-link) + panel
   /js/export/      motor de email (TABLAS) y de banner — SEPARADO del render de pantalla
   /js/plantillas/
   /js/bloques/     un archivo por bloque
   index.html       mínimo: estructura + imports (ES modules, sin build si se puede)
   ```
2. **Cada bloque exporta dos renders:**
   - `renderPantalla(d)` → editable y lindo (puede usar flex/grid/aspect-ratio).
   - `renderEmail(d)` → bulletproof: SOLO tablas + align/valign, anchos/altos fijos.
     Sin flex, grid, aspect-ratio, object-fit, transform, position:absolute, SVG, iframe ni JS.
   *(Esta es LA lección del proyecto actual: hoy el email reusa el CSS de pantalla y se rompe en Outlook/Gmail.)*
3. **Edición directa nativa en TODOS los bloques** desde el inicio (en el actual solo 8 de 41 la tienen).
4. **Toda foto** usa un helper único de proporción (apaisada/cuadrada/vertical + foco + zoom).

## Qué conservar del actual (probado y funciona)

- Modelo de bloque `{ defaults, campos, render }` (extendido a renderPantalla/renderEmail).
- Catálogo de bloques (ver lista en AUDITORIA.md).
- Patrón de edición directa y helper de proporción.
- Plantillas, persistencia en la nube, kits de marca, export autocontenido.

## Forma de trabajo acordada (importante)

- **Nada de parches a medias.** Pasos completos y verificados.
- Construir **un bloque a la vez**, verificando con Playwright que renderPantalla y renderEmail
  funcionen (y que el email no use CSS prohibido), y commit por paso.
- Commit/push frecuente (el entorno puede re-sincronizar el clon local; el remoto es la verdad).

## Primer mensaje sugerido para pegar en la sesión nueva

> Vamos a reconstruir Simple Block Builder desde cero, limpio y modular. Lee
> `AUDITORIA.md` y `V2-ARRANQUE.md` que copié al repo. Te voy a pegar mi sistema
> de diseño. Empecemos por el esqueleto: estructura de carpetas, `index.html`
> mínimo, el core (estado + render del lienzo) y UN primer bloque (texto) con sus
> dos renders (pantalla y email) + edición directa, verificado con Playwright.
> No hagas todo de una; vamos paso a paso y haces commit en cada uno.

(Y luego pegas el sistema de diseño.)
