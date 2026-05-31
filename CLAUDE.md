# Simple Block Builder — memoria del proyecto

> Este archivo lo lee Claude Code al iniciar cada sesión. Mantiene el contexto para
> NO empezar de cero. Si cambias algo importante de arquitectura o acuerdos, actualízalo.

## Qué es
Editor de creatividades por bloques para **email, banners (Google Display), social
(LinkedIn/Facebook), invitaciones y formato libre**. Stack: **Cloudflare Pages + D1**.
Casi todo vive en **`editor.html`** (~4200 líneas, HTML+CSS+JS inline, 2 `<script>`).
Backend: funciones en **`functions/api/`** (auth por magic link + JWT, persistencia, envío, IA).

- Producción: **https://simple-block-builder.gamonal.app** (Cloudflare Pages, auto-deploy desde `main`, ~1–2 min).
- Dueño/usuario: Andrés Gamonal (hola@andresgamonal.com). **Responder en español.**

## Acuerdos de trabajo (IMPORTANTE)
1. **Trabajar directo en `main` y `git push origin HEAD:main`.** El usuario NO quiere ramas/duplicados. (La rama `claude/app-review-debugging-DQlgG` existe y va en paralelo, pero el objetivo es main.)
2. **Verificar SIEMPRE con Playwright antes de pushear.** Chromium en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Patrón: server `http` local que sirve `editor.html` + mocks de `/api/whoami` y `/api/proyectos`; manejar la app por `page.evaluate` llamando a las funciones globales. **Las imágenes externas (placehold.co) están BLOQUEADAS en el sandbox** → servir un SVG local desde el server de prueba.
3. Subir solo cuando pasa la verificación. Mostrar capturas (SendUserFile) al usuario.
4. No pegar secretos en el repo ni en el chat.

## Arquitectura de datos
- `workspace = { proyectos:[], marcas:[], banner:{}, imagenes:[], _ts }`. Se guarda en
  localStorage y se sincroniza **completo** con D1 vía `POST/GET /api/proyectos` (last-write-wins por `_ts`). `normalizarWorkspace()` migra formatos viejos.
- `proyecto.piezas[]` = creatividades `{ id, nombre, formato, canvas:[bloques], tema }`.
- bloque = `{ id, tipo, datos }`. Registro **`BLOQUES`** (35 tipos). `BLOQUES[tipo].render(datos)`→HTML; `wrap(d, inner)` envuelve con padding/alineación.
- Registro **`FORMATOS`** (email, invitacion, **libre**=“Estilo Libre/Formato Universal”, linkedin-*, fb-*, display-*). `display-*` incl. 300x250,336x280,728x90,970x90,300x600,160x600,250x250,200x200,468x60,320x50,320x100.
- Accesores: `pieza()`, `getCanvas()`, `getFormato()`, `getTema()`. `bloqueCtx()` = bloque en edición (seleccionado **o** celda de grid si `editandoCelda`). Helpers: `esc()/escAttr()` (escape — **nunca nombrar variables `esc`**), `mk()`, `clone()`, `uid()`, `toast()`, `persistir()`.

