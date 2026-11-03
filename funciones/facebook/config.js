/* ══════════════════════════════════════════════════════════════════
   FACEBOOK ADS  ·  funciones/facebook/config.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Los 3 tamaños de Facebook (máster 1080×1350), cómo se reconoce un tamaño de Facebook y los textos del anuncio que van FUERA de la imagen (con su contador).
   QUIÉN LO USA: Facebook usa el motor compartido de comun/banners.
   SECCIONES (en orden):
     1. FACEBOOK: LOS TEXTOS DEL ANUNCIO VAN FUERA DE LA IMAGEN
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Facebook: máster propio y solo tres piezas (las que cubren todos los sitios).
const SET_FACEBOOK = ["fb-1080x1350","fb-1080x1080","fb-1200x628"];
const esFacebookFmt = fmt => /^fb-/.test(fmt||"");
// ═══ FACEBOOK: LOS TEXTOS DEL ANUNCIO VAN FUERA DE LA IMAGEN ══════════════
// Es la diferencia fundamental con Display. En Display el título vive DENTRO del
// banner; en Facebook el título y el texto son campos del anuncio. Meta no
// rechaza el texto largo: lo CORTA sin avisar. Por eso se valida contra el
// límite VISIBLE, no contra el máximo, y se avisa en cuanto se pasa.
const FB_TEXTOS = [
  { clave:"principal",   label:"Texto principal", visible:125, max:500,
    nota:"Lo que pase de 125 se oculta tras «Ver más»." },
  { clave:"titular",     label:"Titular del anuncio", visible:40, max:255,
    nota:"En móviles pequeños se corta en 27." },
  { clave:"descripcion", label:"Descripción", visible:30, max:90,
    nota:"Opcional: en móvil se oculta casi siempre." }
];
const esColeccionFacebook = p => !!(p && p.esSet && p.setTipo === "facebook");
function fbTextos(p){ p = p || pieza(); if(!p) return {}; p.fbTextos = p.fbTextos || {}; return p.fbTextos; }
function setFbTexto(clave, valor){
  const p = pieza(); if(!p) return;
  fbTextos(p)[clave] = valor;
  persistir();
  const c = FB_TEXTOS.find(x => x.clave === clave);
  const cont = document.querySelector(`[data-fbcount="${clave}"]`);
  if(cont && c) cont.outerHTML = fbContadorHTML(c, valor);
}
function fbContadorHTML(c, valor){
  const n = String(valor||"").length;
  const estado = n > c.max ? "mal" : (n > c.visible ? "aviso" : "ok");
  const msg = n > c.max ? `pasa del máximo de ${c.max}`
            : n > c.visible ? `Meta cortará a partir de ${c.visible}`
            : `${c.visible - n} disponibles antes del corte`;
  return `<span class="fb-count ${estado}" data-fbcount="${c.clave}">${n}/${c.visible} · ${esc(msg)}</span>`;
}
// Panel de los textos del anuncio, dentro del editor de la colección de Facebook.
function panelFacebookHTML(){
  const p = pieza(); if(!esColeccionFacebook(p)) return "";
  const T = fbTextos(p);
  return `<div class="fb-panel">
    <div class="cmp-parte">Textos del anuncio <small>van FUERA de la imagen · los escribe Meta alrededor de tu gráfica</small></div>
    ${FB_TEXTOS.map(c => `<div class="fb-campo">
      <label>${esc(c.label)} <small>${esc(c.nota)}</small></label>
      ${c.clave==="principal"
        ? `<textarea rows="3" oninput="setFbTexto('${c.clave}', this.value)" placeholder="Qué gana el lector, en la primera frase">${esc(T[c.clave]||"")}</textarea>`
        : `<input type="text" value="${escAttr(T[c.clave]||"")}" oninput="setFbTexto('${c.clave}', this.value)" placeholder="${c.clave==='titular'?'Beneficio corto y directo':'Opcional'}">`}
      ${fbContadorHTML(c, T[c.clave]||"")}
    </div>`).join("")}
    <div class="fb-nota">${svgIcon("info",{size:"12px"})} Por la regla del 20 % de texto en la imagen, en Facebook conviene la foto con círculo de oferta antes que una pieza muy tipográfica: Meta reparte menos las imágenes cargadas de texto.</div>
  </div>`;
}
