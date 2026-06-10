# Notas de traspaso para v2

Acompaña a `AUDITORIA.md` (qué se aprendió) y `V2-ARRANQUE.md` (cómo arrancar).
Este archivo = el detalle práctico para que la sesión nueva no re-derive nada.

---

## 0. Lo más importante (no repetir errores)

1. **Dos renders por bloque**: `renderPantalla(d)` (editable, flex/grid OK) y
   `renderEmail(d)` (SOLO tablas + align/valign, anchos/altos fijos; sin flex, grid,
   aspect-ratio, object-fit, transform, position:absolute, SVG, iframe ni JS).
   *En el actual el email reusa el CSS de pantalla → se rompe en Outlook/Gmail.*
2. **Edición directa nativa en todos los bloques**: marcar en el HTML
   `data-edit="campo"` (texto), `data-edit-img="campo"` (foto), `data-edit-link="campo"`
   (enlace). Soportar rutas anidadas para listas: `data-edit="items.0.t"`.
3. **Toda foto** pasa por un helper único de proporción (apaisada/cuadrada/vertical +
   foco + zoom). Para email, recorte por ancho/alto fijos (no aspect-ratio).
4. **Commit/push frecuente**: el entorno re-sincroniza el clon local a veces; el remoto
   es la única verdad. (Hoy pasó 2 veces; no se perdió nada porque estaba pusheado.)
5. **No meter HTML crudo del usuario en comentarios de metadatos** sin sanear `-->`
   (rompía el email cuando el bloque "código" tenía `-->`).

---

## 1. Modelo de bloque (conservar, extendido)

```js
nombreBloque: {
  cat: "Contenido",            // categoría para el catálogo
  nombre: "Texto",             // nombre visible
  sub: "Párrafo con título",   // descripción corta
  defaults: { ... },           // valores iniciales (+ estilos comunes)
  campos: [ ... ],             // controles del panel
  renderPantalla: (d) => ...,  // HTML editable
  renderEmail: (d) => ...,     // HTML bulletproof (tablas)
}
```
Tipos de campo del panel (del actual, reutilizables): `text`, `textarea`, `select`,
`range`, `color`, `colorOpt`, `check`, `imgurl` (con botón biblioteca), `icono-picker`,
`lista` (ítems repetibles), `alignH`/`alignV`, `row2` (dos en fila), `grupo` (título).

**Pendiente del actual**: varios campos de imagen son `tipo:"text"` en vez de `imgurl`
(no tienen botón "Elegir de la biblioteca"): imgtext, product, article, profileCard,
testimonial, audio. En v2 nacen como `imgurl`.

---

## 2. Catálogo de bloques (39) con sus campos

> Marcas: 📷 = tiene foto (necesita proporción) · ✏️ = candidato a edición directa de texto

(Campos de estilo comunes omitidos: alineación, ancho/alto, padding, fondo, radio, id.)
### Estructura
- **header** (Header) — campos: logoUrl, logoAncho, mostrarEyebrow, eyebrow, titulo, bajada, tamanoTitulo, tamanoBajada, colorTitulo, colorBajada
- **divisor** (Divisor) — campos: color, grosor, estilo
- **espaciador** (Espaciador) — campos: altoEsp
- **seccionlibre** (Sección (libre)) — campos: nombreSec, alinElem, elementos
- **grid** (Grid (columnas y mosaicos)) — campos: disposicion, columnas, gap, propGrid, alinearVert, apilarMobile
- **hero** (Hero con overlay) — campos: imagenUrl, titulo, sub, ctaTexto, ctaUrl, fuente, tamTitulo, tamSub, alturaHero, oscurecer, radioImg, colorVeil, posImg, colorTitulo, colorSub
- **alert** (Banner / Alerta) — campos: tipo, titulo, mensaje
- **footer** (Footer) — campos: logoUrl, logoAncho, empresa, direccion, copyright, mostrarUnsub, unsubTexto, unsubUrl
- **seccion** (Sección con fondo) — campos: eyebrow, titulo, subtitulo, botonTexto, botonUrl, botonVariante, botonColor, bg, colorTexto, colorEyebrow, fuenteTitulo, tamTitulo, tamSub, padV, padH
- **bandaHeader** (Header de marca · azul) — campos: estilo, bg, logoClaro, logoColor
- **bandaFooter** (Footer de marca · azul) — campos: estilo, bg, textoSeguir, redes, copyright, direccion, mostrarUnsub, unsubTexto, unsubUrl, disclaimer, web, logoClaro, logoColor

