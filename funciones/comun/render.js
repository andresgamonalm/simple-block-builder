/* ══════════════════════════════════════════════════════════════════
   PIEZAS DE DIBUJO  ·  funciones/comun/render.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Tipografías, íconos SVG, fechas y el envoltorio de estilos de un bloque (wrap). Lo usan documentos y banners.
   QUIÉN LO USA: Compartido.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
function paddings(d){ const t=d.padTop??"14",r=d.padRight??"24",b=d.padBottom??"14",l=d.padLeft??"24"; return `${t}px ${r}px ${b}px ${l}px`; }
function justifyH(v){ return v==="left"?"flex-start":v==="right"?"flex-end":v==="justify"?"stretch":"center"; }
function justifyV(v){ return v==="top"?"flex-start":v==="bottom"?"flex-end":"center"; }
// Tipografías disponibles (todas precargadas arriba vía Google Fonts). "" = hereda del tema.
const FUENTES = [["","Hereda del tema"],["Inter","Inter"],["Roboto","Roboto"],["Open Sans","Open Sans"],["Lato","Lato"],["Montserrat","Montserrat"],["Poppins","Poppins"],["Oswald","Oswald (condensada)"],["Anton","Anton (display)"],["Bebas Neue","Bebas Neue (display)"],["Archivo Black","Archivo Black (display)"],["Playfair Display","Playfair (serif)"],["Merriweather","Merriweather (serif)"],["Arial","Arial"],["Georgia","Georgia"]];
function fontFamilyCSS(f){ return f ? `font-family:'${esc(f)}',Arial,Helvetica,sans-serif;` : ""; }
// Mapea la Alineación H a text-align (incluye "justify" = justificado).
function textAlignDe(v){ return v==="left"?"left":v==="right"?"right":v==="justify"?"justify":"center"; }
// Disposición de un grid: nº de celdas, columnas y CSS (incluye 1×2, 1×3, 2×2, 3×3 y
// proporción ajustable de la parte grande). Devuelve { cells, tpl, spans }.
function gridSpec(d){
  const disp = (d && d.disposicion) || "cols";
  const prop = Math.max(20, Math.min(80, parseInt(d&&d.propGrid)||60));
  const resto = 100 - prop;
  if(disp==="2x2") return { cells:4, tpl:`grid-template-columns:repeat(2,minmax(0,1fr));`, spans:{} };
  if(disp==="3x3") return { cells:9, tpl:`grid-template-columns:repeat(3,minmax(0,1fr));`, spans:{} };
  if(disp==="1x2") return { cells:3, tpl:`grid-template-columns:${prop}% ${resto}%;grid-template-rows:repeat(2,minmax(0,1fr));`, spans:{0:"grid-row:1 / 3;"} };
  if(disp==="1x3") return { cells:4, tpl:`grid-template-columns:${prop}% ${resto}%;grid-template-rows:repeat(3,minmax(0,1fr));`, spans:{0:"grid-row:1 / 4;"} };
  // "cols": 1-4 columnas iguales (o proporción 2-col si se ajustó propGrid)
  const c = parseInt(d&&d.columnas) || 3;
  const tpl = (c===2 && d && d.propGrid && parseInt(d.propGrid)!==50)
    ? `grid-template-columns:${prop}% ${resto}%;`
    : `grid-template-columns:repeat(${c},minmax(0,1fr));`;
  return { cells:c, tpl, spans:{} };
}

const ICONS = {
  alignLeft: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="6" width="9" height="2" rx="1"/><rect x="1" y="10" width="14" height="2" rx="1"/><rect x="1" y="14" width="9" height="2" rx="1"/></svg>',
  alignCenter: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="3.5" y="6" width="9" height="2" rx="1"/><rect x="1" y="10" width="14" height="2" rx="1"/><rect x="3.5" y="14" width="9" height="2" rx="1"/></svg>',
  alignRight: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="6" y="6" width="9" height="2" rx="1"/><rect x="1" y="10" width="14" height="2" rx="1"/><rect x="6" y="14" width="9" height="2" rx="1"/></svg>',
  alignJustify: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="6" width="14" height="2" rx="1"/><rect x="1" y="10" width="14" height="2" rx="1"/><rect x="1" y="14" width="14" height="2" rx="1"/></svg>',
  alignTop: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="12" height="2" rx="1"/><rect x="4" y="6" width="8" height="6" rx="1"/></svg>',
  alignMiddle: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="4" y="2" width="8" height="3" rx="1"/><rect x="4" y="11" width="8" height="3" rx="1"/></svg>',
  alignBottom: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="13" width="12" height="2" rx="1"/><rect x="4" y="4" width="8" height="6" rx="1"/></svg>'
};

/* SVG line icons — sin fondo de color, controlables por currentColor + stroke-width */
const ICONOS_SVG = {
  email:        { nombre:"Email",           svg:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>' },
  telefono:     { nombre:"Teléfono",        svg:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>' },
  whatsapp:     { nombre:"WhatsApp",        svg:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
  chat:         { nombre:"Chat",            svg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  enviar:       { nombre:"Enviar",          svg:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>' },
  pin:          { nombre:"Pin de mapa",     svg:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
  mapa:         { nombre:"Mapa",            svg:'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>' },
  globo:        { nombre:"Globo",           svg:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
  casa:         { nombre:"Casa",            svg:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  calendario:   { nombre:"Calendario",      svg:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  reloj:        { nombre:"Reloj",           svg:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  usuario:      { nombre:"Usuario",         svg:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  equipo:       { nombre:"Equipo",          svg:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  buscar:       { nombre:"Buscar",          svg:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  enlace:       { nombre:"Enlace",          svg:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
  compartir:    { nombre:"Compartir",       svg:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' },
  descargar:    { nombre:"Descargar",       svg:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  corazon:      { nombre:"Corazón",         svg:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  estrella:     { nombre:"Estrella",        svg:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  check:        { nombre:"Check",           svg:'<polyline points="20 6 9 17 4 12"/>' },
  equis:        { nombre:"Cerrar",          svg:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  mas:          { nombre:"Más (+)",         svg:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
  flechader:    { nombre:"Flecha derecha",  svg:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
  flechaabajo:  { nombre:"Flecha abajo",    svg:'<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>' },
  externo:      { nombre:"Abrir externo",   svg:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' },
  info:         { nombre:"Info",            svg:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
  alerta:       { nombre:"Alerta",          svg:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  ojo:          { nombre:"Ojo",             svg:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
  candado:      { nombre:"Candado",         svg:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  ajustes:      { nombre:"Ajustes",         svg:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  documento:    { nombre:"Documento",       svg:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  imagen:       { nombre:"Imagen",          svg:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  adjunto:      { nombre:"Adjunto",         svg:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>' },
  carrito:      { nombre:"Carrito",         svg:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
  regalo:       { nombre:"Regalo",          svg:'<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
  instagram:    { nombre:"Instagram",       svg:'<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>' },
  facebook:     { nombre:"Facebook",        svg:'<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>' },
  linkedin:     { nombre:"LinkedIn",        svg:'<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>' },
  twitter:      { nombre:"X / Twitter",     svg:'<path d="M18 6 6 18M6 6l12 12"/>' },
  youtube:      { nombre:"YouTube",         svg:'<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>' },
  tiktok:       { nombre:"TikTok",          svg:'<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>' },
  spotify:      { nombre:"Spotify",         svg:'<circle cx="12" cy="12" r="10"/><path d="M7 14.5c3-1 7-1 10 1M7 11c4-1 9-1 13 1.5M8 8c4-1 10-1 14 2"/>' },
  // Íconos de estructura/contenido (para bloques) y de interfaz (UI).
  heading:      { nombre:"Título",          svg:'<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>' },
  textoico:     { nombre:"Texto",           svg:'<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>' },
  cursor:       { nombre:"Botón",           svg:'<path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.5.5 0 0 0-.651.651l6.5 16a.5.5 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>' },
  columnas:     { nombre:"Dos columnas",    svg:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>' },
  divisor:      { nombre:"Divisor",         svg:'<path d="M5 12h14"/>' },
  espaciador:   { nombre:"Espaciador",      svg:'<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>' },
  climaico:     { nombre:"Clima",           svg:'<path d="M12 2v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="M2 13h2"/><path d="M20 13h2"/><path d="m17.7 6.3 1.4-1.4"/><path d="M16 13a4 4 0 1 0-8 0"/><path d="M3 20a5 5 0 0 1 9-3 4 4 0 0 1 5 3"/>' },
  timer:        { nombre:"Temporizador",    svg:'<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="12" y1="14" y2="9"/><circle cx="12" cy="14" r="8"/>' },
  formularioico:{ nombre:"Formulario",      svg:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>' },
  codigoico:    { nombre:"Código",          svg:'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
  tablaico:     { nombre:"Tabla",           svg:'<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>' },
  grid:         { nombre:"Grilla",          svg:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>' },
  barchart:     { nombre:"Barras",          svg:'<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>' },
  ring:         { nombre:"Anillo",          svg:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>' },
  trending:     { nombre:"Tendencia",       svg:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>' },
  tag:          { nombre:"Etiqueta",        svg:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>' },
  checklist:    { nombre:"Lista",           svg:'<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>' },
  audioico:     { nombre:"Audio",           svg:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  footerico:    { nombre:"Footer",          svg:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/>' },
  plantilla:    { nombre:"Plantilla",       svg:'<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/>' },
  subir:        { nombre:"Subir",           svg:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>' },
  biblioteca:   { nombre:"Biblioteca",      svg:'<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>' },
  exportar:     { nombre:"Exportar",        svg:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>' },
  paleta:       { nombre:"Tema",            svg:'<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' },
  basura:       { nombre:"Eliminar",        svg:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>' },
  nube:         { nombre:"Nube",            svg:'<path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9"/>' },
  editar:       { nombre:"Editar",          svg:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>' },
  monitor:      { nombre:"Escritorio",      svg:'<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>' },
  movilico:     { nombre:"Móvil",           svg:'<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>' },
  copiar:       { nombre:"Duplicar",        svg:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>' },
  salir:        { nombre:"Salir",           svg:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>' },
  chevup:       { nombre:"Arriba",          svg:'<path d="m18 15-6-6-6 6"/>' },
  chevdown:     { nombre:"Abajo",           svg:'<path d="m6 9 6 6 6-6"/>' },
  chevleft:     { nombre:"Izquierda",       svg:'<path d="m15 18-6-6 6-6"/>' },
  deshacer:     { nombre:"Deshacer",        svg:'<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>' },
  rehacer:      { nombre:"Rehacer",         svg:'<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h1"/>' },
  chevright:    { nombre:"Derecha",         svg:'<path d="m9 18 6-6-6-6"/>' },
  tablet:       { nombre:"Tablet",          svg:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 18h.01"/>' },
  sol:          { nombre:"Sol",             svg:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>' },
  lluvia:       { nombre:"Lluvia",          svg:'<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>' },
  nieve:        { nombre:"Nieve",           svg:'<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>' },
  tormenta:     { nombre:"Tormenta",        svg:'<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="m13 12-3 5h4l-3 5"/>' },
  video:        { nombre:"Video",           svg:'<polygon points="6 3 20 12 6 21 6 3"/>' }
};
// Rellena los placeholders <span class="ico" data-ic="clave"> con su SVG.
function pintarIconos(){
  document.querySelectorAll("[data-ic]").forEach(e => {
    e.innerHTML = svgIcon(e.dataset.ic, { size: e.dataset.icsize || "16px" });
  });
}
function svgIcon(key, opts={}){
  const ic = ICONOS_SVG[key] || ICONOS_SVG.estrella;
  const sw = opts.grosor || 2;
  const size = opts.size || "1em";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}">${ic.svg}</svg>`;
}

/* DATE HELPERS */
const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
function formatearFecha(iso, formato){
  if(!iso) return "";
  const d = new Date(iso + (iso.length===10?"T00:00":""));
  if(isNaN(d.getTime())) return iso;
  const dia = d.getDate();
  const mes = MESES_ES[d.getMonth()];
  const mesCorto = mes.slice(0,3);
  const anio = d.getFullYear();
  const dow = DIAS_ES[d.getDay()];
  const dowCap = dow.charAt(0).toUpperCase() + dow.slice(1);
  switch(formato){
    case "completo": return `${dowCap}, ${dia} de ${mes} de ${anio}`;
    case "largo": return `${dowCap}, ${dia} de ${mes}`;
    case "corto": return `${dia} ${mesCorto} ${anio}`;
    case "numerico": return `${String(dia).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${anio}`;
    case "soloDia": return String(dia);
    case "soloMes": return mesCorto.toUpperCase();
    default: return `${dowCap}, ${dia} de ${mes}`;
  }
}

function styleFields(opts={}){
  const f = [];
  f.push({grupo:"Identificador"});
  f.push({key:"compId", label:"Nombre / id del componente (para reconocerlo)", tipo:"text", placeholder:"ej. hero-principal"});
  if(opts.h !== false || opts.v !== false){
    f.push({grupo:"Posición y tamaño"});
    f.push({tipo:"row2", izq:{key:"alinH", label:"Alineación H", tipo:"alignH"}, der:{key:"alinV", label:"Alineación V", tipo:"alignV"}});
  }
  // Ancho del bloque: % o px (vacío/100% = todo el ancho). Combínalo con la alineación H.
  f.push({key:"ancho", label:"Ancho del bloque (ej. 100%, 60%, 480px)", tipo:"text", placeholder:"auto / 100% / 60% / 480px"});
  f.push({grupo:"Espaciado interior (padding)"});
  f.push({tipo:"row2", izq:{key:"padTop", label:"Arriba", tipo:"range", min:0, max:120, step:2}, der:{key:"padBottom", label:"Abajo", tipo:"range", min:0, max:120, step:2}});
  f.push({tipo:"row2", izq:{key:"padLeft", label:"Izquierda", tipo:"range", min:0, max:120, step:2}, der:{key:"padRight", label:"Derecha", tipo:"range", min:0, max:120, step:2}});
  f.push({grupo:"Fondo y bordes"});
  f.push({key:"bgBloque", label:"Fondo del bloque", tipo:"colorOpt"});
  f.push({key:"radioBloque", label:"Radio del bloque (px · vacío = natural, 0 = cuadrado)", tipo:"text", placeholder:"vacío / 0 / 16…"});
  return f;
}
const styleDefaults = { alinH:"center", alinV:"center", ancho:"", alto:"", padTop:"14", padRight:"24", padBottom:"14", padLeft:"24", radioBloque:"", bgBloque:"" };

// Contexto de render del tema en curso (espacio entre bloques y radio por defecto).
// Inline (no variables CSS) para que funcione igual en el editor y en el email exportado.
let _renderGap = 0, _renderRadio = "";
function temaRenderCtx(t){ _renderGap = parseInt(t && t.gap)||0; _renderRadio = (t && t.radio!=null) ? String(t.radio) : ""; }
function wrap(d, inner){
  const w = d.ancho ? `width:${esc(d.ancho)};` : "width:100%;";
  const h = d.alto ? `min-height:${esc(d.alto)};` : "";
  const pad = `padding:${paddings(d)};`;
  const gap = _renderGap>0 ? `margin-bottom:${_renderGap}px;` : "";
  const jH = justifyH(d.alinH);
  const jV = justifyV(d.alinV);
  // Radio: el del bloque manda; si está vacío, hereda el radio global del tema.
  const rbVal = (d.radioBloque!==undefined && d.radioBloque!=="" && /^\d+$/.test(String(d.radioBloque))) ? String(d.radioBloque)
              : ((_renderRadio!=="" && /^\d+$/.test(_renderRadio)) ? _renderRadio : "");
  const rb = (rbVal!=="" && parseInt(rbVal)>0) ? `border-radius:${rbVal}px;overflow:hidden;` : "";
  // Fondo propio del bloque (vacío = sin fondo, se ve el de la página).
  const bg = (d.bgBloque && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(d.bgBloque).trim())) ? `background:${esc(String(d.bgBloque).trim())};` : "";
  // Identificador del componente: id + data-id en el HTML (para reconocerlo en consola/export).
  const cid = (d.compId||"").trim();
  const idAttr = cid ? ` id="${escAttr(cid)}" data-comp="${escAttr(cid)}"` : "";
  // Visibilidad por dispositivo: la clase viaja al export (media query) y el
  // editor la atenúa según la vista activa.
  const verCls = d.verEn==="desktop" ? " sbb-ver-desktop" : d.verEn==="movil" ? " sbb-ver-movil" : "";
  return `<div${idAttr} class="sbb-blk${verCls}" style="${pad}${gap}${bg}${rb}display:flex;flex-direction:column;justify-content:${jV};align-items:${jH};box-sizing:border-box;width:100%;height:100%;">
    <div style="${w}${h}max-width:100%;box-sizing:border-box;">${inner}</div>
  </div>`;
}
// Imagen recortada a proporción (apaisada, cuadrada, vertical…), reutilizable por
// los bloques con foto. opts: {url, alt, ancho(%), aspecto("16/9"…), zoom, foco, radio(px), alto, editKey}
function imgProporcion(o){
  const foco = o.foco || "center";
  const zoom = Math.max(100, Math.min(400, parseFloat(o.zoom)||100))/100;
  const radio = `border-radius:${esc(o.radio||0)}px;`;
  const ratio = (o.aspecto && /^\d+\/\d+$/.test(o.aspecto)) ? o.aspecto : "";
  const ancho = (o.ancho!=null && o.ancho!=="") ? o.ancho : "100";
  const edit = o.editKey ? ` data-edit-img="${esc(o.editKey)}" title="Clic para cambiar la imagen"` : "";
  const imgIn = `<img src="${esc(o.url)}" alt="${esc(o.alt||"")}"${edit} style="width:100%;height:100%;object-fit:cover;object-position:${esc(foco)};transform:scale(${zoom});transform-origin:${esc(foco)};display:block;">`;
  if(ratio)
    return `<div style="width:${esc(ancho)}%;aspect-ratio:${ratio};overflow:hidden;${radio}display:inline-block;line-height:0;vertical-align:top;max-width:100%;">${imgIn}</div>`;
  if(o.alto && o.alto!=="auto")
    return `<div style="width:${esc(ancho)}%;height:${esc(o.alto)};overflow:hidden;${radio}display:inline-block;line-height:0;vertical-align:top;max-width:100%;">${imgIn}</div>`;
  return `<img src="${esc(o.url)}" alt="${esc(o.alt||"")}"${edit} style="width:${esc(ancho)}%;${radio}display:inline-block;">`;
}
// Campos de proporción reutilizables (proporción + foco + zoom) para bloques con foto.
function camposProporcion(keys){
  const k = Object.assign({aspecto:"aspectoImg", foco:"focoImg", zoom:"zoomImg"}, keys||{});
  return [
    {key:k.aspecto,label:"Forma / proporción de la foto",tipo:"select",opciones:[["","Original (sin recorte)"],["16/9","Apaisado 16:9"],["3/2","Foto 3:2"],["4/3","Clásico 4:3"],["1/1","Cuadrado 1:1"],["4/5","Vertical 4:5"],["9/16","Alto (story) 9:16"]]},
    {tipo:"row2", izq:{key:k.zoom,label:"Acercar / Zoom (%)",tipo:"range",min:100,max:300,step:5}, der:{key:k.foco,label:"Qué parte se ve (foco)",tipo:"select",opciones:[["center","Centro"],["top","Arriba"],["bottom","Abajo"],["left","Izquierda"],["right","Derecha"],["top left","Arriba-izq"],["top right","Arriba-der"],["bottom left","Abajo-izq"],["bottom right","Abajo-der"]]}}
  ];
}
