/* ══════════════════════════════════════════════════════════════════
   BANNERS · EXPORTAR  ·  funciones/comun/banners/exportar.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: ZIP, HTML5, PNG/JPG de cada tamaño, selección de tamaños a exportar y la hoja de contactos de la vista previa.
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. Empaquetado ZIP (puro JS, método "store", sin dependencias)
     2. Export a imagen (PNG/JPG) — para subir a Google Ads, redes, etc.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Empaquetado ZIP (puro JS, método "store", sin dependencias) ──────────
function _crc32(bytes){ let crc=0xFFFFFFFF; for(let i=0;i<bytes.length;i++){ crc^=bytes[i]; for(let j=0;j<8;j++){ crc=(crc>>>1)^(0xEDB88320&-(crc&1)); } } return (crc^0xFFFFFFFF)>>>0; }
function crearZipStore(files){
  const enc=new TextEncoder(); const chunks=[]; const central=[]; let offset=0;
  const u16=n=>[n&0xFF,(n>>>8)&0xFF]; const u32=n=>[n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF];
  files.forEach(f=>{ const nameBytes=enc.encode(f.name); const data=f.data; const crc=_crc32(data);
    const lh=new Uint8Array([].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0)));
    chunks.push(lh,nameBytes,data); const localOffset=offset; offset+=lh.length+nameBytes.length+data.length;
    central.push({nameBytes,crc,size:data.length,localOffset}); });
  const cd=[]; central.forEach(c=>{ const h=new Uint8Array([].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(c.crc),u32(c.size),u32(c.size),u16(c.nameBytes.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(c.localOffset))); cd.push(h,c.nameBytes); });
  const cdStart=offset; let cdSize=0; cd.forEach(x=>cdSize+=x.length);
  const eocd=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),u32(cdSize),u32(cdStart),u16(0)));
  return new Blob([...chunks,...cd,eocd],{type:"application/zip"});
}
// Banner HTML5 VÁLIDO para Google Ads: tamaño exacto, meta ad.size, clickTag,
// imágenes INCRUSTADAS (data:) y fuente del sistema (Arial) — sin recursos
// externos que fallen al subirlo. (La versión sync de arriba es solo preview.)
async function generarHTML5Banner(p, fmt){
  const f=FORMATOS[fmt]||FORMATOS["display-300x250"]; const W=f.ancho, H=f.alto;
  const css=cssComponentes();
  const comp=await compConImagenesInline(composicionEfectiva(p, fmt));
  const cta=(comp.zonas&&comp.zonas.cta&&comp.zonas.cta.url)||"";
  const cmpHtml=renderComposicion(comp, fmt);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">`+
    `<meta name="ad.size" content="width=${W},height=${H}">`+
    `<title>${esc(p.nombre)} ${W}x${H}</title>`+
    `<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:Arial,Helvetica,sans-serif}a.sbb-clic{position:absolute;inset:0;z-index:99;display:block}${css}</style>`+
    `<scr`+`ipt>var clickTag=${JSON.stringify(cta||"https://")};</scr`+`ipt></head>`+
    `<body><!--SBB-CMP:${esc(fmt)}-->${cmpHtml}<a class="sbb-clic" href="javascript:window.open(window.clickTag)"></a></body></html>`;
}
async function exportarArtboard(fmt){
  const p = pieza(); if(!esSetPieza(p)) return;
  let html;
  if(esComposicion(p)){
    html = await generarHTML5Banner(p, fmt);
  } else {
    const ab = p.artboards.find(a => a.fmt === fmt); if(!ab) return;
    if(!(ab.canvas && ab.canvas.length)){ toast("Banner vacío"); return; }
    html = generarHTMLDePieza(piezaDeArtboard(p, ab));
  }
  const F=FORMATOS[fmt];
  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${slugify(p.nombre)}-${F.ancho}x${F.alto}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Descargado ${F.ancho}×${F.alto}`);
}
// Descarga TODOS los tamaños en un solo ZIP (evita el bloqueo de descargas
// múltiples del navegador y es el formato que espera Google Ads).
async function exportarTodoZip(){
  const p=pieza(); if(!esSetPieza(p)) return;
  // Solo los banners MARCADOS con su casilla (el modelo del usuario: "la vista
  // previa y la exportación puede ser seleccionada: todos o solo algunos").
  const fmts=(p.artboards||[]).map(a=>a.fmt)
    .filter(f=>FORMATOS[f] && (esComposicion(p) || (p.artboards.find(a=>a.fmt===f).canvas||[]).length))
    .filter(f=>bannerMarcado(p,f));
  if(!fmts.length){ toast("No hay banners seleccionados. Marca al menos uno con su casilla."); return; }
  const tipo=exportTipo; const slug=slugify(p.nombre);
  toast(`Preparando ZIP con ${fmts.length} banners…`, 12000);
  const files=[];
  try{
    for(const fmt of fmts){
      const F=FORMATOS[fmt]; const nm=`${slug}-${F.ancho}x${F.alto}`;
      if(tipo==="html"){
        const h = esComposicion(p) ? await generarHTML5Banner(p, fmt) : generarHTMLDePieza(piezaDeArtboard(p, p.artboards.find(a=>a.fmt===fmt)));
        files.push({ name:nm+".html", data:new TextEncoder().encode(h) });
      } else {
        const blob=await rasterizarComposicion(p, fmt, tipo);
        files.push({ name:nm+"."+tipo, data:new Uint8Array(await blob.arrayBuffer()) });
      }
    }
    const zip=crearZipStore(files);
    const url=URL.createObjectURL(zip); const a=document.createElement("a");
    a.href=url; a.download=`${slug}-banners-${tipo}.zip`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(`ZIP listo · ${files.length} banners en tamaño exacto`);
  }catch(e){ toast("No se pudo crear el ZIP: "+(e.message||e), 5000); }
}
function exportarTodoElSet(){ exportarTodoZip(); }
// ── Export a imagen (PNG/JPG) — para subir a Google Ads, redes, etc. ──────
function blobADataURL(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(blob); }); }
// Convierte una URL de imagen en dataURL. Cross-origin → pasa por /api/img
// (mismo origen) para no "contaminar" el canvas y poder exportar PNG/JPG.
async function urlADataURL(url){
  if(!url || /^data:/.test(url)) return url;
  try{ const r=await fetch(url,{mode:'cors'}); if(r.ok){ return await blobADataURL(await r.blob()); } }catch(_){}
  try{ const r=await fetch('/api/img?u='+encodeURIComponent(url)); if(r.ok){ return await blobADataURL(await r.blob()); } }catch(_){}
  return url;
}
async function compConImagenesInline(comp){
  const c=JSON.parse(JSON.stringify(comp));
  if(c.fondo&&c.fondo.imagen&&c.fondo.imagen.url) c.fondo.imagen.url=await urlADataURL(c.fondo.imagen.url);
  // Lienzo libre: cada elemento con imagen (los logos) también se incrusta.
  if(Array.isArray(c.elementos)){
    for(const e of c.elementos){ if(e && e.tipo==="logo" && e.url) e.url=await urlADataURL(e.url); }
  }
  if(c.zonas){ for(const zk of ["logo","texto","cta"]){ const z=c.zonas[zk]; if(!z) continue;
    if(z.imagen&&z.imagen.url) z.imagen.url=await urlADataURL(z.imagen.url);
    // Solo la zona LOGO tiene una imagen en `url`; en la zona CTA `url` es el
    // ENLACE del botón (clickTag) y NO debe convertirse a data URL.
    if(zk==="logo" && z.url) z.url=await urlADataURL(z.url);
  } }
  return c;
}
async function rasterizarComposicion(p, fmt, tipo){
  const f=FORMATOS[fmt]||FORMATOS["display-300x250"];
  // Escala 1× = tamaño EXACTO en píxeles (300×250, etc.). Google Ads exige la
  // dimensión exacta; un 2× (600×500) lo rechaza.
  const W=f.ancho, H=f.alto, scale=1;
  const comp=await compConImagenesInline(composicionEfectiva(p, fmt));
  const css=cssComponentes();
  // foreignObject exige XHTML válido: autocerrar elementos vacíos (img/br/…).
  const cmpHtml=renderComposicion(comp, fmt).replace(/<(img|br|hr|input|source)\b([^>]*?)\/?>/gi, "<$1$2/>");
  const html=`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;margin:0;font-family:'${p.tema.font}',Arial,sans-serif;"><style><![CDATA[${css}]]></style>${cmpHtml}</div>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${html}</foreignObject></svg>`;
  const img=new Image();
  await new Promise((res,rej)=>{ img.onload=res; img.onerror=()=>rej(new Error("no se pudo renderizar el SVG")); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); });
  const cv=document.createElement("canvas"); cv.width=W*scale; cv.height=H*scale;
  const ctx=cv.getContext("2d"); ctx.scale(scale,scale);
  if(tipo==='jpg'){ ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,W,H); }
  ctx.drawImage(img,0,0,W,H);
  return await new Promise((res,rej)=>{ cv.toBlob(b=>b?res(b):rej(new Error("el navegador no pudo exportar la imagen")), tipo==='jpg'?'image/jpeg':'image/png', 0.92); });
}
async function exportarArtboardImg(fmt, tipo){
  const p=pieza(); if(!esComposicion(p)) return;
  toast("Generando "+tipo.toUpperCase()+"…", 6000);
  try{
    const blob=await rasterizarComposicion(p, fmt, tipo);
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`${slugify(p.nombre)}-${fmt.replace("display-","")}.${tipo}`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(`Descargado ${FORMATOS[fmt].ancho}×${FORMATOS[fmt].alto} (${tipo.toUpperCase()})`);
  }catch(e){ toast("No se pudo rasterizar: "+(e.message||e), 4500); }
}
// Dispatcher según el tipo elegido en el modal de exportación.
let exportTipo = "png";   // por defecto imagen exacta (lo más simple para Google)
function setExportTipo(t){ exportTipo=t; document.querySelectorAll("#export-tipo button").forEach(b=>b.classList.toggle("on", b.dataset.t===t)); }
function exportarArtboardEn(fmt){ if(exportTipo==="html") exportarArtboard(fmt); else exportarArtboardImg(fmt, exportTipo); }
function exportarTodoEnTipo(){ exportarTodoZip(); }
// Casillas del modal de exportación (las mismas que las del tablero).
function marcarExport(on){
  const p=pieza(); if(!p) return;
  marcarTodosBanners(on);
  document.querySelectorAll("#export-list .exp-ck").forEach(c=>{ c.checked = on; });
  refrescarNExport();
}
function refrescarNExport(){
  const p=pieza(); if(!p) return;
  const n=document.getElementById("exp-n");
  if(n) n.textContent = bannersMarcados(p).length;
}
// Hoja de contactos: todos los banners MARCADOS, cada uno a su tamaño real y
// con su rótulo, para revisarlos de una vez antes de exportar.
function previewDeSet(p){
  const css = cssComponentes();
  const fmts = (p.artboards||[]).map(a=>a.fmt).filter(f=>FORMATOS[f] && bannerMarcado(p,f));
  const piezas = fmts.map(fmt=>{
    const F = FORMATOS[fmt];
    const cuerpo = esComposicion(p)
      ? renderComposicion(composicionEfectiva(p, fmt), fmt)
      : `<div class="ab-frame" style="width:${F.ancho}px;height:${F.alto}px;">${((p.artboards.find(a=>a.fmt===fmt)||{}).canvas||[]).map(it=>BLOQUES[it.tipo].render(it.datos)).join("")}</div>`;
    return `<figure class="pv-b"><figcaption>${F.ancho} × ${F.alto}</figcaption>
      <div class="pv-marco" style="width:${F.ancho}px;height:${F.alto}px;">${cuerpo}</div></figure>`;
  }).join("");
  const vacio = `<p class="pv-vacio">No hay banners marcados. Marca al menos uno con su casilla para verlo aquí.</p>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(p.nombre)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Roboto,Arial,sans-serif;background:#eef1f6;padding:26px;color:#12173d;}
h1{font-size:18px;font-weight:600;margin-bottom:4px;}
.pv-sub{font-size:13px;color:#5b6178;margin-bottom:22px;}
.pv-lista{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start;}
.pv-b figcaption{font-size:11.5px;font-weight:600;color:#5b6178;margin-bottom:6px;letter-spacing:.03em;}
.pv-marco{background:#fff;box-shadow:0 2px 10px rgba(18,23,61,.10);overflow:hidden;}
.pv-vacio{font-size:14px;color:#5b6178;}
${css}</style></head><body>
<h1>${esc(p.nombre)}</h1>
<p class="pv-sub">${fmts.length} banner${fmts.length===1?"":"s"} seleccionado${fmts.length===1?"":"s"}, a tamaño real</p>
<div class="pv-lista">${piezas||vacio}</div></body></html>`;
}
