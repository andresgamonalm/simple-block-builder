# Auditoría de Simple Block Builder — base para v2

Fecha: 2026-06-10. Sobre `editor.html` (6.244 líneas, monolito: HTML + CSS + JS + 41 bloques + export + plantillas).

## Resumen ejecutivo

- **La app funciona**: los 41 bloques insertan, renderizan y abren su panel con **0 errores de consola**. Duplicar, borrar, deshacer, guardar y exportar funcionan.
- **El problema de fondo no son bugs sueltos, es la arquitectura**: un solo archivo gigante, sin separación por tipo de bloque, y —lo más grave— **el email reusa el CSS y el render de pantalla** (flex/grid/aspect-ratio/transform/position/SVG/iframe/JS), que **se rompen en Outlook y partes de Gmail**.

## Lo que SÍ funciona y hay que conservar en v2

1. **El modelo de bloque**: cada bloque = `{ defaults, campos, render(d) }`. Es simple y escala. Mantenerlo.
2. **Catálogo de 41 bloques** ya pensados (texto, cta, imagen, seccion, features, grid, hero, kpi, pricing, etc.).
3. **Edición directa en el lienzo** (patrón nuevo): `data-edit="campo"`, `data-edit-img="campo"`, `data-edit-link="campo"` + rutas anidadas (`items.0.t`). Buen patrón, replicarlo en TODOS los bloques.
4. **Proporción de foto** reutilizable: helper `imgProporcion()` + `camposProporcion()`.
5. Plantillas, persistencia en la nube, export autocontenido, kits de marca.

## LA lección clave para v2 (arquitectura)

**Separar dos caminos de render:**
- **Render de pantalla** (editor): puede usar flex/grid/aspect-ratio (se ve lindo y editable).
- **Render de email** (export): SOLO tablas + `align/valign`, anchos/altos fijos, sin flex, grid, `aspect-ratio`, `object-fit`, `transform`, `position:absolute`, SVG, iframe ni JS.

Hoy `wrap()` mete `display:flex` inline en **todos** los bloques, y el export inyecta el CSS de pantalla. Por eso cualquier email arrastra CSS que Outlook ignora.

## Cobertura de edición directa (hoy)

- **Completa**: cta, imgtext, seccion.
- **Parcial (solo foto o solo texto)**: texto, imagen, product, article, features, bandaHeader.
- **Sin edición directa (~30 bloques)**: header, kpi, ring, spark, statGrid, rating, pricing, profileCard, testimonial, evento, alert, audio, footer, hero, clima, countdown, formulario, mapa, etc. → en v2, todos deben nacer con edición directa.

## Fotos sin control de proporción

`profileCard`, `testimonial`, `hero` (solo foco), `audio`, y los sub-elementos de `seccionlibre`. En v2, toda foto usa el mismo helper de proporción.

## Bugs concretos detectados (para no repetirlos en v2)

| Sev | Bloque/función | Problema |
|-----|----------------|----------|
| ALTA | export / `wrap()` | flex/grid/aspect-ratio en email → se rompe en Outlook/Gmail |
| ALTA | `hero` | overlay con `position:absolute` no funciona en email; imagen de fondo no editable al clic |
| ALTA | `ring`, `spark` | SVG no renderiza en Outlook |
| ALTA | `mapa`, `formulario` (embed) | iframe no funciona en ningún email |
| ALTA | `reloj`, `countdown` | dependen de JS, que el email no ejecuta |
| MEDIA | metadatos `<!--SBB:{json}-->` | si el HTML pegado en `codigo` contiene `-->`, rompe el comentario y filtra texto en el email |
| MEDIA | `imagen.altoImg` | concatena `${d.altoImg}px`; si el usuario escribe "300px" → `300pxpx` inválido |
| MEDIA | campos de imagen `tipo:"text"` | imgtext/product/article/profileCard/testimonial/audio sin botón "Elegir de la biblioteca" |
| MEDIA | bandaFooter vs bandaHeader | logo del footer no editable al clic (inconsistencia) |
| BAJA | `hero.escalaTexto` | campo fantasma (usado en render, ausente de defaults) |
| BAJA | `tabla` | variable muerta `cells`/`__SEP__` |

## Estructura propuesta para v2

```
/css/            estilos (pantalla)
/js/core/        estado, guardado, render del lienzo, deshacer
/js/edicion/     edición directa + panel de propiedades
/js/export/      motor de email (tablas) y de banner — SEPARADO del render de pantalla
/js/plantillas/
/js/bloques/     un archivo por bloque: cada uno exporta { defaults, campos, renderPantalla, renderEmail }
index.html       mínimo: estructura + imports
```

Clave: cada bloque define **renderPantalla** (editable, lindo) y **renderEmail** (tablas, bulletproof). Así nunca más se rompe el correo.