### Contenido
- **texto** (Texto) — campos: titulo, contenido, tamano, color, negrita, italica
- **imagen** (Imagen) — campos: url, alt, link, caption, anchoImg, radio, aspecto, zoom, posicion, altoImg
- **imgtext** (Imagen + Texto) — campos: imagenUrl, lado, proporcionImg, altoImg, gapCol, radioImg, titulo, tamTitulo, colorTitulo, texto, tamTexto, colorTexto, alineacionTexto, alineacionVertCol, linkTexto, linkUrl
- **features** (Lista de features) — campos: titulo, colorIcono, disposicion, porFila, orientacion, fuente, tamTitulo, gapItems, tamItemTitulo, tamItemSub, items

### Acción
- **cta** (Botón CTA) — campos: texto, url, variante, anchoBoton, altoBoton, tamano, padX, padY, radio, colorFondo, colorTexto, colorHover

### Agenda
- **diadivisor** (Día divisor) — campos: modo, texto, fechaIso, formatoFecha, colorFondo, colorTexto, tamano, radio, padInternoX, padInternoY, anchoCompleto
- **fechaCard** (Fecha destacada) — campos: fechaIso, titulo
- **evento** (Evento (cita)) — campos: principal, mostrarHora, horaInicio, horaFin, titulo, mostrarTag, tag, mostrarParticipantes, participantes, mostrarDireccion, direccion, acciones, mostrarNota, notaTitulo, nota

### Widgets
- **mapa** (Mapa) — campos: direccion, lat, lng, zoom, altoMapa, mostrarLink, urlGoogleMaps
- **clima** (Clima) — campos: ciudad, temperatura, unidad, descripcion, icono, tema, mostrarExtra, sensacion, humedad, viento
- **reloj** (Reloj en vivo) — campos: label, mostrarSegundos, formato24, mostrarFecha
- **countdown** (Cuenta regresiva) — campos: label, fechaIso, mostrarSegundos, mostrarFechaObjetivo
- **formulario** (Formulario) — campos: modo, url, icono, titulo, descripcion, textoBoton, altoIframe
- **social** (Redes sociales) — campos: redes, estilo, color, tamano, grosor, separacion

### Decoración
- **icono** (Ícono) — campos: icono, imagenUrl, tamano, grosor, color, estilo, textoLado, url

### Avanzado
- **codigo** (Código HTML/CSS/JS) — campos: codigo

### Datos
- **tabla** (Tabla) — campos: filasTexto, primeraFilaHeader, bordes, rayasAlternas, colorFondo, colorTexto, colorHeaderFondo, colorHeaderTexto, colorBorde, radio
- **kpi** (Tarjeta KPI) — campos: icono, numero, label, mostrarTrend, trendValor, trendDireccion, colorFondo, color, radio
- **ring** (Anillo de progreso) — campos: valor, label, tamano, grosor, color, colorPista
- **statGrid** (Grilla de stats) — campos: columnas, items
- **spark** (Métrica con sparkline) — campos: numero, label, trendValor, trendDireccion, datos, color
- **rating** (Rating de estrellas) — campos: valor, max, reviews