## Features ya construidas (no rehacer)
- **Sync del workspace completo** (proyectos+marcas+banner+imagenes).
- **Ctrl+Z / Ctrl+Y** (historial por pieza, registrado en `persistir()`); **Supr/Backspace** borra el bloque seleccionado; **arrastrar la foto mueve el bloque** (`img.draggable=false`).
- **Plantillas filtradas por formato** (Email→Email, Banner→Display, Post→LinkedIn/Facebook, Libre→todas).
- **Soltar bloques en todo el lienzo** (`calcularDropIndex`); biblioteca: clic en bloque lo añade al canvas/artboard activo.
- **Grid (Grid 2/3/4 columnas):** cada columna puede contener **cualquier bloque** (anidado). Editar con `editandoCelda` + `bloqueCtx()`; selector por columna `tiposCeldaOptions()`.
- **Marcas (kits de identidad, ampliado)** — `workspace.marcas[]` (**múltiples marcas conviven**; cada `guardarMarca` sin `marca-edit-id` crea una nueva). Modelo: `{ id, nombre, empresa, logo, logoClaro, primary, secondary, cta, ctaText, text, bg, bgPagina, accent1, accent2, fontTitulo, fontCuerpo, negocio, tono, eslogan, publico, productos, usar, evitar, headerTagline, direccion, copyright, unsubTexto, disclaimer }`. **Acento 1/2** = colores extra de paleta (aparecen como swatches en banners vía `coloresMarcaPreset`). Campos de **email** (headerTagline, direccion, copyright, unsubTexto, disclaimer) → al aplicar marca a un email se crean header+footer (no duplica). Campos de **IA** (negocio, tono, publico, productos, usar, evitar, disclaimer) van al prompt. **Plantillas listas**: `rellenarMarcaRadar()` (logos azul/blanco incrustados como data URL SVG, paleta navy #222F47 + beige #D9C6B1 + celeste #A3BDCB, omite el negro #1D1D1D del manual, Roboto) y `rellenarMarcaZurich()` (azul #2167AE, Montserrat/Inter). Botones "Plantilla RADAR"/"Plantilla Zúrich" en el form. `normalizarMarca()` migra marcas viejas (`font`→fontTitulo/Cuerpo, `logoUrl`→logo, `bg`→secondary). **Logos subidos como archivo** (`subirLogoMarca`: reduce a ≤512px y guarda **data URL PNG** incrustado, NO R2; sincroniza con el workspace). `logoClaro` = versión para fondos oscuros; `logoDeMarca(m,fondoOscuro)` + `esColorOscuro(hex)` eligen el logo correcto. `aplicarMarca` aplica identidad a documentos (bloques) **y a composiciones por zonas** (fondo=secundario, CTA colores, logo claro si fondo oscuro, eslogan→titular). La **Voz de marca** (negocio/tono/eslogan) + paleta extendida se mandan a la IA (`generarConIA` y modo textos); `ia.js` las usa en el prompt.
- **Biblioteca de imágenes por URL** (`workspace.imagenes`, sin subir archivos = sin consumir storage). Modal desde dashboard "Biblioteca de imágenes" y botón en barra. Campo `imgurl` con "Elegir de la biblioteca" en bloques Imagen/Hero (`elegirImagenPara`).
- **Papelera (soft-delete de proyectos)** — `workspace.papelera[]`. `eliminarProyecto` ya NO destruye: llama `moverAPapelera(id)` (mueve el proyecto a `papelera` con sello `borradoTs`). `borrarTodosProyectos()` envía todos de una (botón **"Borrar todo"** en el header de proyectos, oculto si no hay proyectos). Modal **Papelera** (`abrirPapelera`/`renderPapelera`, `#modal-papelera`) con **Restaurar** (`restaurarProyecto`, borra `borradoTs` y devuelve a `proyectos`), **Eliminar definitivo** (`eliminarDefinitivo`, confirm) y **Vaciar papelera** (`vaciarPapelera`). Entrada en nav **Sistema → Papelera** con badge contador (`#nav-pap-badge`). Sincroniza con D1 como parte del workspace (last-write-wins); `normalizarWorkspace` añade `papelera:[]` por defecto.
- **Motor de IA** — `functions/api/ia.js`: `POST /api/ia` recibe `{brief, formato, marca, imagenes, catalogo}`, llama a **Gemini** y devuelve `{nombre, bloques}`. La IA elige bloques (no escribe HTML). Cliente: botón **✨ IA** (barra) y "Generar con IA" (dashboard) → modal con brief simple. `catalogoBloquesParaIA()` arma el catálogo desde los bloques reales. Diagnóstico: `GET /api/ia` (instantáneo) y `GET /api/ia?gemini=1` (ping a Gemini).
  - Modo extra: `POST /api/ia { modo:'textos', brief }` → `{ titular, cuerpo, cta }` (usado por la Fase 3 de composición).
  - **ESTADO IA:** el modelo por defecto es **`gemini-2.5-flash`** (vigente). Google **retiró `gemini-2.0-flash`** para cuentas nuevas → daba **404 NOT_FOUND** ("model no longer available"), NO un problema de URL ni de cuota (la URL `generativelanguage.googleapis.com/v1beta/models/<MODELO>:generateContent` es correcta; el modelo va incrustado en la ruta). Overridable con la variable `GEMINI_MODEL` (p.ej. `gemini-flash-latest`). La función tiene timeout (AbortController) y **devuelve 500/400 (nunca 502)** para que Cloudflare no reemplace el JSON de error por su página HTML.

### Colecciones por ZONAS (Composición) — el modelo central pedido por el usuario
Idea (de su mockup): una creatividad de tamaño fijo es una **composición de 3 ZONAS** (Logo · Texto · CTA) en un marco fijo, con un **fondo de banner continuo** detrás. (Antes eran 6 capas apiladas; se migró a 3 zonas — ver `migrarComposicion`.)
- `pieza.esSet` + `pieza.composicion = { fondo:{tipo:'color'|'imagen', color, imagen:{url,foco,fit,zoom,oscurecer}}, prop:[25,50,25], zonas:{ logo, texto, cta } }`.
  - Cada **zona** = `{ bg:'hereda'|'color'|'imagen', color, imagen:{...}, alinH, alinV, visible, ...contenido }`. `bg:'hereda'` = transparente → se ve el **fondo continuo** del banner. `color`/`imagen` = fondo propio de la zona (override del continuo).
  - `zonas.logo` contenido: `{ url, alto, maxw }`. `zonas.texto`: `{ titular:{texto,tamano,color}, cuerpo:{texto,tamano,color} }`. `zonas.cta`: `{ texto, url, colorFondo, colorTexto, radio, tamano }`.
  - `prop` = pesos relativos (flex-grow) de las 3 zonas; **editables**, NO el tamaño del banner. Zona con `visible:false` → flex-grow 0 (colapsa, las otras rellenan).
- **Acceso por RUTA**: `getPath/setPath/delPath`. Mutadores `setComp(path,val)` (global), `setCompOv(fmt,path,val)` (por tamaño), `toggleCompVis(path)`/`toggleCompVisOv(fmt,path)`, `resetCapaTamaño(fmt,'zonas.cta')`, `resetTamaño(fmt)`. Ej. de ruta: `'zonas.texto.titular.texto'`, `'fondo.imagen.url'`, `'prop.1'`.
- `pieza.artboards = [{ fmt, ov:{overrides parciales por ruta} }]`, `masterFmt`, `activaFmt`. `composicionEfectiva(p,fmt)` = **deep-merge** global+override (`deepMergeOv`), ignora valores `""` (→ heredan). `asegurarComposicionNueva(p)` migra perezosamente piezas viejas (y limpia overrides incompatibles).
- `renderComposicion(comp, fmt)` (clase `.cmp`): fondo continuo (`.cmp-bg`+veil) + `.cmp-zonas` (row si **franja** `familiaDeFormato==='franja'`, si no col) con 3 `.cmp-zona` (flex-grow=prop, `justify-content`=alinV, `align-items`=alinH). Cada zona: `.cmp-zbg` propio si bg≠hereda; `.cmp-zin` con el contenido. Escala de fuentes por `escF`. ⚠️ nunca nombrar variables `esc`.
- **Editor unificado** `compEditorHTML(p, fmt)` (fmt null=Diseño global; fmt=Ajustar tamaño): Fondo del banner + Proporciones (3 sliders) + por zona [ojo visible, reset(si tamaño), Posición H+V, Fondo hereda/color/imagen, contenido]. `renderComposicionEditor` y `renderFormTamaño` lo envuelven. **Regla 5**: `miniaturasBiblioteca(path,fmt)` muestra thumbnails clicables de `workspace.imagenes` (sin copiar URL); `elegirImagenPath(path,fmt)` abre la biblioteca. `swatchesColor(path,fmt)` = colores de marca.
- **Tablero agrupado por familia** (`familiaDeFormato`): Cuadrados/Rectángulos · Verticales · Franjas. Marca el activo y muestra "· ajustado".
- **Creación unificada** (`crearComposicion(tipoCol, comp?)` + registro `COLECCIONES` = `display-desktop` (SET_DISPLAY_DESKTOP, máster 300x250) y `social` (SET_SOCIAL, máster linkedin-post)). `crearSetDesktop`/`crearSetSocial` son atajos.
- Entradas: **Formato → Colecciones → "Google Display · Desktop" / "Social"** (`convertirEnColeccion(tipo)`, convierte la pieza actual en place usando su contenido como base vía `composicionDesdeCanvas`) · **dashboard "Banners"→display-desktop, "Post RRSS"→social** (vía `crearDesde`) · **Plantillas → Google Display → "Set Desktop"**. En colecciones se bloquean **Bloques y Plantillas** y hay botón "Salir de colección".
- Export: `generarHTMLDeComposicion(p, fmt)` (HTML responsivo). **Export a imagen (PNG/JPG)** para subir a Google Ads/redes: `rasterizarComposicion(p,fmt,tipo)` usa **SVG `foreignObject`→canvas→toBlob**; autocierra elementos vacíos (XHTML) y mete el CSS en `<![CDATA[]]>`. Imágenes cross-origin se pasan a dataURL vía **`/api/img?u=`** (proxy `functions/api/img.js`, mismo origen) para no contaminar el canvas. `exportarArtboardImg` / dispatcher `exportarArtboardEn` + `exportarTodoEnTipo` según `exportTipo` (`html`/`png`/`jpg`, selector en el modal de Exportar). `exportarArtboard` / `exportarTodoElSet` siguen para HTML.
- `SET_DISPLAY_DESKTOP` = los 9 tamaños desktop.
- **Fase 3 (el 🪄):** en el editor global — `swatchesFondo()` (colores rápidos de marcas+presets en la capa Fondo), botones **biblioteca** en imagen/logo (`elegirImagenComp`), y **✨ "Sugerir textos con IA"** (`sugerirTextosIA`) que llama `POST /api/ia { modo:'textos', brief }` y rellena titular/cuerpo/cta del global. (Mismo bloqueo de cuota de Gemini que el motor IA.)

## Consistencia de UI por modo (revisión quirúrgica)
- `actualizarUISet()` bloquea pestañas según el modo: en **colección por capas** se
  deshabilitan **Bloques** (id `ptab-bloques`) y **Plantillas** (id `ptab-plantillas`);
  el selector de Formato y dev-seg se ocultan; aparecen los botones del set; se muestra
  el editor de capas y se oculta `#diseno-tema`. Al salir de la colección todo se reactiva.
- `agregarBloque` hace **no-op** si `esComposicion()` (no se meten bloques sueltos a una colección).
- **Biblioteca filtrada por formato**: `BLOQUES_SOLO_DOC` (footer, diadivisor, fechaCard,
  evento, formulario, tabla) se **ocultan en banners de tamaño fijo** (display/social).
  `renderBiblioteca()` se re-renderiza en `cambiarFormato`.
- **UNIFICACIÓN hecha:** el selector de Formato (`renderFormatoSelect`) solo ofrece
  **documentos** (Email, Invitación, Formato Universal/libre) + el grupo **Colecciones**
  (Display, Social). Ya **no se crean banners Display/Social sueltos** (block-stack): los
  formatos visuales fijos son **siempre composiciones por capas**. Documentos = editor de
  bloques (con biblioteca filtrada); Colecciones = editor de capas. (Piezas viejas con
  formato Display suelto siguen renderizando por compatibilidad, pero no se crean nuevas.)
- **Export coherente:** `abrirExportar()` detecta `esComposicion` → lista los tamaños del
  set (cada uno `exportarArtboard`→`generarHTMLDeComposicion`) + "Descargar todos". Para
  documentos sigue `generarHTMLDePieza` / `descargarPieza`.

## Secrets y config (Cloudflare Pages → Settings → Variables and Secrets)
- Secrets: `JWT_SECRET`, `RESEND_KEY`, `GEMINI_API_KEY` (ya cargada). Opcional `GEMINI_MODEL`.
- `wrangler.toml [vars]`: `SITE_URL`, `SUPER_ADMIN_EMAIL`, `RESEND_FROM`, `ALLOWED_EMAILS`. D1 binding `DB`. **No hay R2** (por eso la biblioteca de imágenes es por URL).

## Roadmap / pendientes
1. **IA**: resolver la cuota de Gemini (variable `GEMINI_MODEL` o billing). Luego **conectar el brief para que genere directamente la Composición global completa** (imagen de biblioteca + las 6 capas), no solo los textos.
2. ~~Fase 3 del 🪄~~ ✅ **hecha** (swatches de fondo, biblioteca en imagen/logo, "✨ Sugerir textos con IA").
3. ✅ Social ya usa capas (colección `social`). Pendiente: colecciones **Mobile** y "Todos", e Invitaciones como composición si se quiere.
4. Nota de diseño: el **email** sigue siendo flujo de bloques (documento vertical); las **capas** son para creatividades de tamaño fijo (Display/Social/Invitaciones).

## Historial de fases de Colecciones por capas
- Fase 1: Composición global (6 capas) + tablero + editor en Diseño. ✅
- Fase 2: Custom por tamaño (overrides + herencia + reset). ✅
- Fase 3: el 🪄 (swatches fondo, biblioteca imagen/logo, sugerir textos con IA). ✅
- Tablero agrupado por familia (cuadrados/verticales/franjas). ✅

## Cómo verificar (plantilla Playwright)
Levantar server local sirviendo el repo + mocks `/api/*`; abrir `/editor.html`; usar `page.evaluate` con las funciones globales (`crearProyecto`, `crearDesde`, `cambiarFormato('__coleccion:display-desktop')`, `setComp`, etc.); servir un SVG local para imágenes; capturar `page.screenshot`. Revisar `console`/`pageerror` (ignorar `ERR_CERT`).
