/* ══════════════════════════════════════════════════════════════════
   BANNERS · COLECCIONES  ·  funciones/comun/banners/colecciones.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Colecciones de tamaños (COLECCIONES), crear la colección, crearBannerEnBlanco() y convertir/salir de una colección.
   QUIÉN LO USA: MOTOR COMPARTIDO de Display y Facebook.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
const SET_SOCIAL = ["linkedin-post","fb-square","linkedin-link","fb-post","fb-story","linkedin"];
const COLECCIONES = {
  "display-desktop": { fmts: SET_DISPLAY_DESKTOP, master: "display-300x250", nombre: "Display Desktop" },
  "facebook":        { fmts: SET_FACEBOOK,        master: "fb-1080x1350",    nombre: "Facebook Ads" },
  "social":          { fmts: SET_SOCIAL,          master: "linkedin-post",   nombre: "Social" }
};
function esSetPieza(p){ return !!(p && p.esSet && Array.isArray(p.artboards)); }
function temaVars(t){ return `--sbb-font:"${t.font}", "Inter", Arial, sans-serif;--sbb-primary:${t.primary};--sbb-text:${t.text};--sbb-bg:${t.bg};`; }
function artboardActivo(){ const p = pieza(); if(!esSetPieza(p)) return null; return p.artboards.find(a => a.fmt === p.activaFmt) || p.artboards[0] || null; }
function artboardMaster(p){ return p.artboards.find(a => a.fmt === p.masterFmt) || p.artboards[0]; }

// Adapta el contenido del máster a un tamaño concreto (perfil por proporción):
// orientación (fila para anchos), escala de fuentes/logo/padding, y oculta el
// texto largo donde no cabe. Es data-driven → se ve igual en editor y export.
function adaptarCanvasATamaño(masterCanvas, fmt){
  const f = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const W = f.ancho, H = f.alto, ratio = W / H;
  const orient = ratio >= 2.2 ? "fila" : "columna";
  const esc = orient === "fila"
    ? Math.max(0.5,  Math.min(1.1, H / 100))
    : Math.max(0.55, Math.min(1.2, W / 300));
  const chico = (W * H) < (260 * 260);
  const sc = (v, mn) => String(Math.max(mn, Math.round((parseFloat(v) || 0) * esc)));
  const blocks = clone(masterCanvas || []).filter(b => {
    if (b.tipo === "texto" && (orient === "fila" || chico)) return false;   // el cuerpo de texto no cabe
    return true;
  });
  blocks.forEach(b => {
    const d = b.datos || {};
    if (b.tipo === "header") {
      if (d.tamanoTitulo) d.tamanoTitulo = sc(d.tamanoTitulo, 12);
      if (d.tamanoBajada) d.tamanoBajada = sc(d.tamanoBajada, 10);
      if (d.logoAncho)   d.logoAncho   = String(Math.max(32, Math.min(parseInt(sc(d.logoAncho, 32)), Math.round(W * 0.55))));
      if (d.padTop)      d.padTop      = sc(d.padTop, 2);
      if (d.padBottom)   d.padBottom   = sc(d.padBottom, 2);
    } else if (b.tipo === "texto") {
      if (d.tamano) d.tamano = sc(d.tamano, 11);
    } else if (b.tipo === "cta") {
      if (d.tamano) d.tamano = sc(d.tamano, 11);
      if (d.padX)   d.padX   = sc(d.padX, 8);
      if (d.padY)   d.padY   = sc(d.padY, 6);
    } else if (b.tipo === "hero") {
      d.escalaTexto = esc.toFixed(2);   // escala del texto sobre la imagen
    }
  });
  return { canvas: blocks, orient: orient, esc: esc };
}

// Crea un set Desktop: un TABLERO de artboards independientes (uno por tamaño),
// todos visibles en el lienzo. El máster (300×250) arranca con un hero (imagen +
// texto + CTA) y el resto copia su contenido; luego cada banner se edita aparte.
// Deriva la composición (3 zonas) a partir del contenido de una creatividad.
function composicionDesdeCanvas(canvas, tema){
  const comp = composicionDefault(tema);
  (canvas||[]).forEach(b => {
    const d = b.datos || {};
    if(b.tipo==="hero"){ if(d.imagenUrl){ comp.fondo.tipo="imagen"; comp.fondo.imagen.url=d.imagenUrl; } if(d.oscurecer) comp.fondo.imagen.oscurecer=parseInt(d.oscurecer)||40; if(d.titulo) comp.zonas.texto.titular.texto=d.titulo; if(d.sub) comp.zonas.texto.cuerpo.texto=d.sub; if(d.ctaTexto) comp.zonas.cta.texto=d.ctaTexto; if(d.ctaUrl) comp.zonas.cta.url=d.ctaUrl; }
    else if(b.tipo==="header"){ if(d.logoUrl) comp.zonas.logo.url=d.logoUrl; if(d.titulo) comp.zonas.texto.titular.texto=d.titulo; if(d.bajada) comp.zonas.texto.cuerpo.texto=d.bajada; }
    else if(b.tipo==="texto"){ if(d.contenido) comp.zonas.texto.cuerpo.texto=d.contenido; }
    else if(b.tipo==="cta"){ if(d.texto) comp.zonas.cta.texto=d.texto; if(d.url) comp.zonas.cta.url=d.url; }
    else if(b.tipo==="imagen"){ if(d.url && !comp.fondo.imagen.url){ comp.fondo.tipo="imagen"; comp.fondo.imagen.url=d.url; } }
  });
  // Solo adopta el fondo del tema si es oscuro (los textos son blancos).
  if(tema&&tema.bg&&typeof esColorOscuro==="function"&&esColorOscuro(tema.bg)) comp.fondo.color=tema.bg;
  if(tema&&tema.primary) comp.zonas.cta.colorFondo=tema.primary;
  return comp;
}
// Crea una colección por capas (composición) para un set de tamaños.
// ¿La creatividad esta REALMENTE vacia? Antes se miraba solo el lienzo de
// bloques, y una campana de Google Search SIEMPRE lo tiene vacio (sus grupos,
// keywords y anuncios viven en adsData). Por eso al crear un banner estando en
// una campana de Search, la app la daba por vacia y la transformaba: la campana
// desaparecia de la vista. Ahora cuenta como contenido cualquier cosa que el
// usuario haya creado, sea del tipo que sea.
function piezaVacia(p){
  if(!p) return true;
  if(p.canvas && p.canvas.length) return false;              // bloques
  if(p.adsData && (p.adsData.grupos||[]).length) return false; // campana de Search
  if(p.esSet || p.composicion) return false;                  // coleccion de banners
  if(p.asunto || p.preheader) return false;                   // email empezado
  return true;
}
function crearComposicion(tipoCol, comp){
  const cfg = COLECCIONES[tipoCol] || COLECCIONES["display-desktop"];
  const actual = pieza();
  const p = (actual && piezaVacia(actual)) ? actual : crearPieza(cfg.master, cfg.nombre);
  p.nombre = cfg.nombre;
  p.esSet = true;
  p.setTipo = tipoCol;
  p.masterFmt = cfg.master;
  p.activaFmt = cfg.master;
  p.formato = cfg.master;
  p.canvas = [];
  // Nace EN BLANCO con el modelo libre: el usuario diseña el máster y replica.
  p.composicion = comp || p.composicion || libreDefault(p.tema);
  p.artboards = cfg.fmts.map(fmt => ({ fmt }));
  proyecto.activa = p.id;
  document.getElementById("galeria").classList.remove("show");
  activarPieza(p.id);
  cambiarPanelTab("diseno");
  toast("Colección por capas — edita el Diseño global (izquierda) y se aplica a todos los tamaños");
}
function crearSetSocial(){ crearComposicion("social"); }
// Convierte la creatividad ACTUAL en una colección (tablero), usando su contenido
// actual como máster. Se llega desde el selector de Formato → "Colecciones".
function convertirEnColeccion(tipo){
  const p = pieza();
  if(!p){ toast("Abre o crea una creatividad primero"); return; }
  if(esSetPieza(p)){ return; }
  const t = COLECCIONES[tipo] ? tipo : "display-desktop";
  const cfg = COLECCIONES[t];
  p.composicion = composicionDesdeCanvas(p.canvas, p.tema);   // base del diseño global desde lo actual
  p.esSet = true; p.setTipo = t;
  p.masterFmt = cfg.master; p.activaFmt = cfg.master; p.formato = cfg.master;
  p.canvas = []; p.artboards = cfg.fmts.map(fmt => ({ fmt }));
  seleccionado = null;
  activarPieza(p.id);
  cambiarPanelTab("diseno");
  toast("Colección por capas — edita el Diseño global (izquierda) y se aplica a todos los tamaños");
}
function salirDeColeccion(){
  const p = pieza();
  if(!esSetPieza(p)) return;
  if(!confirm("¿Salir de la colección? Quedará solo el banner máster (300×250) como creatividad normal; los demás tamaños se descartan.")) return;
  const master = artboardMaster(p);
  p.canvas = (master && master.canvas) ? master.canvas : [];
  p.formato = p.masterFmt || "display-300x250";
  delete p.esSet; delete p.artboards; delete p.setTipo; delete p.masterFmt; delete p.activaFmt;
  seleccionado = null;
  activarPieza(p.id);
  toast("Saliste de la colección");
}
function ajustarFrameParaSet(es){
  const f = document.getElementById("canvas-frame"); if(!f) return;
  if(es){ f.style.maxWidth=""; f.style.height="auto"; f.style.background="transparent"; f.style.boxShadow="none"; f.dataset.fijo=""; }
  else { f.style.background=""; f.style.boxShadow=""; }
}
// Crea una colección de banners VACÍA y la abre en el editor.
// mantenerProyecto = no crear un proyecto nuevo (para la campaña completa).
function crearBannerEnBlanco(plat, mantenerProyecto){
  if(!puedePlat(plat)){ toast("Tu usuario no tiene acceso a este servicio"); return false; }
  const tipoCol = (plat === "facebook") ? "facebook" : "display-desktop";
  if(!mantenerProyecto || !proyecto){
    const nom = (plat === "facebook") ? "Facebook Ads" : "Google Display";
    const pr = { id:uid(), nombre:nom+" · "+new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"short"}),
                 creado:Date.now(), piezas:[], activa:null };
    workspace.proyectos.push(pr); proyecto = pr; proyectoVistoId = pr.id;
  }
  _rutaActual = (plat === "facebook") ? "/fb-ia" : "/gdn-ia";
  crearComposicion(tipoCol);          // nace con el lienzo libre, en blanco
  elLibreSel = null;
  persistir();
  setURL(_rutaActual);
  return true;
}
