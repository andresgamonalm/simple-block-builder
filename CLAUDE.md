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
- **Grid (Grid 2/3/4 columnas):** cada columna puede contener **cualquier bloque** (anidado). Editar con `editandoCelda` + `bloqueCtx()`; selector por columna `tiposCeldaOptions()`. **Celdas clicables en el LIENZO** (`clicCeldaGrid`/`attachCeldasDeGrid`): clic en columna vacía → popover `abrirPickerCelda` (catálogo de bloques) que la llena y abre su editor; clic en columna con contenido → la edita. `renderGridCeldasCampo` sincroniza nº de celdas-editables con el selector "Columnas" (antes el lienzo mostraba 3 columnas pero el form decía "Sin columnas todavía" y el clic en la celda no hacía nada → bug "no le puedes poner nada dentro", ya arreglado). Los listeners de celda se reenganchan en `renderBloqueSeleccionado` tras cada edición. La clase `.cell-interactiva` es solo del editor (no sale en el export).
- **Marcas (BIBLIOTECA, kits de identidad)** — `workspace.marcas[]` (**biblioteca de N marcas**). Modal en 2 vistas: **biblioteca** (`#marca-biblioteca`: listado de tarjetas con logo+swatches y Aplicar/Editar/Eliminar, encabezado "Tus marcas" + botón **＋ Nueva marca**) y **formulario** (`#marca-form`, oculto por defecto). Navegación: `mostrarBibliotecaMarcas()` / `mostrarFormMarca()` / `nuevaMarcaForm()` / `cerrarMarcaForm()` (botón "Volver"). `guardarMarca` vuelve a la biblioteca; cada `guardarMarca` sin `marca-edit-id` crea una nueva (no reemplaza). Modelo: `{ id, nombre, empresa, logo, logoClaro, primary, secondary, cta, ctaText, text, bg, bgPagina, accent1, accent2, fontTitulo, fontCuerpo, negocio, tono, eslogan, publico, productos, usar, evitar, headerTagline, direccion, copyright, unsubTexto, disclaimer }`. **Acento 1/2** = colores extra de paleta (aparecen como swatches en banners vía `coloresMarcaPreset`). Campos de **email** (headerTagline, direccion, copyright, unsubTexto, disclaimer) → al aplicar marca a un email se crean header+footer (no duplica). Campos de **IA** (negocio, tono, publico, productos, usar, evitar, disclaimer) van al prompt. **Plantilla lista**: `rellenarMarcaZurich()` (azul #2167AE, Montserrat/Inter). Botón "Plantilla Zurich" en el form. (jul-2026: se eliminó por completo la otra plantilla de marca previa y todo su material, por orden del usuario; no reintroducir.) `normalizarMarca()` migra marcas viejas (`font`→fontTitulo/Cuerpo, `logoUrl`→logo, `bg`→secondary). **Logos subidos como archivo** (`subirLogoMarca`: reduce a ≤512px y guarda **data URL PNG** incrustado, NO R2; sincroniza con el workspace). `logoClaro` = versión para fondos oscuros; `logoDeMarca(m,fondoOscuro)` + `esColorOscuro(hex)` eligen el logo correcto. `aplicarMarca` aplica identidad a documentos (bloques) **y a composiciones por zonas** (fondo=secundario, CTA colores, logo claro si fondo oscuro, eslogan→titular). La **Voz de marca** (negocio/tono/eslogan) + paleta extendida se mandan a la IA (`generarConIA` y modo textos); `ia.js` las usa en el prompt.
- **Biblioteca de imágenes** (`workspace.imagenes`): **subida de archivos a R2** (`subirImagenes`/`soltarImagenes` → `POST /api/upload`) **o** pegar URL. Modal desde dashboard "Biblioteca de imágenes" y botón en barra. Campo `imgurl` con "Elegir de la biblioteca" en bloques Imagen/Hero (`elegirImagenPara`) y en banners (`elegirImagenPath`).
  - **R2 (`functions/api/upload.js`):** `POST /api/upload` (body binario + `X-Filename`, o multipart) guarda en el bucket vía binding **`IMAGENES`** y devuelve `{ url:/api/upload?k=<key> }` (mismo dominio, NO requiere bucket público). `GET /api/upload?k=` sirve los bytes (cache inmutable). Máx 8 MB, tipos imagen. **Setup en Cloudflare:** suscribir R2 (gratis), crear bucket (`simple-builder-block-img`), y **Pages → Settings → Bindings → R2** con variable `IMAGENES` apuntando al bucket. La imagen subida queda con `enR2:true`.
- **Papelera (soft-delete de proyectos)** — `workspace.papelera[]`. `eliminarProyecto` ya NO destruye: llama `moverAPapelera(id)` (mueve el proyecto a `papelera` con sello `borradoTs`). `borrarTodosProyectos()` envía todos de una (botón **"Borrar todo"** en el header de proyectos, oculto si no hay proyectos). Modal **Papelera** (`abrirPapelera`/`renderPapelera`, `#modal-papelera`) con **Restaurar** (`restaurarProyecto`, borra `borradoTs` y devuelve a `proyectos`), **Eliminar definitivo** (`eliminarDefinitivo`, confirm) y **Vaciar papelera** (`vaciarPapelera`). Entrada en nav **Sistema → Papelera** con badge contador (`#nav-pap-badge`). Sincroniza con D1 como parte del workspace (last-write-wins); `normalizarWorkspace` añade `papelera:[]` por defecto.
- **Motor de IA (2 productos)** — `functions/api/ia.js`: `POST /api/ia { producto:'email'|'banner', brief:{que,accion,gancho,refs[]}, marca, imagenes, catalogo }`. **Email** → `generarEmail` devuelve `{nombre, bloques[]}` (header→contenido→CTA→footer con disclaimer). **Banner** → `generarBanner` devuelve `{nombre, zonas:{titular,cuerpo,cta}, imagen}` (la IA elige una URL de la biblioteca) y el cliente arma la colección Display por zonas (`insertarBannerIA`, máster 300x250, 9 tamaños, colores+logo de marca). Helpers comunes: `voorMarca()` (voz de marca completa en el prompt), `reglasBrief()` (gancho exacto, no inventar precios/fechas), `leerReferencias()` (descarga 1–3 links del brief y extrae texto como contexto), `llamarGemini()`. Modal: **Marca** (obligatoria, inyecta todo) + **¿Qué producto?** (Email/Banner, segmento `iaSetFormato`) + **¿Qué necesitas?** + **Acción** + **Gancho/oferta** + **Links de referencia**. Cliente: `generarConIA` manda la marca normalizada + biblioteca. `catalogoBloquesParaIA()` solo para email.
  - Modo extra: `POST /api/ia { modo:'textos', brief }` → `{ titular, cuerpo, cta }` (botón "Sugerir textos con IA").
  - **Modo imagen (jul-2026):** `POST /api/ia { modo:'imagen', brief:{que}, marca? }` → genera una FOTO con **Imagen** (misma `GEMINI_API_KEY`; modelos con fallback `GEMINI_IMAGEN_MODEL` → imagen-4.0 → imagen-3.0), la guarda en R2 (`ia/<ts>-<slug>.png`) y devuelve `{url:/api/upload?k=…}`. Cliente: botón **"Generar fondo con IA"** (`generarFondoIA`, junto a Sugerir textos) aplica la foto como fondo de la composición y la suma a la biblioteca; y en `generarConIA` de banner, si la biblioteca está vacía se **genera un fondo automáticamente** antes de componer.
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

## Sesión jun-2026: Marcas, Header/Footer de email, IA pro (ESTADO ACTUAL — no rehacer)
**Decisiones UNIVERSALES (respetar siempre):**
- **NADA redondeado por defecto.** El radio es 100% manual del usuario. Marcas con `radio:"0"` (Zurich, en plantillas y D1); radios por defecto de bloques en `0` (imagen, imgtext, cta, kpi, statGrid/ring, product, article); header/footer de marca con `radioBloque:"0"` (no heredan el radio global); se quitó el `border-radius` fijo del CSS de `.sbb-img-text .col-img img` y el `border-radius` del `.canvas-frame`. (El usuario lo pidió ~10 veces: NO mandar bordes curvos por default.)
- **Fondo de color POR bloque:** `styleDefaults.bgBloque` + campo `colorOpt` ("Fondo del bloque", con "Sin fondo/Quitar"). `wrap()` aplica fondo+padding+radio en el mismo div externo.
- **Todos los números se escriben**, no solo slider: el campo `range` renderiza slider + input `number` (`.rnum`) sincronizados.
- **Márgenes 4 lados** en TODAS las formas: bloques (padTop/Bottom/Left/Right en `styleFields`) y banners/composición (`comp.margen={t,r,b,l}` → padding del `.cmp-zonas`, escalado por tamaño, editable global y por tamaño).
- **"Ancho del bloque"** (campo `ancho`, %/px) repuesto en `styleFields`.
- **Controles estructurales de componentes (jun-2026, aplican al bloque EN GENERAL — sin versiones por sección):**
  - **Alineación H** suma **"Justificado"** (`textAlignDe()`; `justifyH('justify')→stretch`). Sirve en todos los bloques que usan `alinH` para `text-align`.
  - **Tipografía por bloque** (`FUENTES` + `fontFamilyCSS()`, "" = hereda del tema). **Hero**: campos `fuente`, `tamTitulo`, `tamSub` + `text-align` por `alinH`. **Lista de features**: `orientacion` (horizontal=ícono al lado / vertical=ícono arriba, clase `.sbb-features.vertical`), `fuente`, `tamTitulo` (título superior), `tamItemTitulo`, `tamItemSub`, `gapItems` (distancia entre ítems → `padding` por `li`).
  - **Panel Diseño (tema):** **Color CTA** (`tema.ctaColor`; el bloque `cta` usa `d.colorFondo || ctaColor || primary`) y **Margen del lienzo 4 lados** (`tema.margen={t,r,b,l}` → `paddingPaginaCSS()` aplica padding a `.sbb-page` en editor y export; `cambiarMargen()`).
  - Nota de scope: los specs de bloques que pasó el usuario eran para **/email-ia** y **/gdn-ia (banner)**; **/free (libre)** usa TODOS los bloques. Como los cambios son estructurales, libre también los hereda (no hay forks por sección). La curación de QUÉ bloques aparecen en cada sección (email-ia: Grid, Hero, Texto, Imagen, CTA, KPI, Audio, Formulario, Redes, Ícono) es trabajo aparte (fase de secciones/rutas).

**Marcas (header/footer de email):** son **bloques** `bandaHeader`/`bandaFooter` (+ variantes `bandaHeaderBlanco`/`bandaFooterBlanco`), full-bleed. Estilo por marca: campo `bandaEstilo` ('solido'|'blanco') → lo usan `aplicarMarca` y la IA. Footer: logo enlaza a `web` de la marca; redes de `redesDeMarca()` (FB/IG/LinkedIn/YouTube/Spotify, sin web). Marca con `gap`, `radio`, `bandaEstilo`, redes (web/facebook/instagram/linkedin/youtube/spotify). **"Zurich" SIN tilde.** Logos Zurich en **R2** (`/api/upload?k=zurich/Logo-Zurich.png` y `…-Blanco.png`); productos digitales reales cargados. El selector "Aplicar" SOLO aparece dentro del editor (en dashboard la modal es biblioteca). En el editor de colección hay selector de marca + botón "Logo de la marca".

**IA (`functions/api/ia.js`):** modelo por defecto **`gemini-2.5-flash`** (jul-2026: se subió desde flash-lite por calidad de copy; overridable con `GEMINI_MODEL`, p.ej. `gemini-2.5-pro`) con **`thinkingConfig.thinkingBudget:0`** (clave: el thinking se comía los tokens). `extraerJSON()` tolerante (fences/prosa/balanceo). `leerReferencias()`: lee **solo las URLs exactas** que pega el usuario (máx 2), **en paralelo**, extrayendo título+meta+OG+titulares/párrafos (sin nav/footer); el prompt le pide **RAZONAR** sobre ese contenido. Multimodal **light**: en banners la IA "ve" hasta **3 miniaturas (224px)**; excluye **logos/íconos** (`esLogoOIcono`); en email descarta imágenes **<300px**. Candidatas de imagen = `workspace.imagenes` **+ bucket R2** (no solo la lib local); si la IA no pone foto, se **inserta** una; campo **"Fotos a usar"** para elegir de la biblioteca (la IA usa solo esas). `voorMarca()` + `reglasBrief()` + `enfoqueDe(tipo)`.
- **Form IA:** Marca · ¿Qué producto? · **Tipo de email** (comercial/corporativo/informativo/newsletter; comercial=vende, resto blando) · ¿Qué necesitas? · Acción (CTA) · Gancho/oferta · **Destino del CTA** (link, se pega a los CTA) · **URL referencia 1/2** (opcionales) · **Indicaciones generales** (opcional) · **Fotos a usar**.
- **Reglas de email IA:** usa el **header/footer de MARCA** (no genéricos; quita los que invente y aplica la marca con el logo real); **CTA solo al final** salvo newsletter (con su link); **titulares sin punto final**; **oferta destacada DESPUÉS de la foto**; **íconos distintos** por feature (`diversificarIconos`); **foto obligatoria** si hay imágenes.

**Otros:** ruteo `/home` (dashboard) y `/editor` (editando) vía History API + `_redirects`. Biblioteca: **optimiza al subir** (≤1600px, recomprime) y **lista el bucket R2** (`GET /api/upload?list=1`). El botón papelera del editor **elimina la creatividad** (no "vaciar"). Escritura directa a D1 vía MCP Cloudflare para crear/editar marcas del usuario (bump `_ts` para que la app las adopte al recargar).

## Secciones por ruta (path) — jun-2026
El app se organiza en **secciones con URL propia** (mockup del usuario). El SPA (editor.html) se sirve en todas las rutas vía `_redirects` y entra a la sección leyendo `location.pathname`.
- **Registro `RUTAS_PRODUCTO`**: `/email-ia` (email), `/gdn-ia` (display-300x250, composición por zonas), `/free` (libre); `/post-ia` y `/ads-ia` = `{pronto:true}` (en gris, toast "próximamente"). **`RUTAS_MENU`**: `/marcas`, `/papelera`, `/permisos`, `/configuracion` (abren su panel sobre el dashboard).
- **`irARuta(ruta)`**: `pushState` + acción (entra al editor de ese producto vía `crearDesde(tipo)`, o abre el menú, o toast si es "pronto"). **`aplicarRutaInicial()`** maneja deep-links (carga directa de `/email-ia`, etc.).
- **NO existe una ruta `/editor` genérica** (la quitó el usuario). Al editar, la URL es **siempre la sección de la pieza** vía `rutaDeProducto(p)` (email→/email-ia, composición→/gdn-ia, libre/otros→/free). `editor.html` es solo el **archivo físico** del SPA, no una ruta visible.
- **Lanzador** en el dashboard (`.dash-lanzador`): tarjetas **Crear · Ahora** (Email/Banner/Libre) + **Pronto** (Post/Google Search en gris con pill). **Nav** reorganizada: Principal · Crear·Ahora · Pronto · Menú (cada ítem `data-ruta` → `irARuta`).
- **Curación por sección (HECHO):** `seccionActual = rutaDeProducto(pieza())`. **`/email-ia`**: la biblioteca muestra SOLO `BLOQUES_EMAIL_IA` (bandaHeader/Footer ±blanco, grid, hero, texto, imagen, cta, divisor, espaciador, features, kpi, audio, formulario, social, icono) y el selector de Formato ofrece **solo Email** (sin Display/Social/Invitación ni Colecciones). **`/free`**: todos los bloques + formatos (libre/email/invitación + Colecciones). **`/gdn-ia`**: composición por zonas (la pestaña Bloques se bloquea). `renderBiblioteca` y `renderFormatoSelect` leen la sección; se reaplican en `activarPieza`/`cambiarFormato`.

## Sesión jun-2026 (parte 2): secciones, editor de /gdn-ia y fixes (ESTADO ACTUAL — no rehacer)
- **Editor de composición ampliado (lámina /gdn-ia):** en `compEditorHTML` las zonas **Texto** y **CTA** tienen **Tipografía** (`selFuente`, `FUENTES`) y **estilo Negrita/Cursiva** (`togBtns` → `setCompTog`/`setCompOvTog`, banderas `negrita`/`italica` en titular, cuerpo y cta; aplicadas en `zonaContenido`). El **fondo y las zonas-color** tienen **mezclador HEX** (`hexInp`) + **swatches SOLO de la marca** (`coloresDeMarca`, sin presets genéricos; si no hay marca, invita a aplicar una). Posición H+V ya cubría "derecha/izquierda/arriba/abajo".
- **BUG dimensiones (arreglado):** los numéricos de la composición usan **clamp** (`setCompN`/`setCompOvN` + `clampN`) → no se aceptan valores fuera de rango (logo, márgenes, %, tamaños), ni en global ni en override.
- **BUG máster (arreglado):** **editar el máster = editar el Diseño GLOBAL** (todos heredan). El máster nunca queda con override propio; `compEditorHTML(p,fmt,ctx)` detecta `esMaster` y escribe con `setComp` (no `setCompOv`). `renderFormTamaño` rotula el máster como "edita el Diseño base". Piezas viejas se **sanean** en `asegurarComposicionNueva` (el override del máster se fusiona al global y se limpia). Era la causa de "editas el máster y cambia el de al lado".
- **BUG franja blanca en verticales:** NO reproducido tras arreglar dimensiones+máster (con `cover` el fondo cubre el 100%; con `contain` + fondo claro salen barras del color de fondo = comportamiento esperado). **Pendiente confirmar** con captura del usuario si persiste.
- **Renombrar (arreglado):** en el breadcrumb del editor, **clic en el nombre del proyecto o de la creatividad** los edita inline (`_renombrarInline`: selecciona todo, Enter guarda, Escape cancela, blur guarda). Antes el proyecto no se podía renombrar y la pieza dependía de doble-clic con bugs.
- **Header/Footer de marca (arreglado):** los campos de **logo** (`logoClaro`/`logoColor`) son ahora `imgurl` (botón "Elegir de la biblioteca" + subir), no texto.
- **Grid (mejorado):** además del clic en celda (picker), ahora se puede **arrastrar un bloque de la biblioteca ENCIMA de una celda** y la llena (drop en `attachCeldasDeGrid`, clase `.cell-drop`), en vez de soltarlo como hermano. `agregarBloque` limpia `editandoCelda`.

## Plantillas de email pro (jun-2026) — primitivos construidos
Tras analizar 5 referencias (GoBrash + 4 zips: viajes, salud, chequeos, préstamos), el estándar común = **secciones full-bleed de color alternadas + botones sólido/outline + eyebrow/píldoras + filas imagen+texto + footer en banda**. Primitivos agregados:
- **Bloque `seccion`** ("Sección con fondo"): banda full-bleed (patrón de `bandaHeader`) con **eyebrow + título + texto + botón** (sólido/outline). Campos: `bg`, `colorTexto`, `colorEyebrow`, `fuenteTitulo`, `tamTitulo/tamSub`, `padV/padH`, `alinH`, `botonTexto/Url/Variante/Color`. En `BLOQUES_EMAIL_IA`.
- **CTA `variante`** = `solido`|`outline` (outline = transparente + borde del acento). Border 2px siempre para tamaño consistente.
- **Fuentes display** en `FUENTES` + Google Fonts: **Oswald, Anton, Bebas Neue, Archivo Black** (titulares condensados).
- `imgtext` NO está en email-ia (el usuario lo encontró "escolar"); las filas artículo se hacen con `grid` 2-col.
- **3 plantillas de email nuevas (HECHO)** en `PLANTILLAS` (grupo Email): **`email-promo`** (Promoción/Oferta: hero navy + foto + banda amarilla "40% OFF" + features + CTA azul), **`email-newsletter`** (filas artículo con `grid` 2-col [imagen | seccion(transparente) con "Leer más" outline], alternadas), **`email-bienvenida`** (hero + foto + "Cómo funciona" + features 3 pasos + CTA). Todas con marca Gamonal (navy #040764 / azul #1c73cb / amarillo #fce865), titulares en Anton/Montserrat, bandas full-bleed alternadas. `cargarPlantilla` normaliza las celdas de grid (cada celda = bloque completo defaults+datos). Verificado con Playwright (estructura + capturas, sin errores).

- **Grid (disposiciones jun-2026):** `gridSpec(d)` define el layout: **cols** (1-4 iguales), **1x2** (1 grande + 2 al lado, la grande ocupa 2 filas vía `grid-row`), **1x3** (1 grande + 3), **2x2** y **3x3** (mosaicos). **Proporción ajustable** (`propGrid` %, ancho de la parte grande / 1ª columna) sin romper la otra (`minmax(0,1fr)`). **Responsive**: `apilarMobile` + media query `max-width:540px` resetea columnas/filas/spans (apila). Las celdas siguen clicables y aceptan drop en todas las disposiciones.

## Rediseño "Portal" (Propuesta C) — jul-2026 (ESTADO ACTUAL DE LA UI)
Rediseño integral de la interfaz según el handoff aprobado (Propuesta C · "Portal", estilo
Microsoft/Salesforce). **Solo re-vestido de UI + reorganización de navegación: funciones,
datos y contratos de API intactos** (una sola extensión aditiva en `/api/whoami`).
- **Tokens**: Roboto 300–600 (nunca 700 ni itálica en UI), texto `#12173d`, fondo app `#eef1f6`,
  líneas `#e4e8f0`, navy `#040764` = primario, azul `#1C73CB` acento/links/selección, turquesa,
  amarillo SOLO CTA sobre navy, magenta puntual (IA, destructivo). Radio 10px del **chrome**
  (el contenido de las piezas sigue SIN radio por defecto — decisión del usuario). Sin degradados.
  Chips por tipo: EMAIL azul · DISPLAY turquesa · LIBRE magenta. Ver `DECISIONES-VISUALES.md`.
- **Logo nuevo** (barra amarilla + 2 bloques sobre navy): `brand/logo_simple_block_builder.svg/.png`,
  `brand/icono_simple_block_builder.ico` (16/32/48/256, PNG embebido), `…_1000x1000.png`;
  favicon = `brand/simple-block-builder.svg` (actualizado al mark nuevo).
- **Shell del dashboard** (`#galeria`): barra superior `.cnav` (logo · Inicio·Proyectos·Marcas·Imágenes
  con subrayado navy activo · buscar (enfoca la búsqueda de Proyectos) · sparkle IA magenta ·
  botón **+ Nueva** (menú Email/Banner/Libre/Proyecto) · **avatar** con menú (rol real de whoami,
  Permisos/Configuración/Papelera/Cerrar sesión en magenta)). **FAB "Crear con IA"** en todo el
  dashboard (no en el editor). Controlador: `dashView` + `dashIr(v)`/`dashVista(v)`; páginas
  `pg-home/pg-proyectos/pg-marcas/pg-imagenes/pg-papelera/pg-permisos/pg-config`.
- **Home**: "Hola, {perfil.nombre}" + fecha; bloque navy "¿Qué vas a crear hoy?" (eyebrow EMPIEZA
  AQUÍ, input de idea → `generarDesdeIdea()` prellena `#ia-que` y abre el Asistente; título/sub
  editables vía `workspace.banner` con `editarBanner()`); lanzadores Email/Banner/Libre + Pronto;
  "Tus creatividades": total, filtros pill, "Ver las N →", grid de 6 tarjetas por TIPO (tinte +
  ícono + chip + nombre + "Editado hace…" (`p._mod`, se sella en `persistir()` solo al editar) +
  estado Listo/Borrador). Tarjeta → `abrirPiezaDesdeDash(prId,pId)`.
- **Proyectos** (`/proyectos`, ruta nueva): filtros + búsqueda + grupos por proyecto (renombrar
  inline, eliminar, popover "Nueva creatividad" por proyecto) con filas Creatividad·Tipo·Piezas·
  Estado·acciones (editar/preview/duplicar/eliminar). `renderProyectosPage()`; los renders viejos
  (`renderProyectos/renderCreatividades`) son shims. La dona/stats del dashboard viejo se retiró.
- **Marcas/Imágenes/Papelera = páginas** del dashboard. El MISMO contenido (`#marcas-cont`,
  `#imagenes-cont`, `#papelera-cont`) se **reparenta** entre página y modal (`montarEn`): desde el
  editor, `abrirMarcas()`/`abrirImagenes(pick)` siguen siendo modales (picker intacto); al cerrar
  un modal con el dashboard visible se re-monta en la página (`_remountTrasModal`).
- **Permisos/Configuración = páginas reales** (antes toasts "próximamente"). `/api/whoami` ahora
  (solo super admin, aditivo) devuelve `allowed[]`, `superAdmin` y `config{resendFrom,siteUrl,
  integraciones{gemini,resend,d1,r2}}` → tabla de correos autorizados (rol real; alta de correos
  se explica: var `ALLOWED_EMAILS`) y tarjetas Cuenta (Nombre editable → `workspace.perfil.nombre`,
  usado en el saludo)/Envío/Integraciones con badges Conectado reales.
- **Editor a pantalla completa**: cabecera de UNA fila — logo-mark → `abrirGaleria()`, breadcrumb
  `Proyectos › proyecto › pieza` (renombrables) + **chip de tipo** (`#ed-chip`, se pinta en
  `renderTabsPiezas`), y a la derecha sync "Guardado", deshacer, Formato, set-tools, dev-seg,
  Vista previa, Enviar prueba, Char-B, imágenes/importar/eliminar (íconos), **Exportar** navy.
  A <1560px los textos de botones colapsan a íconos (`.tb-txt`). Paneles flotantes sobre #f5f5f5.
- **Asistente IA en 3 pasos** (Producto+Marca / Brief / Resultado): `iaIrPaso()`/`iaGenerar()`;
  los campos e IDs y `generarConIA()` no cambiaron; "Tipo de email" se oculta si producto=banner.
  Exportar: mismo motor; el modal de documentos suma botón "Enviar prueba".
- **Login** (`index.html`): panel formulario + área visual con **foto Envato FOTO-001 (DGQZAQM)**
  — registro y flujo en `ENVATO_ASSETS.md`; hasta que exista
  `assets/login/foto_login_simple_block_builder.jpg` (descarga del usuario) se muestra un panel
  editorial navy con eslogan (nunca imagen rota). JS del magic-link intacto. Ruta `/login` añadida.
- **Móvil** (≤820px): barra inferior de pestañas (Inicio · Proyectos · **+** amarillo · Marcas ·
  Cuenta), top bar reducida (logo + avatar), Home/Proyectos/Config adaptados; editores en desktop.
- **Rutas**: `_redirects` suma `/login /proyectos /imagenes`. `RUTAS_MENU` ahora abre páginas
  (`dashVista`). La URL del dashboard refleja la vista (`urlDeVista`), la del editor su sección.
- **Verificación**: Playwright (server local + mocks `/api/*`) — 21/21 PASS, 0 errores de consola,
  desktop + móvil. Capturas y portada 1920×1080 en `entregables/`.

## Módulo Google Search Ads (/ads-ia) — jul-2026 (ESTADO ACTUAL — no rehacer)
Pedido del usuario: campañas de Search "pensando como especialista, no como Google" —
**agrupación por INTENCIÓN de búsqueda, SOLO concordancia exacta y de frase (amplia
PROHIBIDA), negativas razonadas** y anuncios RSA con límites reales.
- **Backend** (`ia.js`): `POST /api/ia { producto:'ads', brief:{que,accion,gancho,ctaUrl,refs,notas}, marca }` → `generarAds` devuelve `{ nombre, urlFinal, grupos:[{nombre,intencion,razonamiento,keywords:[{t,tipo:'exacta'|'frase'}],negativas[],titulares[≤30 chars],descripciones[≤90],path1,path2[≤15]}], negativas[campaña] }`. El servidor **VALIDA duro**: recorta a 30/90/15, dedup, cualquier tipo≠frase cae a exacta (amplia jamás), 5-10 kw/grupo, ≥5 negativas. `voorMarca()` + `reglasBrief()` + `leerReferencias()` (lee la landing para usar su vocabulario). maxTokens 6144.
- **Frontend**: formato **`"ads"`** en FORMATOS (badge Ads, ancho 680, alto 0, documento). `categoriaDe→"Ads"`, chip `.chip.ads` navy "ADS", filtro "Search" en Home/Proyectos. `RUTAS_PRODUCTO["/ads-ia"]={tipo:"ads"}` (ya NO pronto); `rutaDeProducto` ads→/ads-ia. Lanzador Home + menús "+ Nueva" (desktop/móvil/por-proyecto). En /ads-ia: selector de formato solo "ads", biblioteca curada `BLOQUES_ADS_IA` (texto,tabla,divisor,espaciador,alert), sin plantillas (`GRUPOS_PLANTILLA_POR_CAT.Ads=[]`).
- **Asistente IA**: 3er producto "Google Search" (checks de piezas; oculta tipo-email y fotos; `abrirIA()` preselecciona según sección). `generarConIA` rama ads (sin imágenes) → **`insertarAdsIA`**: guarda la campaña ÍNTEGRA en **`p.adsData`** con `canvas:[]` (adsData = ÚNICA fuente de verdad).
- **CONSOLA de campaña (jul-2026, rediseño pedido por el usuario — la 1ª versión de bloques apilados "no se entiende"):** formato ads NO usa bloques: `renderCanvas` desvía a **`renderAdsCampana()`** (clase `.adsc`, ancho 1180). Referencia de diagramación: la consola de Google Ads + Ads Editor. Header (eyebrow, título, landing editable, stat-chips) + **píldoras sticky** `Vista general · <grupo> · N kw` (`adsVista`/`adsIrVista`, sin scroll infinito). Vista general = tarjeta de estrategia por grupo (intención + 3 kw de muestra, clic → grupo) + negativas de campaña en chips magenta. Vista de grupo = callout de intención + 2 columnas: keywords (chip [Exacta] azul / "Frase" turquesa, **clic alterna** `adsToggleKw`) y anuncio **previsualizado como en Google** (`.adsc-serp`: Patrocinado, ruta con paths, 3 titulares con |, descripción) + inventarios de titulares/descripciones con **contador n/30 y n/90** (rojo si excede). **Edición inline** (`contenteditable` + `adsEditar` → `setPath` en adsData → persistir) y botones **Copiar** por sección (`adsCopiar`). Pieza ads sin adsData → estado vacío con botón a Char-B. Bloques/Plantillas bloqueadas (`actualizarUISet`), `agregarBloque` no-op, `estadoDe` cuenta adsData, `_deslug` hace legibles nombres-slug.
- **Export**: `abrirExportar` detecta formato ads → modal con **CSV de keywords+negativas** (`descargarCSVKeywords`: cabecera `Campaign,Ad Group,Keyword,Criterion Type`, Exact/Phrase, negativas como Negative Phrase, las de campaña con Ad Group vacío) y **CSV de anuncios RSA** (`descargarCSVAnuncios`: Headline 1..N, Description 1..4, Path 1/2, Final URL=`adsData.urlFinal`; re-recorta 30/90/15 por si el usuario alargó al editar) + **resumen HTML propio** (`generarHTMLDeAds`, enganchado en `generarHTMLDePieza` — cubre descarga, copiar y vista previa). Cabeceras en inglés = las que Google Ads Editor reconoce solo. BOM UTF-8 (`_descargarCSV`).
- **Cantidad de keywords (pedido del usuario: 8-10 era poco):** 12-20 por grupo (cap servidor 25), cubriendo variantes reales (singular/plural, sinónimos, online/precio/chile); nombres de campaña/grupo LEGIBLES (regla en prompt + `legible()` en servidor des-sluggifica). maxTokens 8192.
- Verificado con Playwright (32/32 PASS con la consola, mock `producto:'ads'` en el server de prueba).

## Asistente CAMPAÑA-PRIMERO — jul-2026 (ESTADO ACTUAL — no rehacer)
Decisión (razonada con el usuario, a raíz de "réplica de AdWords / MAX"): NO se replica
AdWords (sin presupuestos/pujas — la app no publica en Google); lo que se adopta es el
modelo **campaña-primero**: la unidad de trabajo es LA CAMPAÑA, no el formato.
- **Asistente IA paso 1**: ya no hay selector de UN producto — hay **checks multi**
  (`#ia-piezas-seg`, estado `iaPiezas={email,banner,ads}`, `iaTogglePieza`/`iaPintaPiezas`;
  nunca 0 marcadas). `iaSetFormato(f)` queda como compat de selección única (la usan los
  deep-links). `abrirIA()`: en sección → SU pieza sola; desde dashboard/free → las 3 marcadas.
  Tipo-de-email visible si email✓; fotos visibles si email✓ o banner✓. Se eliminó el hidden
  `#ia-formato`.
- **Backend `modo:'concepto'`** (`ia.js`): `{ modo:'concepto', brief, marca }` →
  `{ nombre, concepto:{idea, titular(sin punto, ≤7 palabras), mensajes[≤4]} }`. Director
  creativo define UNA idea multicanal; gancho exacto; usa `voorMarca`+`reglasBrief`+refs.
- **`generarConIA` = orquestador**: con 2+ piezas pide primero el CONCEPTO, lo inyecta en
  `brief.notas` ("CONCEPTO DE CAMPAÑA...") de CADA generador (email/banner/ads sin cambios),
  y **crea un proyecto propio** `"Campaña · <nombre>"` (proyecto = campaña) donde caen todas
  las piezas. Genera en orden email→banner→ads; si una falla, sigue con las demás y avisa
  (`fallas[]`); solo aborta si fallan todas. Biblioteca de fotos se junta UNA vez (no por pieza).
- **Tamaños MAX**: FORMATOS suma `display-1200x628` (1.91:1) y `display-1200x1200`
  (recursos de imagen de Performance Max / Demand Gen) y `SET_DISPLAY_DESKTOP` los incluye
  (11 tamaños; sets viejos no se tocan, los nuevos los traen).
- Verificado con Playwright: veri-campana.js 17/17 + veri-ads.js 30/30 (mocks de
  concepto/email/banner/ads en el server de prueba).

## Estilo "campaña digital" Zurich en el compositor — jul-2026 (ESTADO ACTUAL — no rehacer)
El usuario pegó capturas de los anuncios display REALES de Zurich Chile (Ads Transparency;
el sandbox no puede abrir ese sitio — bloqueo de red hacia google.com). Análisis del sistema
gráfico: fondo plano navy (o foto con velo) · logo arriba-izq (blanco en oscuro) · etiqueta
chica "Seguro" sobre el nombre del producto · LA OFERTA EN UN CÍRCULO sólido de color con el
número grande ("2 Cuotas Gratis", "60% dcto.") · burbujas decorativas de color asomando por
los bordes · CTA sobrio. Se llevó al compositor como CAPACIDADES GENÉRICAS (sirven a
cualquier marca):
- **`comp.burbuja`** = burbuja de OFERTA: `{visible(default off), texto, color, colorTexto,
  tamano(40-220), pos(tr/cr/br/tl/bl)}` → `burbujaHTML()` (clase `.cmp-burbuja`, absoluta,
  z2, diámetro escala con `escF` y se acota a 80% del alto — no se come las franjas). Si el
  texto parte con número, el número sale GRANDE (`.bnum`/`.btxt`).
- **`comp.deco`** = burbujas decorativas: `{visible(default off), color1, color2}` →
  `decoBurbujasHTML()` (SVG determinista de 4 círculos que asoman por los bordes, z0
  bajo las zonas).
- **`zonas.texto.etiqueta`** = píldora de producto sobre el titular: `{texto, color,
  colorTexto, tamano}` (`.cmp-etq`; default fondo translúcido blanco).
- Editor (`compEditorHTML`): secciones "Burbujas decorativas" (tras Fondo) y "Burbuja de
  oferta" (tras CTA) con **`toggleExtraComp(path,fmt)`** (toggle para elementos default-OFF
  — toggleCompVis asume default-ON, no sirve aquí); campo Etiqueta en zona Texto. Swatches
  de marca en burbuja/deco. Overrides por tamaño funcionan (probado apagar burbuja en un
  tamaño). CSS dentro de COMPONENT STYLES → viaja al export/rasterizado.
- **`aplicarMarca`** (composición): accent1→color burbuja (+texto según contraste) y
  deco.color1; accent2→deco.color2 (solo defaults; no enciende nada).
- **IA banner** (`generarBanner`): el JSON suma `zonas.etiqueta` (producto, 1-3 palabras) y
  `burbuja` (el GANCHO exacto abreviado; se fuerza "" si el brief no trae gancho — no se
  inventan ofertas). `insertarBannerIA` los aplica con los acentos de la marca.
- **Marca Zurich**: plantilla y D1 actualizadas a la paleta de campaña: secondary=#1d2e7a
  (navy fondo banner), accent1=#d9e05f (lima oferta), accent2=#72ccfd (celeste burbujas);
  primary #2167ae y CTA #e71313 se mantienen. (D1 via MCP con bump de _ts.)
- Verificado con Playwright: veri-zurich.js 14/14 + regresión campana 17/17 + ads 32/32.

## Roadmap / pendientes
**Pendientes activos (jun-2026):** (1) confirmar/cerrar la **franja blanca en verticales** (esperando captura del caso exacto); (2) **bloques más ricos** para email (features con ícono en círculo de color, secciones con fondo, hero con degradado, tarjetas con sombra — SIN redondeo por defecto); (3) afinar, si se pide, qué tipografías/recursos extra muestran **/gdn-ia** y **/free**; (4) encender **/post-ia** y **/ads-ia** cuando toque.
0. ✅ **(a) PLANTILLAS POR TIPO DE EMAIL — HECHO.** El nuevo `generarEmail` (ia.js) pide a la IA **solo el copy estructurado** `{ nombre, titular, intro, oferta, beneficios:[{icono,titulo,texto}]×3, cierre, cta, imagen }` y el **código arma el esqueleto** según `brief.tipo`: **comercial** = hero(titular sobre foto) → alert(oferta) → texto(intro) → features → espaciador → cta; **corporativo/informativo** = hero → texto(intro) → features → divisor → texto(cierre) → cta (sin alert agresivo); sin foto → título de texto en vez de hero. Íconos validados/distintos (lista `ICONOS_VALIDOS`), titulares sin punto (`sinPuntoFinal`), **un solo CTA al final**. Más rápido (maxTokens 2048, sin pedir maquetación). El cliente (`generarConIA`) ya no duplica fotos (la red de seguridad solo inserta hero si NO hay ningún bloque visual). Verificado con Playwright (10/10 PASS). **Pendiente (b):** bloques más ricos (features con ícono en círculo de color, secciones con fondo, hero con degradado, tarjetas con sombra) — SIN redondeo por defecto. Idea futura: pedir 1-2 emails "bien diseñados" como referencia para clonar el estándar.
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
