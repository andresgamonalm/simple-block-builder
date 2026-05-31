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
- **Biblioteca de imágenes por URL** (`workspace.imagenes`, sin subir archivos = sin consumir storage). Modal desde dashboard "Biblioteca de imágenes" y botón en barra. Campo `imgurl` con "Elegir de la biblioteca" en bloques Imagen/Hero (`elegirImagenPara`).
- **Motor de IA** — `functions/api/ia.js`: `POST /api/ia` recibe `{brief, formato, marca, imagenes, catalogo}`, llama a **Gemini** y devuelve `{nombre, bloques}`. La IA elige bloques (no escribe HTML). Cliente: botón **✨ IA** (barra) y "Generar con IA" (dashboard) → modal con brief simple. `catalogoBloquesParaIA()` arma el catálogo desde los bloques reales. Diagnóstico: `GET /api/ia` (instantáneo) y `GET /api/ia?gemini=1` (ping a Gemini).
  - **ESTADO/PENDIENTE IA:** la API key del usuario da **HTTP 429 quota 0** en `gemini-2.0-flash` (free tier en 0). Falta: cambiar modelo con la variable `GEMINI_MODEL` (p.ej. `gemini-1.5-flash`) o activar billing en Google AI Studio. La función ya tiene timeout (AbortController) y errores legibles.

### Colecciones por capas (Composición) — el modelo central pedido por el usuario
Idea (de su PPT): una creatividad es una **composición de 6 capas apiladas** (no bloques en flujo). Adapta a cualquier tamaño anclando + escalando, sin reflujo.
- `pieza.esSet` + `pieza.composicion = { fondoColor, imagen(+foco+oscurecer), logo(+alinH+tamaño), titular(+texto+tamaño+alinH+color), cuerpo(idem), cta(+texto+url+alinH+colores) }`. Cada capa con `visible`.
- `pieza.artboards = [{ fmt, ov:{overrides parciales} }]`, `masterFmt`, `activaFmt`.
- `renderComposicion(comp, fmt)` (clase `.cmp`): capas ancladas + **escala automática por proporción**. Reflujo: `ratio>=2.2`→**fila** (leaderboard: logo/texto izq, CTA der); resto→**columna** (tarjeta). Mismo render en editor y export. ⚠️ la var de escala se llama `escF` (no `esc`).
- **Diseño global** = pestaña **Diseño** (`#comp-editor`, `renderComposicionEditor`, mutador `setComp`). **Custom por tamaño** = pestaña **Editar** (`renderFormTamaño`) al hacer **clic en un banner**; `composicionEfectiva(p,fmt)=merge(global,override)`; mutadores `setCompOv`, `toggleCompVisOv`, `resetTamaño`, `resetCapaTamaño`. CSS común `.cmp-ed`.
- **Tablero agrupado por familia** (`familiaDeFormato`): Cuadrados/Rectángulos · Verticales · Franjas. Marca el activo y muestra "· ajustado".
- Entradas: **Formato → Colecciones → "Google Display · Desktop"** (`convertirEnColeccion`, usa el contenido actual como base) y **Plantillas → Google Display → "Set Desktop"** (`crearSetDesktop`). En colecciones se **bloquea Plantillas** y hay botón "Salir de colección".
- Export: `generarHTMLDeComposicion(p, fmt)` (usa `composicionEfectiva`). `exportarArtboard` / `exportarTodoElSet`.
- `SET_DISPLAY_DESKTOP` = los 9 tamaños desktop.

## Secrets y config (Cloudflare Pages → Settings → Variables and Secrets)
- Secrets: `JWT_SECRET`, `RESEND_KEY`, `GEMINI_API_KEY` (ya cargada). Opcional `GEMINI_MODEL`.
- `wrangler.toml [vars]`: `SITE_URL`, `SUPER_ADMIN_EMAIL`, `RESEND_FROM`, `ALLOWED_EMAILS`. D1 binding `DB`. **No hay R2** (por eso la biblioteca de imágenes es por URL).

## Roadmap / pendientes
1. **IA**: resolver la cuota de Gemini (modelo `GEMINI_MODEL` o billing) y luego **conectar el brief para que genere directamente la Composición global** (no solo bloques de email).
2. **Fase 3 del 🪄**: elegir imagen de biblioteca / sugerencia con IA por capa.
3. Llevar el modelo de **capas a Social e Invitaciones**; agregar sets **Mobile** y "Todos".
4. Nota de diseño: el **email** sigue siendo flujo de bloques (documento vertical); las **capas** son para creatividades de tamaño fijo (Display/Social/Invitaciones).

## Cómo verificar (plantilla Playwright)
Levantar server local sirviendo el repo + mocks `/api/*`; abrir `/editor.html`; usar `page.evaluate` con las funciones globales (`crearProyecto`, `crearDesde`, `cambiarFormato('__coleccion:display-desktop')`, `setComp`, etc.); servir un SVG local para imágenes; capturar `page.screenshot`. Revisar `console`/`pageerror` (ignorar `ERR_CERT`).