### Cards
- **product** (Tarjeta de producto) — campos: imagenUrl, nombre, descripcion, precio, ctaTexto, ctaUrl, alineacionTexto, tamanoNombre, tamanoPrecio, radioImg, colorFondo, colorTexto, colorPrecio
- **profileCard** (Tarjeta de perfil) — campos: avatarUrl, nombre, sub, mostrarCta, ctaTexto, ctaUrl, mostrarStats, stats
- **testimonial** (Testimonio) — campos: cita, avatarUrl, autor, cargo, alineacionTexto, tamanoCita, colorFondo, colorTexto, colorAcento
- **article** (Artículo / Post) — campos: imagenUrl, categoria, titulo, lead, linkTexto, linkUrl, alineacionTexto, tamanoTitulo, tamanoLead, radioImg, colorFondo, colorTexto, colorCategoria, colorEnlace
- **pricing** (Plan de precios) — campos: destacado, tier, precio, periodo, features, ctaTexto, ctaUrl, alineacionTexto, tamanoTier, tamanoPrecio, tamanoFeatures, colorFondo, colorTexto, colorTier, colorAcento

### Multimedia
- **audio** (Audio / Podcast) — campos: coverUrl, titulo, artista, url

---

## 3. Infraestructura del actual (preservar conceptos)

- **Rutas/productos** (cada uno cura qué bloques muestra): `/free` (universal),
  `/email-ia`, `/gdn-ia` (display), `/post-ia`, `/ads-ia`, `/marcas` (kits de marca),
  `/papelera`, `/configuracion`, `/permisos`.
- **API** (Cloudflare Workers; mantener el contrato):
  - `GET /api/whoami` — usuario/sesión.
  - `GET/POST /api/proyectos` — persistencia en la nube (D1) por usuario.
  - `POST /api/test-send` — envía email de prueba `{destinatarios, asunto, html}`.
  - `POST /api/upload` — sube imágenes (R2).
  - `POST /api/ia` — generación con IA.
- **Formatos**: `email` (600px), `libre` (universal, ancho a elección), `invitacion`,
  banners de tamaño fijo (LinkedIn, Facebook, Display/GDN, etc. → alto fijo).
- **Íconos**: ~82 SVG inline propios (`svgIcon(nombre, {size})`). Para email, recordar
  que los SVG no funcionan en Outlook → usar PNG o quitar.
- **Kits de marca**: colores/tipografías/logos por marca, aplicables al tema.
- **Export**: HTML autocontenido (probado con HubSpot). Mantener round-trip por
  metadatos PERO sanear `-->` y, mejor, no incrustar HTML crudo del usuario.

---

## 4. Bugs del actual ya arreglados HOY (no re-romper, replicar bien en v2)

- Código: un solo campo (pega todo el HTML junto, no separar).
- Grid: clic en celda edita esa celda (no mueve el bloque).
- Borrar de a uno (Supr borra solo el bloque/celda activa, no todo).
- Features: disposición en fila + cantidad por fila + orientación.
- Identificador de componente (id por bloque, visible en el HTML).
- Email: quitar comentarios de metadatos del correo enviado (los `\n` visibles).
- Edición directa: texto, cta, imagen, sección, features (ítems), imagen+texto, header logo.
- Proporción de foto en imgtext, product, article (+ helper reutilizable).

## 5. Bugs del actual PENDIENTES (arreglar en v2 desde el diseño)

- Email rompe en Outlook/Gmail (flex/grid/aspect-ratio/SVG/iframe/JS) → render de email aparte.
- `hero`: overlay con position:absolute (no email); imagen de fondo no editable al clic.
- `imagen.altoImg`: concatena `${alto}px` → "300px" da "300pxpx". Validar unidades.
- Edición directa solo en 8/39 bloques → en v2, todos.
- Fotos sin proporción: profileCard, testimonial, hero, audio, seccionlibre.
- Inconsistencia: logo de bandaFooter no editable al clic (el de bandaHeader sí).
- `hero.escalaTexto` campo fantasma; `tabla` variable muerta `__SEP__`.

---

## 6. Forma de trabajo (lo que funcionó hoy)

- Un bloque/cambio a la vez, **verificado con Playwright** (render + sin CSS prohibido
  en email + edición directa), y **commit por paso**.
- Nada de adivinar: si una decisión es del usuario, preguntar con opciones.
- Capturas de pantalla para validar visualmente con el usuario.
