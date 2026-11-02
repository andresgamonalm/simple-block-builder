/* ══════════════════════════════════════════════════════════════════
   BIBLIOTECA DE FOTOS  ·  funciones/comun/imagenes.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Subida a R2, lista, optimización y elección de fotos (también qué foto sirve de fondo).
   QUIÉN LO USA: Compartido.
   SECCIONES (en orden):
     1. Biblioteca de imágenes (solo URLs + previsualización; sin subir archivos)
     2. DOS TRABAJOS DISTINTOS, DOS ORÍGENES DISTINTOS
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Biblioteca de imágenes (solo URLs + previsualización; sin subir archivos) ──
let _imgPickCb = null;   // si se abre en "modo elegir", callback(url) al elegir
function abrirImagenes(pick){
  _imgPickCb = (typeof pick === "function") ? pick : null;
  const intro = document.getElementById("img-intro");
  if(intro) intro.style.display = _imgPickCb ? "none" : "";
  const url = document.getElementById("img-url"); if(url) url.value = "";
  const nom = document.getElementById("img-nombre"); if(nom) nom.value = "";
  previsualizarImagen();
  // Desde el dashboard (sin picker) es una página; como selector o desde el editor, un modal.
  if(!_imgPickCb && document.getElementById("galeria").classList.contains("show")){ dashVista("imagenes"); return; }
  montarImagenesEn("modal");
  renderImagenes();
  cargarR2();   // trae también lo que subiste directo al bucket de Cloudflare
  document.getElementById("modal-imagenes").classList.add("show");
}
function previsualizarImagen(){
  const v = (document.getElementById("img-url")?.value || "").trim();
  const box = document.getElementById("img-prev");
  const el = document.getElementById("img-prev-el");
  if(!box || !el) return;
  if(v){ el.src = v; box.style.display = ""; } else { box.style.display = "none"; el.removeAttribute("src"); }
}
function agregarImagen(){
  const url = (document.getElementById("img-url").value || "").trim();
  const nombre = (document.getElementById("img-nombre").value || "").trim();
  if(!url){ toast("Pega la URL de una imagen"); return; }
  workspace.imagenes = workspace.imagenes || [];
  workspace.imagenes.push({ id:"img"+Math.random().toString(36).slice(2,9), url, nombre, creado:Date.now() });
  persistir();
  document.getElementById("img-url").value = ""; document.getElementById("img-nombre").value = "";
  previsualizarImagen(); renderImagenes();
  toast("Imagen agregada a la biblioteca");
}
// Subir archivos a R2 vía /api/upload. Cada uno queda en la biblioteca con su URL.
// Limpia SOLO la lista guardada en tu biblioteca (workspace.imagenes). No borra
// los archivos del bucket de Cloudflare: esos siguen listándose desde R2.
function vaciarBiblioteca(){
  const n = (workspace.imagenes||[]).length;
  if(!n){ toast("La biblioteca ya está vacía"); return; }
  if(!confirm(`¿Quitar las ${n} imágenes de tu biblioteca guardada?\n\nSolo limpia la lista; los archivos que tengas en tu bucket de Cloudflare NO se borran y seguirán apareciendo abajo.`)) return;
  workspace.imagenes = [];
  persistir(); renderImagenes();
  toast("Biblioteca vaciada");
}
function soltarImagenes(e){ e.preventDefault(); const z=document.getElementById("img-subir"); if(z) z.classList.remove("drag"); subirImagenes(e.dataTransfer && e.dataTransfer.files); }
// Optimiza una imagen pesada antes de subirla: la reduce a máx 1600px de lado y
// la recomprime (JPG calidad 0.85; PNG se conserva por la transparencia). SVG/GIF
// no se tocan (vector/animación). Si no logra reducir, deja el original.
function optimizarImagen(file){
  return new Promise((resolve)=>{
    if(/svg|gif/i.test(file.type)) return resolve({ blob:file, type:file.type, optimizada:false });
    const reader=new FileReader();
    reader.onerror=()=>resolve({ blob:file, type:file.type, optimizada:false });
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>resolve({ blob:file, type:file.type, optimizada:false });
      img.onload=()=>{
        try{
          const MAX=1600; let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
          const escala = (w>MAX||h>MAX) ? Math.min(MAX/w, MAX/h) : 1;
          const nw=Math.max(1,Math.round(w*escala)), nh=Math.max(1,Math.round(h*escala));
          const esPng=/png/i.test(file.type);
          const cv=document.createElement("canvas"); cv.width=nw; cv.height=nh;
          const ctx=cv.getContext("2d");
          if(!esPng){ ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,nw,nh); }   // fondo blanco al pasar a JPG
          ctx.drawImage(img,0,0,nw,nh);
          const tipoSalida = esPng ? "image/png" : "image/jpeg";
          cv.toBlob((blob)=>{
            if(!blob) return resolve({ blob:file, type:file.type, optimizada:false });
            if(blob.size>=file.size && escala===1) return resolve({ blob:file, type:file.type, optimizada:false });
            resolve({ blob, type:tipoSalida, optimizada:true });
          }, tipoSalida, esPng?undefined:0.85);
        }catch(e){ resolve({ blob:file, type:file.type, optimizada:false }); }
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// Miniatura base64 (≤256px, JPG 0.6) para que la IA "vea" la imagen al elegirla.
// Devuelve solo el base64 (sin prefijo) o null si no se puede (p. ej. URL externa sin CORS).
function miniaturaIA(url, max){
  max = max || 256;
  return new Promise((resolve)=>{
    if(!url){ return resolve(null); }
    const img=new Image(); img.crossOrigin="anonymous";
    img.onerror=()=>resolve(null);
    img.onload=()=>{ try{
      let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
      const e=(w>max||h>max)?Math.min(max/w,max/h):1;
      const nw=Math.max(1,Math.round(w*e)), nh=Math.max(1,Math.round(h*e));
      const cv=document.createElement("canvas"); cv.width=nw; cv.height=nh;
      const ctx=cv.getContext("2d"); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,nw,nh); ctx.drawImage(img,0,0,nw,nh);
      const d=cv.toDataURL("image/jpeg",0.6);
      resolve((d.split(",")[1])||null);
    }catch(_){ resolve(null); } };
    img.src=url;
  });
}
// Mide el tamaño real (px) de una imagen; null si no se puede (timeout/error).
function dimsImagen(url){
  return new Promise((res)=>{
    if(!url) return res(null);
    const img=new Image(); let listo=false;
    const fin=(v)=>{ if(!listo){ listo=true; res(v); } };
    const t=setTimeout(()=>fin(null), 4000);
    img.onload=()=>{ clearTimeout(t); fin({ w:img.naturalWidth||img.width, h:img.naturalHeight||img.height }); };
    img.onerror=()=>{ clearTimeout(t); fin(null); };
    img.src=url;
  });
}
// ¿La imagen es un logo o ícono? (no debe usarse como foto de contenido/banner).
function esLogoOIcono(img){
  const t = ((img && img.nombre || "") + " " + decodeURIComponent(img && img.url || "")).toLowerCase();
  if(/\.svg(\?|$|")/.test(t)) return true;                                   // vector → ícono/logo
  return /(^|[\s\-_\/])(logos?|iconos?|icon|favicon|isotipo|imagotipo)([\s\-_\/.]|$)/.test(t)
      || /(^|[\s\-_\/])ic[-_]/.test(t);
}
// ── DOS TRABAJOS DISTINTOS, DOS ORÍGENES DISTINTOS ──────────────────────
// Una foto de FONDO y un LOGOTIPO no tienen nada que ver. Confundirlos es lo que
// produce banners con la marca gigante y deformada de fondo y el titular encima.
// La exclusión se decide por el PREFIJO DE LA CARPETA, no adivinando por el
// nombre del archivo — que es como se colaba antes. Si la carpeta es desconocida
// (claves antiguas), se cae al nombre como red de seguridad.
const CARPETAS_FONDO   = ["fotos-generales/","fotos-seguros/","subidas/","ia/","fotos/"];
const CARPETAS_NO_FONDO = ["logos/","iconos/","brand/"];
function prefijoDeImagen(img){
  const bruto = String((img && (img.key || img.url)) || "");
  const m = /[?&]k=([^&]+)/.exec(bruto);                       // /api/upload?k=<clave>
  const clave = m ? decodeURIComponent(m[1]) : bruto.replace(/^https?:\/\/[^/]+\//, "").replace(/^\//, "");
  const partes = clave.split("/");
  return partes.length > 1 ? partes[0].toLowerCase() + "/" : "";
}
function sirveComoFondo(img){
  const pre = prefijoDeImagen(img);
  if(CARPETAS_NO_FONDO.includes(pre)) return false;   // logos/ jamás es fondo
  if(CARPETAS_FONDO.includes(pre)) return true;       // carpeta de fotos: sí
  return !esLogoOIcono(img);                          // carpeta desconocida
}
async function subirImagenes(files){
  const lista = [...(files||[])].filter(f => /^image\//.test(f.type));
  if(!lista.length){ toast("Elige imágenes (PNG, JPG, WEBP…)"); return; }
  let ok=0;
  for(const f of lista){
    if(f.size > 25*1024*1024){ toast(`"${f.name}" pesa demasiado (>25 MB), omitida`, 3500); continue; }
    toast(`Optimizando y subiendo ${f.name}…`, 8000);
    try{
      const opt = await optimizarImagen(f);
      if(opt.blob.size > 8*1024*1024){ toast(`"${f.name}" sigue >8 MB tras optimizar, omitida`, 4000); continue; }
      const r = await fetch("/api/upload", { method:"POST", credentials:"include", headers:{ "Content-Type":opt.type, "X-Filename":encodeURIComponent(f.name) }, body:opt.blob });
      const raw = await r.text(); let d={}; try{ d=JSON.parse(raw); }catch(_){}
      if(!r.ok || !d.ok){ toast(d.error || ("Error al subir "+f.name), 5000); continue; }
      workspace.imagenes = workspace.imagenes || [];
      workspace.imagenes.push({ id:"img"+Math.random().toString(36).slice(2,9), url:d.url, nombre:f.name.replace(/\.[a-z0-9]+$/i,""), creado:Date.now(), enR2:true });
      ok++;
    }catch(e){ toast("Sin conexión al subir "+f.name, 4000); }
  }
  if(ok){ persistir(); renderImagenes(); toast(`${ok} imagen${ok!==1?"es":""} subida${ok!==1?"s":""} a tu nube (optimizadas)`); }
  const inp=document.getElementById("img-file"); if(inp) inp.value="";
}
function eliminarImagen(id){
  if(!confirm("¿Quitar esta imagen de la biblioteca?")) return;
  workspace.imagenes = (workspace.imagenes||[]).filter(x => x.id !== id);
  persistir(); renderImagenes();
}
function usarImagen(id){
  const im = (workspace.imagenes||[]).find(x => x.id === id); if(!im) return;
  if(_imgPickCb){ _imgPickCb(im.url); cerrarModal("imagenes"); _imgPickCb = null; return; }
  // Sin modo elegir: copia la URL al portapapeles.
  if(navigator.clipboard){ navigator.clipboard.writeText(im.url).then(()=>toast("URL copiada")); }
  else toast(im.url);
}
// Abre la biblioteca en modo "elegir" y mete la URL en el campo del bloque actual
// (sirve también dentro de una columna del grid, vía bloqueCtx).
function elegirImagenPara(key){
  abrirImagenes((url) => {
    const b = bloqueCtx(); if(!b) return;
    b.datos[key] = url; persistir(); renderBloqueSeleccionado(); renderForm();
  });
}
let _r2Objetos = [];
function tarjetaImagenHTML(url, nombre, accHTML){
  return `<div class="img-card">
    <div class="img-thumb"><img src="${escAttr(url)}" alt="" loading="lazy" onerror="this.classList.add('roto')"></div>
    <div class="img-meta" title="${escAttr(nombre||url)}">${esc(nombre || "(sin nombre)")}</div>
    <div class="img-acc">${accHTML}</div></div>`;
}
function renderImagenes(){
  const cont = document.getElementById("img-grid");
  if(!cont) return;
  const ims = workspace.imagenes || [];
  let html = ims.slice().reverse().map(im => tarjetaImagenHTML(im.url, im.nombre,
    `<button class="primary" onclick="usarImagen('${im.id}')">${_imgPickCb ? "Usar" : "Copiar URL"}</button>`+
    `<button onclick="eliminarImagen('${im.id}')" title="Quitar">${svgIcon("basura",{size:"13px"})}</button>`)).join("");
  // Archivos que subiste directo a Cloudflare (R2) y que aún no están en la biblioteca.
  const yaUrls = new Set(ims.map(i => decodeURIComponent(i.url||"")));
  const r2 = (_r2Objetos||[]).filter(o => !yaUrls.has(decodeURIComponent(o.url||"")));
  if(r2.length){
    html += `<div style="grid-column:1/-1;font-size:12px;font-weight:600;color:var(--ink2);margin:8px 0 -2px;border-top:1px solid var(--bdr);padding-top:10px;">Tus archivos en Cloudflare (R2) · ${r2.length}</div>`;
    html += r2.map(o => {
      const nombre = String(o.key||"").split("/").pop().replace(/\.[a-z0-9]+$/i,"");
      return tarjetaImagenHTML(o.url, nombre,
        `<button class="primary" onclick="usarImagenUrl('${escAttr(o.url)}')">${_imgPickCb ? "Usar" : "Copiar URL"}</button>`+
        `<button onclick="guardarR2EnBiblioteca('${escAttr(o.url)}','${escAttr(nombre)}')" title="Guardar en la biblioteca">${svgIcon("mas",{size:"13px"})}</button>`);
    }).join("");
  }
  if(!html){ cont.innerHTML = `<div class="img-vacia">Aún no hay imágenes. Sube archivos con el botón de arriba o pega una URL.</div>`; return; }
  cont.innerHTML = html;
}
// Lista los archivos del bucket R2 (los que subiste por el dashboard de Cloudflare) y los muestra.
async function cargarR2(){
  try{
    const r = await fetch("/api/upload?list=1", { credentials:"include" });
    if(!r.ok) return;
    const d = await r.json();
    if(d && d.ok && Array.isArray(d.objects)){ _r2Objetos = d.objects; renderImagenes(); }
  }catch(e){}
}
function usarImagenUrl(url){
  if(_imgPickCb){ _imgPickCb(url); cerrarModal("imagenes"); _imgPickCb = null; return; }
  if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>toast("URL copiada")); } else toast(url);
}
function guardarR2EnBiblioteca(url, nombre){
  workspace.imagenes = workspace.imagenes || [];
  if((workspace.imagenes).some(i => decodeURIComponent(i.url||"")===decodeURIComponent(url))){ toast("Ya está en la biblioteca"); return; }
  workspace.imagenes.push({ id:"img"+Math.random().toString(36).slice(2,9), url, nombre:nombre||"", creado:Date.now(), enR2:true });
  persistir(); renderImagenes();
  toast("Guardada en tu biblioteca");
}
