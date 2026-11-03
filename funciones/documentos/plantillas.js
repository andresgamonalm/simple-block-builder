/* ══════════════════════════════════════════════════════════════════
   DOCUMENTOS · PLANTILLAS  ·  funciones/documentos/plantillas.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Plantillas de documentos (email) y su carga.
   QUIÉN LO USA: Piezas de email/libre.
   SECCIONES (en orden):
     1. Plantillas editables (registro)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Plantillas editables (registro) ─────────────────────────────────────
// Cada plantilla define un formato + una lista de bloques [tipo, overrides].
// Los bloques son totalmente editables tras cargarse. Agregar plantilla =
// añadir una entrada. 'grupo' las agrupa en el menú.
const PLANTILLAS = {
  // ── EMAIL · plantillas pro (secciones full-bleed + marca Gamonal: navy #040764, azul #1c73cb, amarillo #fce865) ──
  "email-promo": { label:"Comercial \u00b7 Inversi\u00f3n", grupo:"Email", formato:"email", nombre:"Comercial",
    bloques:[
      ["bandaHeader",{estilo:"solido",bg:"#1C73CB",alto:"28"}],
      ["imagen",{url:"",anchoImg:"100",radio:"0",padTop:"0",padBottom:"0",padLeft:"0",padRight:"0"}],
      ["seccion",{bg:"#ffffff",colorTexto:"#040764",alinH:"center",eyebrow:"",titulo:"\u00a1Haz que tu dinero trabaje por ti!",fuenteTitulo:"Arial",tamTitulo:"26",subtitulo:"Empezar es simple, r\u00e1pido y para todos. Da el primer paso hoy.",tamSub:"15",botonTexto:"",padV:"32"}],
      ["features",{titulo:"",disposicion:"fila",porFila:"3",orientacion:"vertical",colorIcono:"#1C73CB",tamItemTitulo:"15",tamItemSub:"13",gapItems:"14",bgBloque:"#eaf3fb",items:[{ico:"barchart",t:"Desde $1.000",s:"Empieza con el monto que t\u00fa quieras."},{ico:"monitor",t:"100% online",s:"Gestiona todo digital, sin papeles."},{ico:"reloj",t:"Cuando quieras",s:"Retira tu dinero en cualquier momento."}]}],
      ["seccion",{bg:"#eaf3fb",colorTexto:"#040764",alinH:"center",eyebrow:"",titulo:"",subtitulo:"",botonTexto:"Comenzar hoy",botonVariante:"solido",botonColor:"#1C73CB",padV:"6"}],
      ["divisor",{}],
      ["seccion",{bg:"#ffffff",colorTexto:"#040764",alinH:"center",eyebrow:"\u00bfTE QUEDAN DUDAS?",colorEyebrow:"#1C73CB",titulo:"Estamos para ayudarte",fuenteTitulo:"Arial",tamTitulo:"22",subtitulo:"Nuestros canales de comunicaci\u00f3n est\u00e1n disponibles para ti.",tamSub:"15",botonTexto:"Cont\u00e1ctanos",botonVariante:"outline",botonColor:"#1C73CB",padV:"32"}],
      ["bandaFooter",{estilo:"solido",bg:"#1C73CB",textoSeguir:"S\u00edguenos"}]
    ] },
  "email-newsletter": { label:"Informativo \u00b7 Documento", grupo:"Email", formato:"email", nombre:"Informativo",
    bloques:[
      ["bandaHeader",{estilo:"solido",bg:"#1C73CB",alto:"28"}],
      ["seccion",{bg:"#1C73CB",colorTexto:"#ffffff",alinH:"left",eyebrow:"",titulo:"\u00a1Ya est\u00e1 disponible tu documento!",fuenteTitulo:"Arial",tamTitulo:"30",subtitulo:"",tamSub:"15",botonTexto:"",padV:"44",padH:"36"}],
      ["seccion",{bg:"#ffffff",colorTexto:"#040764",alinH:"left",eyebrow:"",titulo:"Hola,",fuenteTitulo:"Arial",tamTitulo:"20",subtitulo:"Ya est\u00e1 disponible tu documento con los \u00faltimos movimientos de tu cuenta. Para abrirlo, sigue las instrucciones de aqu\u00ed abajo.",tamSub:"15",botonTexto:"",padV:"26",padH:"36"}],
      ["alert",{tipo:"warning",titulo:"Ejemplo de acceso",mensaje:"RUT: 16.222.432-3\nClave: 16222432 (tu RUT sin puntos ni d\u00edgito verificador)"}],
      ["seccion",{bg:"#ffffff",colorTexto:"#040764",alinH:"center",eyebrow:"",titulo:"\u00bfTienes dudas sobre c\u00f3mo obtener tu documento?",fuenteTitulo:"Arial",tamTitulo:"20",subtitulo:"Nuestros canales de comunicaci\u00f3n est\u00e1n disponibles para ti.",tamSub:"15",botonTexto:"Ir a mi portal",botonVariante:"solido",botonColor:"#1C73CB",padV:"32"}],
      ["bandaFooter",{estilo:"solido",bg:"#1C73CB",textoSeguir:"S\u00edguenos"}]
    ] },
  "email-bienvenida": { label:"Concurso \u00b7 Promoci\u00f3n", grupo:"Email", formato:"email", nombre:"Concurso",
    bloques:[
      ["bandaHeader",{estilo:"solido",bg:"#1C73CB",alto:"28"}],
      ["imagen",{url:"",anchoImg:"100",radio:"0",padTop:"0",padBottom:"0",padLeft:"0",padRight:"0"}],
      ["seccion",{bg:"#ffffff",colorTexto:"#040764",alinH:"center",eyebrow:"",titulo:"Hola,",fuenteTitulo:"Arial",tamTitulo:"22",subtitulo:"Tenemos un concurso especial para ti, pensado para regalarte momentos llenos de alegr\u00eda.",tamSub:"15",botonTexto:"",padV:"28"}],
      ["alert",{tipo:"info",titulo:"Gana 1 de las 15 entradas",mensaje:"Participa y ll\u00e9vate un premio. Sigue los pasos de aqu\u00ed abajo."}],
      ["features",{titulo:"\u00bfC\u00f3mo participar?",disposicion:"fila",porFila:"3",orientacion:"vertical",colorIcono:"#1C73CB",tamTitulo:"20",tamItemTitulo:"14",tamItemSub:"13",gapItems:"14",items:[{ico:"instagram",t:"S\u00edguenos",s:"S\u00edguenos en nuestra cuenta de Instagram."},{ico:"equipo",t:"Etiqueta a 2 amigos",s:"Menci\u00f3nalos en el comentario."},{ico:"corazon",t:"Consigue Me Gusta",s:"Los comentarios con m\u00e1s likes ganan."}]}],
      ["seccion",{bg:"#1C73CB",colorTexto:"#ffffff",alinH:"center",eyebrow:"",titulo:"\u00a1Haz que este mes sea especial!",fuenteTitulo:"Arial",tamTitulo:"26",subtitulo:"Concurso v\u00e1lido por tiempo limitado. Revisa las bases en el sitio.",tamSub:"15",botonTexto:"Quiero participar",botonVariante:"solido",botonColor:"#ffffff",padV:"42"}],
      ["bandaFooter",{estilo:"solido",bg:"#1C73CB",textoSeguir:"S\u00edguenos"}]
    ] },
  // LinkedIn
  "li-portada": { label:"Portada perfil 1584×396", grupo:"LinkedIn", formato:"linkedin", nombre:"LinkedIn Portada",
    bloques:[["header",{}]] },
  "li-post": { label:"Post cuadrado 1200×1200", grupo:"LinkedIn", formato:"linkedin-post", nombre:"LinkedIn Post",
    bloques:[["hero",{}],["cta",{}]] },
  "li-link": { label:"Enlace 1200×627", grupo:"LinkedIn", formato:"linkedin-link", nombre:"LinkedIn Enlace",
    bloques:[["hero",{}],["cta",{}]] },
  // Facebook
  "fb-post": { label:"Post 1200×630", grupo:"Facebook", formato:"fb-post", nombre:"Facebook Post",
    bloques:[["hero",{}],["cta",{}]] },
  "fb-square": { label:"Cuadrado 1080×1080", grupo:"Facebook", formato:"fb-square", nombre:"Facebook Cuadrado",
    bloques:[["hero",{}],["texto",{}],["cta",{}]] },
  "fb-story": { label:"Story 1080×1920", grupo:"Facebook", formato:"fb-story", nombre:"Facebook Story",
    bloques:[["hero",{}],["texto",{}],["cta",{}]] },
  "fb-cover": { label:"Portada 820×312", grupo:"Facebook", formato:"fb-cover", nombre:"Facebook Portada",
    bloques:[["header",{}]] }
};

// Qué grupos de plantillas corresponden a cada categoría de formato. El
// Formato Universal (libre) muestra todas. Así las plantillas SIEMPRE concuerdan
// con el formato elegido arriba (Email→Email, Banner→Display, Post→LinkedIn/Facebook).
const GRUPOS_PLANTILLA_POR_CAT = {
  "Ads":            [],
  "Email":          ["Email"],
  "Banners":        ["Google Display"],
  "Post":           ["LinkedIn", "Facebook"],
  "Formato Libre":  ["Email", "LinkedIn", "Facebook", "Google Display"]
};
function renderPlantillasTab(){
  const cont = document.getElementById("plantillas-cont");
  if(!cont) return;
  const cat = categoriaDe(getFormato());
  const permitidos = GRUPOS_PLANTILLA_POR_CAT[cat] || ["Email","LinkedIn","Facebook","Google Display"];
  const grupos = {};
  Object.entries(PLANTILLAS).forEach(([k,v]) => { (grupos[v.grupo] = grupos[v.grupo] || []).push([k,v]); });
  grupos["Google Display"] = [
    ["display-desktop-set", { label:"Set Desktop (adaptable)", grupo:"Google Display" }],
    ["display-set", { label:"8 banners separados", grupo:"Google Display" }]
  ];
  let html = "";
  Object.entries(grupos).forEach(([g,arr]) => {
    if(!permitidos.includes(g)) return;   // solo plantillas que concuerdan con el formato
    html += `<div class="cat-title">${esc(g)}</div><div class="pl-grid">`;
    arr.forEach(([k,v]) => {
      html += `<div class="pl-tile" onclick="cargarPlantilla('${k}')"><div class="pl-ico">${svgIcon("plantilla",{size:"18px"})}</div><div class="pl-nm">${esc(v.label)}</div></div>`;
    });
    html += `</div>`;
  });
  cont.innerHTML = html || `<div style="padding:18px 14px;color:var(--ink3);font-size:12.5px;line-height:1.6;">Estamos <b>preparando nuevas plantillas</b> de email.<br>Mientras, arma tu pieza con los <b>Bloques</b> de la izquierda o genérala con <b>Char-B (IA)</b>.</div>`;
}

function cargarPlantilla(tipo){
  // Si la pieza actual está vacía, la reutilizamos; si tiene contenido, creamos
  // una pieza nueva (no destructivo).
  function getOrCreate(formato, nombre){
    const actual = pieza();
    if(actual && piezaVacia(actual)){ actual.formato = formato; actual.nombre = nombre; return actual; }
    return crearPieza(formato, nombre);
  }
  // Set Display Desktop ADAPTABLE: una sola creatividad-máster (300×250) cuyo
  // contenido se adapta a todos los tamaños. Editas el máster y los ves todos.
  if(tipo === "display-desktop-set"){
    crearSetDesktop();   // tablero de banners en el lienzo, cada uno editable
    return;
  }
  // Kit de Google Display: varias piezas, una por tamaño IAB.
  if(tipo === "display-set"){
    const sizes = [["display-300x250","Display 300×250"],["display-336x280","Display 336×280"],["display-728x90","Display 728×90"],["display-970x250","Display 970×250"],["display-300x600","Display 300×600"],["display-160x600","Display 160×600"],["display-320x50","Display 320×50"],["display-320x100","Display 320×100"]];
    sizes.forEach(([fmt,nombre]) => {
      const p = crearPieza(fmt, nombre);
      p.canvas = [mk("header",{padTop:"10",padBottom:"4",titulo:"Tu título",bajada:"",tamanoTitulo:"16"}), mk("cta",{padTop:"4",padBottom:"10",texto:"Saber más"})];
    });
    proyecto.activa = proyecto.piezas[proyecto.piezas.length - sizes.length].id;
    activarPieza(proyecto.activa);
    toast(sizes.length + " piezas Display creadas — usa las pestañas arriba");
    return;
  }
  // Plantillas de pieza única (data-driven).
  const def = PLANTILLAS[tipo];
  if(!def){ toast("Plantilla no encontrada"); return; }
  const p = getOrCreate(def.formato, def.nombre);
  p.canvas = def.bloques.filter(([t]) => BLOQUES[t]).map(([t,ov]) => {
    const item = mk(t, ov);
    // Normaliza celdas de grid: cada celda = bloque completo (defaults + datos de la plantilla).
    if(t==="grid" && Array.isArray(item.datos.celdas)){
      item.datos.celdas = item.datos.celdas.map(c =>
        (c && c.tipo && BLOQUES[c.tipo]) ? { tipo:c.tipo, datos:Object.assign(clone(BLOQUES[c.tipo].defaults), c.datos||{}) } : (c||{}));
    }
    return item;
  });
  proyecto.activa = p.id;
  activarPieza(p.id);
  toast("Plantilla cargada: " + def.label);
}
