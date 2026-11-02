/* ══════════════════════════════════════════════════════════════════
   GOOGLE SEARCH · CONSOLA (piezas guardadas)  ·  funciones/search/consola.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: La consola de Search dentro del editor (adsData), «Tu campaña actual» (diagnóstico), sus planillas y CSV, e irACampanas() que lleva a las Campañas nuevas.
   QUIÉN LO USA: Las campañas NUEVAS viven en /campanas (search/campanas.js). Esta consola queda para las piezas de Search ya guardadas.
   SECCIONES (en orden):
     1. Consola de campaña (vista propia del formato ads)
     2. Sitelinks: alta y baja manual (los textos se editan con clic, como todo)
     3. Pedir a Char-B más keywords para UN grupo (respetando su intención)
     4. Lectura de archivos
     5. La vista
     6. Acciones
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// La planilla de la campaña de Search: UNA hoja por tipo de dato (keywords,
// anuncios y negativas), cabeceras en inglés —las únicas que Google Ads Editor
// reconoce solo— y los límites recortados otra vez al exportar, por si el
// usuario alargó un texto al editarlo.
function descargarPlanillaAds(){
  const p = pieza(); const d = p && p.adsData;
  if(!d){ toast("Sin campaña generada"); return; }
  const camp = d.nombre || p.nombre || "Campaña";
  const rec = (s,n) => String(s==null?"":s).replace(/\s+/g," ").trim().slice(0,n);

  const keywords = [["Campaign","Ad Group","Keyword","Criterion Type"]];
  (d.grupos||[]).forEach(g => (g.keywords||[]).forEach(k =>
    keywords.push([camp, g.nombre, k.t, k.tipo==="frase" ? "Phrase" : "Exact"])));

  const negativas = [["Campaign","Ad Group","Keyword","Criterion Type"]];
  (d.grupos||[]).forEach(g => (g.negativas||[]).forEach(n =>
    negativas.push([camp, g.nombre, n, "Negative Phrase"])));
  (d.negativas||[]).forEach(n => negativas.push([camp, "", n, "Negative Phrase"]));

  const maxT = Math.min(15, Math.max(0, ...(d.grupos||[]).map(g => (g.titulares||[]).length)));
  const maxD = Math.min(4,  Math.max(0, ...(d.grupos||[]).map(g => (g.descripciones||[]).length)));
  const cab = ["Campaign","Ad Group"];
  // La COLUMNA DE POSICIÓN va al lado de cada titular: los cuatro anclados con su
  // posición, los once que rotan en blanco. Sin ella el anclaje se decide en el
  // aplicativo y nunca llega a Google.
  for(let i=1;i<=maxT;i++){ cab.push("Headline "+i, "Headline "+i+" position"); }
  for(let i=1;i<=maxD;i++) cab.push("Description "+i);
  cab.push("Path 1","Path 2","Final URL");
  const POSICION = ["1","2","3","3"];
  const anuncios = [cab];
  (d.grupos||[]).forEach(g => {
    const fila = [camp, g.nombre];
    const fijos = (g.titularesFijos||[]).map(t => String(t||"").toLowerCase());
    for(let i=0;i<maxT;i++){
      const t = rec((g.titulares||[])[i], 30);
      fila.push(t);
      const iFijo = t ? fijos.indexOf(t.toLowerCase()) : -1;
      fila.push(iFijo >= 0 ? (POSICION[iFijo] || "") : "");
    }
    for(let i=0;i<maxD;i++) fila.push(rec((g.descripciones||[])[i], 90));
    fila.push(rec(g.path1,15), rec(g.path2,15), d.urlFinal || "");
    anuncios.push(fila);
  });

  const hojas = [{ nombre:"Keywords", filas:keywords }, { nombre:"Anuncios", filas:anuncios }, { nombre:"Negativas", filas:negativas }];
  if(Array.isArray(d.sitelinks) && d.sitelinks.length){
    const sl = [["Campaign","Link Text","Description Line 1","Description Line 2","Final URL"]];
    d.sitelinks.forEach(s => sl.push([camp, rec(s.texto,25), rec(s.desc1,35), rec(s.desc2,35), s.url||""]));
    hojas.push({ nombre:"Sitelinks", filas:sl });
  }
  descargarXLSX(slugify(camp)+"-google-ads.xlsx", hojas);
  toast("Planilla XLSX descargada · "+hojas.length+" hojas");
}
function descargarCSVKeywords(){
  const p = pieza(); const d = p && p.adsData; if(!d){ toast("Sin campaña generada"); return; }
  const camp = d.nombre || p.nombre || "Campaña";
  const filas = [["Campaign","Ad Group","Keyword","Criterion Type"]];
  (d.grupos||[]).forEach(g => {
    (g.keywords||[]).forEach(k => filas.push([camp, g.nombre, k.t, k.tipo==="frase" ? "Phrase" : "Exact"]));
    // Negativas del grupo: en frase, para bloquear cualquier búsqueda que las contenga.
    (g.negativas||[]).forEach(n => filas.push([camp, g.nombre, n, "Negative Phrase"]));
  });
  // Negativas de campaña (sin grupo): protegen toda la campaña.
  (d.negativas||[]).forEach(n => filas.push([camp, "", n, "Negative Phrase"]));
  _descargarCSV(slugify(camp)+"-keywords.csv", filas);
  toast("CSV de keywords descargado");
}
function descargarCSVAnuncios(){
  const p = pieza(); const d = p && p.adsData; if(!d){ toast("Sin campaña generada"); return; }
  const camp = d.nombre || p.nombre || "Campaña";
  const maxT = Math.min(15, Math.max(...(d.grupos||[]).map(g => (g.titulares||[]).length), 0));
  const maxD = Math.min(4, Math.max(...(d.grupos||[]).map(g => (g.descripciones||[]).length), 0));
  const cab = ["Campaign","Ad Group"];
  // Google Ads Editor lee la columna "Headline N position" para ANCLAR un titular.
  // Los 4 fijos van anclados (1,2,3 y el 4º también en 3, que es lo que permite
  // Google); los 11 restantes van sin posición y rotan.
  for(let i=1;i<=maxT;i++){ cab.push("Headline "+i); cab.push("Headline "+i+" position"); }
  for(let i=1;i<=maxD;i++) cab.push("Description "+i);
  cab.push("Path 1","Path 2","Final URL");
  const POSICION = ["1","2","3","3"];        // las 4 anclas permitidas por Google
  const filas = [cab];
  (d.grupos||[]).forEach(g => {
    const f = [camp, g.nombre];
    const fijos = (g.titularesFijos||[]).map(t=>String(t||"").toLowerCase());
    // Límites de Google garantizados aunque el usuario haya alargado un texto al editarlo.
    for(let i=0;i<maxT;i++){
      const t = String((g.titulares||[])[i]||"").slice(0,30);
      f.push(t);
      const idx = t ? fijos.indexOf(t.toLowerCase()) : -1;
      f.push(idx>=0 ? (POSICION[idx]||"") : "");
    }
    for(let i=0;i<maxD;i++) f.push(String((g.descripciones||[])[i]||"").slice(0,90));
    f.push(String(g.path1||"").slice(0,15), String(g.path2||"").slice(0,15), d.urlFinal||"");
    filas.push(f);
  });
  _descargarCSV(slugify(camp)+"-anuncios.csv", filas);
  toast("CSV de anuncios descargado");
}
function descargarCSVSitelinks(){
  const p = pieza(); const d = p && p.adsData; if(!d || !(d.sitelinks||[]).length){ toast("La campaña no tiene sitelinks"); return; }
  const camp = d.nombre || p.nombre || "Campaña";
  // Cabeceras que Google Ads Editor reconoce para extensiones de enlace.
  const filas = [["Campaign","Sitelink text","Description line 1","Description line 2","Final URL"]];
  // Una URL relativa (/cotizar) se completa con el dominio de la landing.
  let base = ""; try{ base = new URL(d.urlFinal).origin; }catch(e){}
  d.sitelinks.forEach(s => {
    const u = String(s.url||"");
    const abs = /^https?:\/\//i.test(u) ? u : (base && u.startsWith("/") ? base + u : u);
    filas.push([camp, String(s.texto||"").slice(0,25), String(s.desc1||"").slice(0,35), String(s.desc2||"").slice(0,35), abs]);
  });
  _descargarCSV(slugify(camp)+"-sitelinks.csv", filas);
  toast("CSV de sitelinks descargado");
}
function irACampanas(){ location.href = "/campanas/nueva"; }
// Google Search: la IA devuelve la campaña estructurada (grupos por intención,
// keywords exacta/frase, negativas y anuncios RSA). Se guarda ÍNTEGRA en
// p.adsData — ÚNICA fuente de verdad: la consola la pinta, la edición inline
// la modifica y el CSV sale de ella (siempre en sincronía).
const kwVisible = k => k.tipo === "frase" ? `"${k.t}"` : `[${k.t}]`;
const _deslug = s => { s = String(s||"").trim(); return (!/\s/.test(s) && /-/.test(s)) ? s.replace(/-+/g," ") : s; };
function insertarAdsIA(data, marca, brief){
  asegurarProyectoIA();
  // Si la pieza abierta es una Search con diagnóstico, el diagnóstico viaja con
  // la campaña nueva (sigue siendo su aprendizaje). Si además está VACÍA (se
  // analizó la campaña actual antes de generar), se llena esa misma pieza.
  const act = pieza();
  const previa = (act && act.formato==="ads" && act.adsData) ? act.adsData : null;
  const reusar = previa && !(previa.grupos||[]).length && proyecto.piezas.includes(act);
  const adsData = { nombre:_deslug(data.nombre||""), urlFinal:data.urlFinal||"", grupos:data.grupos||[], negativas:data.negativas||[], sitelinks:data.sitelinks||[],
      // Lo que investigó la IA (landing + competencia) y por qué excluyó cada negativa.
      analisis:data.analisis||null, negativasMotivos:data.negativasMotivos||{},
      // El OBJETIVO de la campaña queda guardado: el diagnóstico y el rearmado lo respetan.
      brief: brief || (previa && previa.brief) || null, marcaId: marca && marca.id || (previa && previa.marcaId) || null,
      actual: previa && previa.actual ? JSON.parse(JSON.stringify(previa.actual)) : undefined };
  if(reusar){
    act.adsData = adsData; if(data.nombre) act.nombre = _deslug(String(data.nombre));
    adsVista = "res"; document.getElementById("galeria").classList.remove("show");
    activarPieza(act.id); persistir(); return;
  }
  const p = { id:uid(), nombre:_deslug(String(data.nombre||"Campaña Search")), campana:"General", formato:"ads", canvas:[],
    tema: { font:"Roboto", primary:"#1c73cb", text:"#12173d", bg:"#ffffff", bgPagina:"", ancho:"", radio:"0", gap:"0" },
    adsData };
  proyecto.piezas.push(p); proyecto.activa = p.id;
  adsVista = "res";
  document.getElementById("galeria").classList.remove("show");
  activarPieza(p.id);
  persistir();
}

// ── Consola de campaña (vista propia del formato ads) ─────────────────────
// Diagramación de referencia: la consola de Google Ads (vista general → un tab
// por grupo; keywords con concordancia; el anuncio previsualizado como en el
// buscador; negativas aparte) + los inventarios con contador de Ads Editor.
let adsVista = "res";
let _adsRotador = null;   // intervalo del anuncio que rota (como Google RSA)
function adsIrVista(v){ adsVista = String(v); renderAdsCampana(); }
// El anuncio de la vista previa rota titulares y descripciones como lo hace
// Google con los RSA (anuncios adaptables): cada tanto muestra otra combinación,
// para que se entienda que Google no fija un orden. Determinista, con fundido.
function iniciarRotadorSerp(g){
  if(_adsRotador){ clearInterval(_adsRotador); _adsRotador = null; }
  const T = (g.titulares||[]).filter(Boolean);
  const D = (g.descripciones||[]).filter(Boolean);
  // Si no hay material para rotar, se queda fijo (nada que alternar).
  if(T.length <= 3 && D.length <= 2) return;
  let paso = 1;
  const pick = (arr, n, off) => { const out=[]; for(let i=0;i<Math.min(n,arr.length);i++) out.push(arr[(off+i)%arr.length]); return out; };
  _adsRotador = setInterval(() => {
    const et = document.getElementById("serp-tit"), ed = document.getElementById("serp-desc");
    if(!et || !ed){ clearInterval(_adsRotador); _adsRotador = null; return; }
    const tit = pick(T, 3, paso % Math.max(1,T.length)).join(" · ");
    const desc = pick(D, 2, paso % Math.max(1,D.length)).join(" ");
    et.style.opacity = ed.style.opacity = "0";
    setTimeout(() => { et.textContent = tit; ed.textContent = desc; et.style.opacity = ed.style.opacity = "1"; }, 200);
    paso++;
  }, 2600);
  livePreviewIntervals.push(_adsRotador);   // se limpia también en renderCanvas
}
// Panel izquierdo propio del formato ads: resumen de la campaña, navegación
// por grupos (sincronizada con las píldoras de la consola) y acciones.
function renderPanelAds(){
  const el = document.getElementById("pane-ads"); if(!el) return;
  const p = pieza();
  if(!p || p.formato !== "ads"){ el.innerHTML = ""; return; }
  const d = p.adsData;
  if(!d || !(d.grupos||[]).length){
    el.innerHTML = `<div class="adsp">
      <div class="adsp-sec">Campaña de Google Search</div>
      <p class="adsp-p">Aquí no se arma con bloques: Char-B genera los grupos por intención de búsqueda, las keywords (solo exacta y de frase, nada de amplia), las negativas y los anuncios. Después editas todo en la consola haciendo clic sobre los textos.</p>
      <button class="adsc-btn" style="width:100%;justify-content:center;" onclick="abrirIA()">${svgIcon("estrella",{size:"14px"})} Generar con Char-B</button>
      <div class="adsp-sec" style="margin-top:14px;">Tu campaña actual · opcional</div>
      <button class="adsp-item ${adsVista==="actual"?"on":""}" onclick="adsAbrirActual()"><span>${d && d.actual && d.actual.diagnostico ? "Ver diagnóstico" : "Traer capturas o informes"}</span></button>
    </div>`;
    return;
  }
  const G = d.grupos;
  const nKw = G.reduce((a,g)=>a+(g.keywords||[]).length,0);
  const nTit = G.reduce((a,g)=>a+(g.titulares||[]).length,0);
  const nNeg = (d.negativas||[]).length + G.reduce((a,g)=>a+(g.negativas||[]).length,0);
  el.innerHTML = `<div class="adsp">
    <div class="adsp-sec">Campaña</div>
    <div class="adsp-stats">
      <div class="adsp-stat"><b>${G.length}</b><span>grupos</span></div>
      <div class="adsp-stat"><b>${nKw}</b><span>keywords</span></div>
      <div class="adsp-stat"><b>${nTit}</b><span>titulares</span></div>
      <div class="adsp-stat"><b>${nNeg}</b><span>negativas</span></div>
    </div>
    <div class="adsp-sec">Grupos de anuncios</div>
    <button class="adsp-item ${adsVista==="res"?"on":""}" onclick="adsIrVista('res')"><span>Vista general</span></button>
    ${G.map((g,i)=>`<button class="adsp-item ${String(i)===String(adsVista)?"on":""}" onclick="adsIrVista('${i}')"><span>${esc(_deslug(g.nombre))}</span><span class="n">${(g.keywords||[]).length} kw</span></button>`).join("")}
    <div class="adsp-sec">Tu campaña actual · opcional</div>
    <button class="adsp-item ${adsVista==="actual"?"on":""}" onclick="adsAbrirActual()"><span>${d.actual && d.actual.diagnostico ? "Ver diagnóstico" : "Traer capturas o informes"}</span>${d.actual && d.actual.diagnostico ? `<span class="n">${(d.actual.diagnostico.noHacer||[]).length} lecciones</span>` : ""}</button>
    <div class="adsp-sec">Acciones</div>
    <button class="adsp-btn ia" onclick="abrirIA()">${svgIcon("estrella",{size:"13px"})} Regenerar con Char-B</button>
    <button class="adsp-btn" onclick="abrirExportar()">${svgIcon("exportar",{size:"13px"})} Exportar CSV para Google Ads</button>
  </div>`;
}
function renderAdsCampana(){
  if(_adsRotador){ clearInterval(_adsRotador); _adsRotador = null; }   // corta el rotador anterior
  const c = document.getElementById("canvas");
  ajustarFrameParaSet(false);
  const p = pieza(); const d = p && p.adsData;
  renderPanelAds();
  if(adsVista==="actual"){
    const dd = asegurarAdsData(p);
    c.innerHTML = `<div class="adsc"><div class="adsc-pills">
        ${(dd.grupos||[]).length ? `<button class="adsc-pill" onclick="adsIrVista('res')">← Volver a la campaña</button>` : `<button class="adsc-pill" onclick="adsIrVista('res')">← Volver</button>`}
        <button class="adsc-pill on">Tu campaña actual</button></div>${adsVistaActual(p, dd)}</div>`;
    return;
  }
  if(!d || !(d.grupos||[]).length){
    c.innerHTML = `<div class="adsc"><div class="adsc-vac"><span style="color:#1c73cb;">${svgIcon("buscar",{size:"40px"})}</span>
      <h2 style="margin:14px 0 6px;font-size:17px;color:#040764;font-weight:600;">Tu campaña de Google Search parte aquí</h2>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;">Char-B arma los grupos por intención de búsqueda, las keywords<br>(solo exacta y frase, nada de amplia), las negativas y los anuncios.</p>
      <button class="adsc-btn" onclick="abrirIA()">${svgIcon("estrella",{size:"14px"})} Generar campaña con Char-B</button>
      <div style="margin-top:14px;"><button class="adsc-copy" onclick="adsAbrirActual()">${svgIcon("barchart",{size:"13px"})} ¿Ya tienes una campaña corriendo? Tráela primero (opcional)</button></div></div></div>`;
    return;
  }
  const G = d.grupos;
  if(adsVista!=="res"){ const gi = parseInt(adsVista,10); if(!(gi>=0 && gi<G.length)) adsVista = "res"; }
  const nKw = G.reduce((a,g)=>a+(g.keywords||[]).length,0);
  const nTit = G.reduce((a,g)=>a+(g.titulares||[]).length,0);
  const nNeg = (d.negativas||[]).length + G.reduce((a,g)=>a+(g.negativas||[]).length,0);
  const head = `
    <div class="adsc-head">
      <div style="min-width:0;flex:1;">
        <div class="adsc-eyebrow">Campaña Google Search</div>
        <h1>${esc(_deslug(d.nombre) || p.nombre)}</h1>
        <div class="adsc-url"><span style="white-space:nowrap;">Landing:</span> <span class="u tx" contenteditable="true" data-p="urlFinal" onblur="adsEditar(this)" spellcheck="false">${esc(d.urlFinal||"(pega aquí la URL de destino)")}</span></div>
      </div>
      <div class="adsc-stats">
        <span class="adsc-stat"><b>${G.length}</b> grupos</span>
        <span class="adsc-stat"><b>${nKw}</b> keywords</span>
        <span class="adsc-stat"><b>${nTit}</b> titulares</span>
        <span class="adsc-stat"><b>${nNeg}</b> negativas</span>
        <span class="adsc-stat">Solo <b>exacta</b> y <b>frase</b></span>
      </div>
    </div>`;
  const pills = `<div class="adsc-pills">
      <button class="adsc-pill ${adsVista==="res"?"on":""}" onclick="adsIrVista('res')">Vista general</button>
      ${G.map((g,i)=>`<button class="adsc-pill ${String(i)===String(adsVista)?"on":""}" onclick="adsIrVista('${i}')">${esc(_deslug(g.nombre).slice(0,28))} <span class="n">· ${(g.keywords||[]).length} kw</span></button>`).join("")}
      <button class="adsc-pill adsc-pill-actual" onclick="adsAbrirActual()" title="Opcional: trae lo que ya corre en Google Ads">${svgIcon("barchart",{size:"12px"})} Tu campaña actual${d.actual && d.actual.diagnostico ? ' <span class="n">· analizada</span>' : ''}</button>
    </div>`;
  c.innerHTML = `<div class="adsc">${head}${pills}${adsVista==="res" ? adsVistaResumen(d) : adsVistaGrupo(d, parseInt(adsVista,10))}</div>`;
  // En vista de grupo, el anuncio de ejemplo rota como en Google.
  if(adsVista!=="res"){ const gi = parseInt(adsVista,10); if(G[gi]) iniciarRotadorSerp(G[gi]); }
}
function adsVistaResumen(d){
  const cards = d.grupos.map((g,i)=>`
    <div class="adsc-card adsc-gcard" onclick="adsIrVista('${i}')" style="cursor:pointer;">
      <div class="adsc-eyebrow">Grupo ${i+1} · ${(g.keywords||[]).length} keywords</div>
      <div style="font-size:15.5px;font-weight:600;color:#040764;margin-bottom:6px;">${esc(_deslug(g.nombre))}</div>
      <div style="font-size:12.5px;color:#5b6178;line-height:1.55;margin-bottom:12px;">${esc(g.intencion||"")}</div>
      <div class="adsc-chips" style="margin-bottom:12px;">
        ${(g.keywords||[]).slice(0,3).map(k=>`<span class="adsc-tipo ${k.tipo==="frase"?"frase":"exacta"}" style="cursor:default;">${esc(kwVisible(k))}</span>`).join("")}
        ${(g.keywords||[]).length>3?`<span class="adsc-tipo" style="background:#eef1f6;color:#5b6178;cursor:default;">+${g.keywords.length-3} más</span>`:""}
      </div>
      <div style="font-size:12px;color:#1c73cb;font-weight:500;">Ver grupo completo →</div>
    </div>`).join("");
  const negs = d.negativas||[];
  const sls = d.sitelinks||[];
  return `
    <div class="adsc-resumen">${cards}</div>
    <div class="adsc-card">
      <h3>Sitelinks · enlaces extra bajo el anuncio <button class="adsc-copy" onclick="adsAgregarSitelink()">+ Añadir</button></h3>
      ${sls.length ? sls.map((s,i)=>`
        <div class="adsc-item" style="gap:10px;">
          <div style="min-width:0;flex:1;">
            <span class="tx" style="font-weight:600;color:#040764;" contenteditable="true" data-p="sitelinks.${i}.texto" onblur="adsEditar(this)" spellcheck="false">${esc(s.texto||"")}</span>
            <span class="adsc-cnt ${String(s.texto||"").length>25?"mal":""}">${String(s.texto||"").length}/25</span>
            <div style="font-size:12px;color:#5b6178;margin-top:2px;">
              <span class="tx" contenteditable="true" data-p="sitelinks.${i}.desc1" onblur="adsEditar(this)" spellcheck="false">${esc(s.desc1||"")}</span> ·
              <span class="tx" contenteditable="true" data-p="sitelinks.${i}.desc2" onblur="adsEditar(this)" spellcheck="false">${esc(s.desc2||"")}</span>
            </div>
            <div style="font-size:11.5px;color:#1c73cb;margin-top:2px;"><span class="tx" contenteditable="true" data-p="sitelinks.${i}.url" onblur="adsEditar(this)" spellcheck="false">${esc(s.url||"")}</span></div>
          </div>
          <button class="adsc-copy" style="flex:none;" title="Quitar sitelink" onclick="adsQuitarSitelink(${i})">✕</button>
        </div>`).join("") : `<div style="font-size:12.5px;color:#5b6178;">Char-B los propone desde los enlaces reales de tu landing al generar la campaña, o agrégalos a mano.</div>`}
      <p class="adsc-nota">Límites de Google: texto ≤ 25 caracteres, cada descripción ≤ 35. Van en su propio CSV al exportar.</p>
    </div>
    <div class="adsc-card" style="margin-top:18px;">
      <h3>Negativas de campaña · búsquedas por las que NO quieres pagar <button class="adsc-copy" onclick="adsAgregarEn('negativas')">+ Añadir</button> <button class="adsc-copy" onclick="adsCopiar('negativas')">Copiar</button></h3>
      ${negs.length ? `<div class="adsc-chips">${negs.map((n,ni)=>`<span class="adsc-neg"><span class="tx" contenteditable="true" data-p="negativas.${ni}" onblur="adsEditar(this)" spellcheck="false">${esc(n)}</span> <span style="cursor:pointer;opacity:.6;" title="Quitar" onclick="adsQuitarDe('negativas',${ni})">✕</span></span>`).join("")}</div>` : `<div style="font-size:12.5px;color:#5b6178;">Sin negativas de campaña.</div>`}
      <p class="adsc-nota">Van incluidas en el CSV de keywords como concordancia de frase negativa: bloquean cualquier búsqueda que las contenga.</p>
    </div>`;
}
// ── Sitelinks: alta y baja manual (los textos se editan con clic, como todo) ──
function adsAgregarSitelink(){
  const p = pieza(); const d = p && p.adsData; if(!d) return;
  (d.sitelinks = d.sitelinks || []).push({ texto:"Nuevo enlace", desc1:"", desc2:"", url:"/" });
  persistir(); renderAdsCampana();
}
function adsQuitarSitelink(i){
  const p = pieza(); const d = p && p.adsData; if(!d || !d.sitelinks) return;
  d.sitelinks.splice(i,1);
  persistir(); renderAdsCampana();
}
// ── Pedir a Char-B más keywords para UN grupo (respetando su intención) ──
async function adsPedirMasKeywords(gi){
  const p = pieza(); const d = p && p.adsData; const g = d && d.grupos && d.grupos[gi]; if(!g) return;
  const btn = document.getElementById("ads-maskw-"+gi);
  if(btn){ btn.disabled = true; btn.textContent = "Char-B está buscando…"; }
  try{
    const r = await fetch("/api/ia", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ modo:"mas-keywords", grupo:{ nombre:g.nombre, intencion:g.intencion, keywords:g.keywords||[] }, brief:{ que:d.nombre||p.nombre||"", ctaUrl:d.urlFinal||"" }, analisis:d.analisis||null }) });
    const data = await r.json().catch(()=>null);
    if(!r.ok || !data || !data.ok){ toast((data && data.error) || "Char-B no pudo ampliar el grupo"); return; }
    const vistos = new Set((g.keywords||[]).map(k=>String(k.t||"").toLowerCase()));
    const nuevas = (data.keywords||[]).filter(k=>k.t && !vistos.has(k.t.toLowerCase()));
    if(!nuevas.length){ toast("No llegaron keywords nuevas"); return; }
    g.keywords = (g.keywords||[]).concat(nuevas);
    persistir(); renderAdsCampana();
    toast(nuevas.length+" keywords nuevas en el grupo");
  }catch(e){ toast("Sin conexión con Char-B"); }
  finally{ const b = document.getElementById("ads-maskw-"+gi); if(b){ b.disabled = false; } }
}
function adsVistaGrupo(d, gi){
  const g = d.grupos[gi]; if(!g) return "";
  const host = String(d.urlFinal||"").replace(/^https?:\/\//,"").split("/")[0] || "tusitio.cl";
  const badge = (len,max)=>`<span class="adsc-cnt ${len>max?"mal":""}" title="caracteres usados / máximo de Google">${len}/${max}</span>`;
  const quitar = (fn)=>`<button class="adsc-copy" style="flex:none;padding:2px 7px;" title="Quitar" onclick="${fn}">✕</button>`;
  const kws = (g.keywords||[]).map((k,ki)=>`
    <div class="adsc-kw">
      <span class="k tx" contenteditable="true" data-p="grupos.${gi}.keywords.${ki}.t" onblur="adsEditar(this)" spellcheck="false">${esc(k.t)}</span>
      <button class="adsc-tipo ${k.tipo==="frase"?"frase":"exacta"}" onclick="adsToggleKw(${gi},${ki})" title="Clic para alternar la concordancia">${k.tipo==="frase"?'"Frase"':"[Exacta]"}</button>
      ${quitar(`adsQuitarDe('grupos.${gi}.keywords',${ki})`)}
    </div>`).join("");
  const tits = (g.titulares||[]).map((t,i)=>`
    <div class="adsc-item"><span class="tx" contenteditable="true" data-p="grupos.${gi}.titulares.${i}" onblur="adsEditar(this)" spellcheck="false">${esc(t)}</span>${badge(t.length,30)}${quitar(`adsQuitarDe('grupos.${gi}.titulares',${i})`)}</div>`).join("");
  const descs = (g.descripciones||[]).map((t,i)=>`
    <div class="adsc-item"><span class="tx" contenteditable="true" data-p="grupos.${gi}.descripciones.${i}" onblur="adsEditar(this)" spellcheck="false">${esc(t)}</span>${badge(t.length,90)}${quitar(`adsQuitarDe('grupos.${gi}.descripciones',${i})`)}</div>`).join("");
  const ruta = host + (g.path1?" › "+g.path1:"") + (g.path2?" › "+g.path2:"");
  return `
    <div class="adsc-intent">
      <div class="adsc-eyebrow">Grupo ${gi+1} de ${d.grupos.length}</div>
      <div class="gnm"><span class="tx" contenteditable="true" data-p="grupos.${gi}.nombre" onblur="adsEditar(this)" spellcheck="false">${esc(_deslug(g.nombre))}</span></div>
      <div class="t">Intención: <span class="tx" contenteditable="true" data-p="grupos.${gi}.intencion" onblur="adsEditar(this)" spellcheck="false">${esc(g.intencion||"")}</span></div>
      ${g.razonamiento?`<div class="r">${esc(g.razonamiento)}</div>`:""}
    </div>
    <div class="adsc-grid">
      <div>
        <div class="adsc-card">
          <h3>Keywords · ${(g.keywords||[]).length} <button class="adsc-copy" onclick="adsAgregarEn('grupos.${gi}.keywords')">+ Añadir</button> <button class="adsc-copy" onclick="adsCopiar('keywords',${gi})">Copiar</button></h3>
          ${kws}
          <button class="adsc-btn" id="ads-maskw-${gi}" style="width:100%;justify-content:center;margin-top:10px;" onclick="adsPedirMasKeywords(${gi})">${svgIcon("estrella",{size:"13px"})} Pedir más keywords a Char-B</button>
          <p class="adsc-nota">Clic en la etiqueta para alternar [Exacta] ↔ "Frase". La concordancia amplia no existe aquí. Los textos se editan con un clic. Char-B amplía el grupo sin salirse de su intención.</p>
        </div>
        <div class="adsc-card" style="margin-top:18px;">
          <h3>Negativas del grupo <button class="adsc-copy" onclick="adsAgregarEn('grupos.${gi}.negativas')">+ Añadir</button> <button class="adsc-copy" onclick="adsCopiar('negativasGrupo',${gi})">Copiar</button></h3>
          ${(g.negativas||[]).length?`<div class="adsc-chips">${g.negativas.map((n,ni)=>`<span class="adsc-neg"><span class="tx" contenteditable="true" data-p="grupos.${gi}.negativas.${ni}" onblur="adsEditar(this)" spellcheck="false">${esc(n)}</span> <span style="cursor:pointer;opacity:.6;" title="Quitar" onclick="adsQuitarDe('grupos.${gi}.negativas',${ni})">✕</span></span>`).join("")}</div>`:`<div style="font-size:12.5px;color:#5b6178;">Sin negativas en este grupo.</div>`}
        </div>
      </div>
      <div>
        <div class="adsc-serp">
          <div class="tag">Así se vería tu anuncio en Google</div>
          <div class="pat">Patrocinado</div>
          <div class="ruta">${esc(ruta)}</div>
          <div class="tit" id="serp-tit">${esc((g.titulares||[]).slice(0,3).join(" · "))}</div>
          <div class="desc" id="serp-desc">${esc((g.descripciones||[]).slice(0,2).join(" "))}</div>
          <div class="adsc-rota"><span class="dot"></span> Google combina y <b>rota</b> tus titulares y descripciones (anuncio adaptable). Aquí ves cómo va cambiando.</div>
        </div>
        <div class="adsc-card">
          <h3>Titulares · ${(g.titulares||[]).length} <span class="lim">máx 30 caracteres</span> <button class="adsc-copy" onclick="adsAgregarEn('grupos.${gi}.titulares')">+ Añadir</button> <button class="adsc-copy" onclick="adsCopiar('titulares',${gi})">Copiar</button></h3>
          ${tits}
          <p class="adsc-nota">Google combina y rota estos titulares (anuncio adaptable RSA). El contador en rojo marca los que exceden el límite.</p>
        </div>
        <div class="adsc-card" style="margin-top:18px;">
          <h3>Descripciones · ${(g.descripciones||[]).length} <span class="lim">máx 90</span> <button class="adsc-copy" onclick="adsAgregarEn('grupos.${gi}.descripciones')">+ Añadir</button> <button class="adsc-copy" onclick="adsCopiar('descripciones',${gi})">Copiar</button></h3>
          ${descs}
        </div>
      </div>
    </div>`;
}
// ══════════════════════════════════════════════════════════════════════
// TU CAMPAÑA ACTUAL (opcional) — sep-2026
// Complemento de la gestión: el usuario trae lo que YA corre en Google Ads
// (capturas, informes exportados, su queja), Char-B lo diagnostica y deja
// registrado lo que no hay que repetir. Ese aprendizaje viaja a la generación
// como APORTE; el objetivo de la campaña (adsData.brief) sigue mandando.
// Los adjuntos viven solo en memoria (pesan); lo que se guarda es el resultado.
// ══════════════════════════════════════════════════════════════════════
let _adsAdj = [];              // [{tipo:'img'|'tabla', nombre, data|texto, mime}]
let _adsActualEditando = false;
function marcaParaIA(M){
  return M ? { nombre:M.nombre, empresa:M.empresa, primary:M.primary, secondary:M.secondary, cta:M.cta, ctaText:M.ctaText, text:M.text, bg:M.bg, accent1:M.accent1, accent2:M.accent2, fontTitulo:M.fontTitulo, fontCuerpo:M.fontCuerpo, logoUrl:M.logo, negocio:M.negocio, tono:M.tono, eslogan:M.eslogan, publico:M.publico, productos:M.productos, usar:M.usar, evitar:M.evitar, directrices:M.directrices, disclaimer:M.disclaimer } : null;
}
function marcaDeAds(d){
  const m = d && d.marcaId ? (workspace.marcas||[]).find(x => x.id === d.marcaId) : null;
  return m ? marcaParaIA(normalizarMarca(m)) : null;
}
// El objetivo de la campaña: el encargo guardado al generarla (o lo mínimo).
function objetivoDeAds(p, d){
  const b = (d && d.brief) || {};
  return { que: b.que || (d && d.nombre) || (p && p.nombre) || "", accion: b.accion || "", gancho: b.gancho || "",
    ctaUrl: b.ctaUrl || (d && d.urlFinal) || "", refs: b.refs || [], notas: b.notas || "", tipo: b.tipo || "comercial", legal: b.legal || "no" };
}
// Lo que la generación recibe del diagnóstico (liviano: sin adjuntos).
function aprendizajeDeAds(d){
  const dg = d && d.actual && d.actual.diagnostico; if(!dg) return null;
  return { resumen: dg.resumen, noHacer: dg.noHacer||[], problemas: (dg.problemas||[]).slice(0,6),
    convierten: dg.convierten||[], pausar: dg.pausar||[], negativas: dg.negativas||[] };
}
function asegurarAdsData(p){
  if(!p.adsData) p.adsData = { nombre:p.nombre||"", urlFinal:"", grupos:[], negativas:[], sitelinks:[] };
  return p.adsData;
}
function adsAbrirActual(){ adsVista = "actual"; renderAdsCampana(); }

// ── Lectura de archivos ────────────────────────────────────────────────
// Google Ads exporta CSV en UTF-8 o en UTF-16 (Ads Editor), y Excel.
function decodificarTexto(buf){
  const b = new Uint8Array(buf);
  if(b[0]===0xFF && b[1]===0xFE) return new TextDecoder("utf-16le").decode(b);
  if(b[0]===0xFE && b[1]===0xFF) return new TextDecoder("utf-16be").decode(b);
  let ceros = 0; for(let i=1;i<Math.min(b.length,400);i+=2) if(b[i]===0) ceros++;
  if(ceros > 60) return new TextDecoder("utf-16le").decode(b);
  return new TextDecoder("utf-8").decode(b);
}
// Excel (.xlsx) → texto separado por tabuladores (primera hoja). Sin librerías:
// se recorre el ZIP y se descomprime con DecompressionStream del navegador.
async function leerXLSXComoTSV(buf){
  const u = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1; for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error("no es un xlsx");
  const n = dv.getUint16(eocd+10,true); let off = dv.getUint32(eocd+16,true);
  const archivos = {};
  for(let k=0;k<n;k++){
    const met = dv.getUint16(off+10,true), csize = dv.getUint32(off+20,true);
    const ln = dv.getUint16(off+28,true), le = dv.getUint16(off+30,true), lc = dv.getUint16(off+32,true), loc = dv.getUint32(off+42,true);
    const nombre = new TextDecoder().decode(u.subarray(off+46, off+46+ln));
    archivos[nombre] = { met, csize, loc };
    off += 46+ln+le+lc;
  }
  const leer = async (nombre) => {
    const a = archivos[nombre]; if(!a) return "";
    const ini = a.loc + 30 + dv.getUint16(a.loc+26,true) + dv.getUint16(a.loc+28,true);
    const datos = u.subarray(ini, ini + a.csize);
    if(a.met === 0) return new TextDecoder().decode(datos);
    const ds = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(ds).text();
  };
  const xml = t => new DOMParser().parseFromString(t, "application/xml");
  const compartidas = [];
  const ss = await leer("xl/sharedStrings.xml");
  if(ss) xml(ss).querySelectorAll("si").forEach(si => compartidas.push(Array.from(si.getElementsByTagName("t")).map(t=>t.textContent).join("")));
  const hoja = Object.keys(archivos).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if(!hoja) throw new Error("xlsx sin hojas");
  const doc = xml(await leer(hoja));
  const colN = r => { let c = 0; for(const ch of String(r).replace(/\d+/g,"")) c = c*26 + (ch.charCodeAt(0)-64); return c-1; };
  const filas = [];
  doc.querySelectorAll("row").forEach(row => {
    const f = [];
    row.querySelectorAll("c").forEach(c => {
      const t = c.getAttribute("t"); const v = c.getElementsByTagName("v")[0];
      let val = t==="s" ? (compartidas[+((v&&v.textContent)||0)]||"") : t==="inlineStr" ? Array.from(c.getElementsByTagName("t")).map(x=>x.textContent).join("") : (v ? v.textContent : "");
      f[colN(c.getAttribute("r")||"A")] = String(val).replace(/[\t\r\n]+/g," ");
    });
    filas.push(Array.from(f, x => x==null ? "" : x).join("\t"));
  });
  return filas.join("\n");
}
// Capturas: se achican a ≤1600 px en JPEG (una captura de 4K pesa varios MB).
function reducirImagenArchivo(file, max){
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, (max||1600) / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
      const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0,0,c.width,c.height); cx.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagen ilegible")); };
    img.src = url;
  });
}
async function adsAdjuntarArchivos(files){
  const lista = Array.from(files || []);
  for(const f of lista){
    if(_adsAdj.length >= 10){ toast("Máximo 10 archivos por análisis"); break; }
    try{
      if(/^image\//.test(f.type)){
        if(_adsAdj.filter(a=>a.tipo==="img").length >= 6){ toast("Máximo 6 capturas"); continue; }
        _adsAdj.push({ tipo:"img", nombre: f.name || "captura.png", data: await reducirImagenArchivo(f, 1600), mime:"image/jpeg" });
      } else if(/\.xlsx$/i.test(f.name)){
        _adsAdj.push({ tipo:"tabla", nombre: f.name, texto: (await leerXLSXComoTSV(await f.arrayBuffer())).slice(0, 400000) });
      } else if(/\.(csv|tsv|txt)$/i.test(f.name) || /text|csv/.test(f.type)){
        _adsAdj.push({ tipo:"tabla", nombre: f.name, texto: decodificarTexto(await f.arrayBuffer()).slice(0, 400000) });
      } else toast("«"+f.name+"» no se puede leer: sube capturas (PNG/JPG), CSV o Excel");
    }catch(e){ toast("No se pudo leer «"+f.name+"»"); }
  }
  renderAdsCampana();
}
function adsQuitarAdj(i){ _adsAdj.splice(i,1); renderAdsCampana(); }
// Ctrl+V de una captura mientras está abierta la vista "Tu campaña actual".
document.addEventListener("paste", ev => {
  const p = (typeof pieza === "function") ? pieza() : null;
  if(!p || p.formato !== "ads" || adsVista !== "actual") return;
  const archivos = Array.from((ev.clipboardData && ev.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
  if(!archivos.length) return;   // el texto pegado sigue su camino normal
  ev.preventDefault();
  adsAdjuntarArchivos(archivos);
});

// ── La vista ───────────────────────────────────────────────────────────
function adsVistaActual(p, d){
  const dg = d.actual && d.actual.diagnostico;
  if(!dg || _adsActualEditando) return adsActualFormulario(p, d);
  const m = dg.metricas;
  const imp = { alto:"#b318a3", medio:"#c77700", bajo:"#5b6178" };
  const neg = dg.negativas||[];
  const pendientes = neg.filter(n => !n.aplicada).length;
  const chip = (b, t) => `<span class="adsc-stat"><b>${b}</b> ${t}</span>`;
  return `
    <div class="adsc-intent">
      <div class="adsc-eyebrow">Tu campaña actual · diagnóstico de Char-B · ${esc(fechaHora(d.actual.fecha))}</div>
      <div class="gnm">${esc(dg.resumen || "Diagnóstico listo")}</div>
      <div class="t">Objetivo que se respetó: ${esc(objetivoDeAds(p, d).que)}</div>
      ${m ? `<div class="adsc-chips" style="margin-top:10px;">${chip(fmtCLP(m.costo),"de costo")}${chip(m.clics,"clics")}${chip(fmtCLP(m.cpc),"CPC promedio")}${chip(m.conv,"conversiones")}${m.cpa?chip(fmtCLP(m.cpa),"por conversión"):""}${dg.gastoSinConversion?chip(fmtCLP(dg.gastoSinConversion),"gastado sin convertir"):""}</div>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button class="adsc-btn" onclick="adsRegenerarConAprendizaje()">${svgIcon("estrella",{size:"13px"})} ${(d.grupos||[]).length ? "Rearmar la campaña con este aprendizaje" : "Armar la campaña con este aprendizaje"}</button>
        <button class="adsc-copy" style="height:40px;" onclick="descargarCambiosAds()">${svgIcon("descargar",{size:"13px"})} Cambios para Ads Editor (XLSX)</button>
        <button class="adsc-copy" style="height:40px;" onclick="_adsActualEditando=true;renderAdsCampana()">Nuevo análisis</button>
        ${d._previa ? `<button class="adsc-copy" style="height:40px;" onclick="adsVolverVersionPrevia()">Volver a la versión anterior</button>` : ""}
      </div>
    </div>
    <div class="adsc-grid">
      <div>
        <div class="adsc-card">
          <h3>Qué está mal · por impacto</h3>
          ${(dg.problemas||[]).map(pr=>`<div class="adsc-item" style="display:block;">
            <div style="display:flex;gap:8px;align-items:baseline;"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${imp[pr.impacto]||imp.medio};">${esc(pr.impacto)}</span><b style="font-weight:600;color:#040764;">${esc(pr.titulo)}</b>${pr.ahorro?`<span class="adsc-cnt" style="margin-left:auto;">${esc(pr.ahorro)}</span>`:""}</div>
            ${pr.evidencia?`<div style="color:#5b6178;margin-top:3px;">${esc(pr.evidencia)}</div>`:""}</div>`).join("") || `<div style="font-size:13px;color:#5b6178;">Sin problemas detectados.</div>`}
        </div>
        <div class="adsc-card" style="margin-top:18px;">
          <h3>Lo que NO hay que repetir <span class="lim">Char-B lo usa al armar la campaña</span></h3>
          ${(dg.noHacer||[]).map(t=>`<div class="adsc-item"><span style="color:#b318a3;">✕</span><span class="tx">${esc(t)}</span></div>`).join("") || `<div style="font-size:13px;color:#5b6178;">—</div>`}
        </div>
        ${(dg.ajustes||[]).length ? `<div class="adsc-card" style="margin-top:18px;">
          <h3>Ajustes de configuración <span class="lim">se cambian en Google Ads</span></h3>
          ${dg.ajustes.map(a=>`<div class="adsc-item" style="display:block;"><b style="font-weight:600;color:#040764;">${esc(a.ajuste)}</b> → ${esc(a.recomendacion)}${a.motivo?`<div style="color:#5b6178;margin-top:2px;">${esc(a.motivo)}</div>`:""}</div>`).join("")}
        </div>` : ""}
      </div>
      <div>
        <div class="adsc-card">
          <h3>Negativas nuevas · ${neg.length} ${pendientes?`<button class="adsc-copy" onclick="adsAplicarNegativas()">Agregar ${pendientes} a esta campaña</button>`:""}</h3>
          ${neg.map((n,i)=>`<div class="adsc-item">
            <span class="adsc-neg" style="flex:none;">${esc(n.t)}</span>
            <span class="tx" style="color:#5b6178;">${esc(n.motivo||"")}${n.nivel && !/campa/i.test(n.nivel)?` · grupo «${esc(n.nivel)}»`:""}</span>
            ${n.gasto?`<span class="adsc-cnt" title="Lo que estas búsquedas gastaron sin convertir">${fmtCLP(n.gasto)}</span>`:""}
            ${n.aplicada?`<span class="adsc-cnt" style="background:#e4f6f6;color:#149a9a;">agregada</span>`:`<button class="adsc-copy" style="flex:none;" onclick="adsAplicarNegativas(${i})">+</button>`}
          </div>`).join("") || `<div style="font-size:13px;color:#5b6178;">Sin negativas nuevas.</div>`}
        </div>
        ${(dg.pausar||[]).length ? `<div class="adsc-card" style="margin-top:18px;"><h3>Keywords para pausar · ${dg.pausar.length}</h3>
          ${dg.pausar.map(k=>`<div class="adsc-item"><span class="tx"><b style="font-weight:600;">${esc(k.keyword)}</b>${k.grupo?` · ${esc(k.grupo)}`:""}<div style="color:#5b6178;">${esc(k.motivo||"")}</div></span></div>`).join("")}</div>` : ""}
        ${(dg.concordancia||[]).length ? `<div class="adsc-card" style="margin-top:18px;"><h3>Cambiar concordancia · ${dg.concordancia.length}</h3>
          ${dg.concordancia.map(k=>`<div class="adsc-item"><span class="tx"><b style="font-weight:600;">${esc(k.keyword)}</b> · ${esc(k.de)} → <b style="font-weight:600;color:#1c73cb;">${esc(k.a)}</b><div style="color:#5b6178;">${esc(k.motivo||"")}</div></span></div>`).join("")}</div>` : ""}
        ${(dg.anuncios||[]).length ? `<div class="adsc-card" style="margin-top:18px;"><h3>Anuncios</h3>
          ${dg.anuncios.map(a=>`<div class="adsc-item" style="display:block;"><b style="font-weight:600;color:#040764;">${esc(a.problema)}</b><div style="color:#5b6178;margin-top:2px;">${esc(a.recomendacion)}</div></div>`).join("")}</div>` : ""}
      </div>
    </div>
    <p class="adsc-nota">Fuentes del análisis: ${esc((d.actual.fuentes||[]).join(" · ") || "tu descripción")}. Las cifras salen de tus informes, calculadas por la app; Char-B interpreta y propone. My Ads no entra a tu cuenta de Google Ads: los cambios se aplican importando el XLSX en Google Ads Editor.</p>`;
}
function adsActualFormulario(p, d){
  const ob = objetivoDeAds(p, d);
  const n = d.actual && d.actual.notas || "";
  return `
    <div class="adsc-intent">
      <div class="adsc-eyebrow">Opcional · complemento de tu gestión</div>
      <div class="gnm">Trae tu campaña actual y Char-B te dice qué no repetir</div>
      <div class="r">Pega capturas de Google Ads (Ctrl+V), sube los informes que exportas (CSV o Excel: <b>términos de búsqueda</b> y <b>keywords</b> son los que más sirven) y cuéntale qué te parece mal. Char-B diagnostica, propone negativas y cambios, y guarda las lecciones para armar la campaña sin repetir los errores.</div>
    </div>
    <div class="adsc-grid">
      <div class="adsc-card">
        <h3>1 · Lo que ya corre</h3>
        <label id="ads-drop" class="ads-drop" ondragover="event.preventDefault();this.classList.add('on')" ondragleave="this.classList.remove('on')" ondrop="event.preventDefault();this.classList.remove('on');adsAdjuntarArchivos(event.dataTransfer.files)">
          <input type="file" id="ads-file" multiple accept="image/*,.csv,.tsv,.txt,.xlsx" style="display:none" onchange="adsAdjuntarArchivos(this.files);this.value=''">
          ${svgIcon("subir",{size:"22px"})}
          <span><b>Arrastra aquí</b> capturas o informes, <b>pega</b> una captura con Ctrl+V, o haz clic para elegir</span>
        </label>
        ${_adsAdj.length ? `<div style="margin-top:10px;">${_adsAdj.map((a,i)=>`<div class="adsc-item">${svgIcon(a.tipo==="img"?"imagen":"documento",{size:"14px"})}<span class="tx">${esc(a.nombre)} <span style="color:#5b6178;">· ${a.tipo==="img"?"captura":((a.texto.match(/\n/g)||[]).length+1)+" líneas"}</span></span><button class="adsc-copy" style="flex:none;" title="Quitar" onclick="adsQuitarAdj(${i})">✕</button></div>`).join("")}</div>` : ""}
      </div>
      <div class="adsc-card">
        <h3>2 · Qué te parece mal</h3>
        <textarea id="ads-actual-notas" class="ads-ta" rows="4" placeholder="Ej.: pago $2.000 por clic a la landing y casi no convierte; aparecemos en búsquedas de SOAP.">${esc(n)}</textarea>
        <h3 style="margin-top:14px;">3 · El objetivo de la campaña <span class="lim">manda sobre todo</span></h3>
        <textarea id="ads-actual-objetivo" class="ads-ta" rows="2" placeholder="Qué vendes y a quién">${esc(ob.que)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          <button class="adsc-btn" id="ads-analizar" onclick="adsAnalizarActual()">${svgIcon("barchart",{size:"14px"})} Analizar con Char-B</button>
          ${d.actual && d.actual.diagnostico ? `<button class="adsc-copy" style="height:40px;" onclick="_adsActualEditando=false;renderAdsCampana()">Ver el diagnóstico anterior</button>` : ""}
        </div>
        <div id="ads-actual-estado" style="font-size:13px;color:#5b6178;margin-top:10px;"></div>
      </div>
    </div>`;
}
const fmtCLP = n => (n==null || n==="") ? "—" : "$" + Math.round(+n).toLocaleString("es-CL");

// ── Acciones ───────────────────────────────────────────────────────────
async function adsAnalizarActual(){
  const p = pieza(); if(!p || p.formato!=="ads") return;
  const d = asegurarAdsData(p);
  const notas = (document.getElementById("ads-actual-notas")||{}).value || "";
  const objetivo = ((document.getElementById("ads-actual-objetivo")||{}).value || "").trim();
  if(!_adsAdj.length && !notas.trim()){ toast("Pega una captura, sube un informe o cuéntame qué está mal"); return; }
  if(!objetivo){ toast("Escribe el objetivo de la campaña: es lo que manda"); return; }
  d.brief = Object.assign(objetivoDeAds(p, d), { que: objetivo });
  const est = document.getElementById("ads-actual-estado"); const btn = document.getElementById("ads-analizar");
  if(btn) btn.disabled = true;
  if(est) est.textContent = "Char-B está leyendo tu campaña y cruzando las cifras… (puede tomar un minuto)";
  try{
    const r = await fetch("/api/ia", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ modo:"diagnostico", brief: d.brief, marca: marcaDeAds(d),
        actual: { notas, tablas: _adsAdj.filter(a=>a.tipo==="tabla").map(a=>({ nombre:a.nombre, texto:a.texto })),
                  imagenes: _adsAdj.filter(a=>a.tipo==="img").map(a=>({ nombre:a.nombre, mime:a.mime, data:a.data })) } }) });
    const data = await r.json().catch(()=>null);
    if(!r.ok || !data || !data.ok){ if(est) est.textContent = (data && data.error) || ("Error " + r.status); return; }
    d.actual = { fecha: Date.now(), notas, fuentes: _adsAdj.map(a=>a.nombre).concat(notas.trim()?["tu descripción"]:[]), diagnostico: data.diagnostico };
    _adsAdj = []; _adsActualEditando = false;
    persistir(); renderAdsCampana();
    if(Array.isArray(data.avisos) && data.avisos.length) mostrarAvisosIA(data.avisos);
    toast("Diagnóstico listo");
  }catch(e){ if(est) est.textContent = "Sin conexión con Char-B"; }
  finally{ const b = document.getElementById("ads-analizar"); if(b) b.disabled = false; }
}
// Negativas del diagnóstico → la campaña de la app (de campaña o del grupo que nombra).
function adsAplicarNegativas(i){
  const p = pieza(); const d = p && p.adsData; const dg = d && d.actual && d.actual.diagnostico; if(!dg) return;
  const lista = (i==null ? dg.negativas : [dg.negativas[i]]).filter(n => n && !n.aplicada);
  d.negativas = d.negativas || []; d.negativasMotivos = d.negativasMotivos || {};
  let n0 = 0;
  lista.forEach(n => {
    const g = n.nivel && !/campa/i.test(n.nivel) ? (d.grupos||[]).find(x => String(x.nombre).toLowerCase() === String(n.nivel).toLowerCase()) : null;
    const dest = g ? (g.negativas = g.negativas || []) : d.negativas;
    if(!dest.includes(n.t)){ dest.push(n.t); n0++; }
    if(n.motivo) d.negativasMotivos[n.t] = "Dato de tu campaña actual: " + n.motivo;
    n.aplicada = true;
  });
  persistir(); renderAdsCampana();
  toast(n0 ? n0 + " negativas agregadas a la campaña" : "Ya estaban en la campaña");
}
// Rearma la campaña con el objetivo guardado + el aprendizaje. La versión
// anterior queda en d._previa (Ctrl+Z no cubre adsData).
async function adsRegenerarConAprendizaje(){
  const p = pieza(); const d = p && p.adsData; if(!d || !d.actual) return;
  const ob = objetivoDeAds(p, d);
  if(!ob.que){ toast("Falta el objetivo de la campaña"); _adsActualEditando = true; renderAdsCampana(); return; }
  const btns = document.querySelectorAll(".adsc button"); btns.forEach(b => b.disabled = true);
  toast("Char-B está armando la campaña con el aprendizaje… (1 a 2 minutos)", 8000);
  try{
    const r = await fetch("/api/ia", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ producto:"ads", plataforma:"ads", formato:"ads", brief: Object.assign({}, ob, { aprendizaje: aprendizajeDeAds(d) }), marca: marcaDeAds(d) }) });
    const data = await r.json().catch(()=>null);
    if(!r.ok || !data || !data.ok){ toast((data && data.error) || "Char-B no pudo armar la campaña", 6000); return; }
    if((d.grupos||[]).length) d._previa = { grupos:d.grupos, negativas:d.negativas, sitelinks:d.sitelinks, negativasMotivos:d.negativasMotivos, analisis:d.analisis, nombre:d.nombre };
    Object.assign(d, { nombre:_deslug(data.nombre||d.nombre), grupos:data.grupos||[], negativas:data.negativas||[], sitelinks:data.sitelinks||[],
      analisis:data.analisis||null, negativasMotivos:data.negativasMotivos||{} });
    if(data.urlFinal) d.urlFinal = data.urlFinal;
    (d.actual.diagnostico.negativas||[]).forEach(n => { if(d.negativas.includes(n.t)) n.aplicada = true; });
    adsVista = "res"; persistir(); renderAdsCampana();
    if(Array.isArray(data.avisos) && data.avisos.length) mostrarAvisosIA(data.avisos);
    toast("Campaña lista, armada con tu objetivo y lo aprendido de la actual");
  }catch(e){ toast("Sin conexión con Char-B"); }
  finally{ document.querySelectorAll(".adsc button").forEach(b => b.disabled = false); }
}
function adsVolverVersionPrevia(){
  const p = pieza(); const d = p && p.adsData; if(!d || !d._previa) return;
  if(!confirm("¿Volver a la versión de la campaña anterior al último rearmado?")) return;
  Object.assign(d, d._previa); delete d._previa;
  persistir(); adsVista = "res"; renderAdsCampana(); toast("Volviste a la versión anterior");
}
// Los cambios del diagnóstico en una planilla para Google Ads Editor.
function descargarCambiosAds(){
  const p = pieza(); const d = p && p.adsData; const dg = d && d.actual && d.actual.diagnostico;
  if(!dg){ toast("Primero analiza tu campaña actual"); return; }
  const camp = (dg.campanas||[])[0] || d.nombre || p.nombre || "Campaña";
  const negs = [["Campaign","Ad Group","Keyword","Criterion Type"]];
  (dg.negativas||[]).forEach(n => negs.push([camp, n.nivel && !/campa/i.test(n.nivel) ? n.nivel : "", n.t, "Negative Phrase"]));
  const pausa = [["Campaign","Ad Group","Keyword","Status"]];
  (dg.pausar||[]).forEach(k => pausa.push([camp, k.grupo||"", k.keyword, "Paused"]));
  const conc = [["Keyword","Concordancia actual","Cambiar a","Motivo"]];
  (dg.concordancia||[]).forEach(k => conc.push([k.keyword, k.de, k.a, k.motivo||""]));
  const diag = [["Tipo","Qué","Detalle","Impacto / ahorro"]];
  (dg.problemas||[]).forEach(x => diag.push(["Problema", x.titulo, x.evidencia||"", [x.impacto, x.ahorro].filter(Boolean).join(" · ")]));
  (dg.ajustes||[]).forEach(x => diag.push(["Ajuste", x.ajuste, x.recomendacion + (x.motivo ? " — " + x.motivo : ""), ""]));
  (dg.anuncios||[]).forEach(x => diag.push(["Anuncio", x.problema, x.recomendacion, ""]));
  (dg.noHacer||[]).forEach(x => diag.push(["No repetir", x, "", ""]));
  (dg.negativas||[]).forEach(n => diag.push(["Negativa", n.t, n.motivo||"", n.gasto ? fmtCLP(n.gasto) + " sin convertir" : ""]));
  const hojas = [{ nombre:"Negativas", filas:negs }];
  if(pausa.length > 1) hojas.push({ nombre:"Pausar", filas:pausa });
  if(conc.length > 1) hojas.push({ nombre:"Concordancia", filas:conc });
  hojas.push({ nombre:"Diagnostico", filas:diag });
  descargarXLSX(slugify(camp)+"-cambios-google-ads.xlsx", hojas);
  toast("Cambios descargados · " + hojas.length + " hojas");
}

// Edición inline: cada texto editable guarda directo en p.adsData por ruta.
function adsEditar(el){
  const p = pieza(); if(!p || !p.adsData || !el.dataset.p) return;
  setPath(p.adsData, el.dataset.p, String(el.textContent||"").replace(/\s+/g," ").trim());
  persistir(); renderAdsCampana();
}
function adsToggleKw(gi, ki){
  const p = pieza(); if(!p || !p.adsData) return;
  const k = ((p.adsData.grupos||[])[gi]||{}).keywords; if(!k || !k[ki]) return;
  k[ki].tipo = k[ki].tipo==="frase" ? "exacta" : "frase";
  persistir(); renderAdsCampana();
}
// Alta y baja manual en cualquier lista de la campaña (keywords, titulares,
// descripciones, negativas de grupo o de campaña). La ruta apunta a adsData.
function adsAgregarEn(ruta){
  const p = pieza(); const d = p && p.adsData; if(!d) return;
  let lista = getPath(d, ruta);
  if(!Array.isArray(lista)){ lista = []; setPath(d, ruta, lista); }
  lista.push(/\.keywords$/.test(ruta) ? { t:"nueva keyword", tipo:"exacta" } : /negativas$/.test(ruta) ? "nueva negativa" : /titulares$/.test(ruta) ? "Nuevo titular" : "Nueva descripción");
  persistir(); renderAdsCampana();
}
function adsQuitarDe(ruta, i){
  const p = pieza(); const d = p && p.adsData; if(!d) return;
  const lista = getPath(d, ruta); if(!Array.isArray(lista) || !(i>=0 && i<lista.length)) return;
  lista.splice(i, 1);
  persistir(); renderAdsCampana();
}
function adsCopiar(que, gi){
  const p = pieza(); const d = p && p.adsData; if(!d) return;
  let txt = "";
  if(que==="negativas") txt = (d.negativas||[]).join("\n");
  else {
    const g = (d.grupos||[])[gi] || {};
    if(que==="keywords") txt = (g.keywords||[]).map(kwVisible).join("\n");
    else if(que==="negativasGrupo") txt = (g.negativas||[]).join("\n");
    else if(que==="titulares") txt = (g.titulares||[]).join("\n");
    else if(que==="descripciones") txt = (g.descripciones||[]).join("\n");
  }
  if(!txt){ toast("Nada que copiar"); return; }
  navigator.clipboard.writeText(txt).then(()=>toast("Copiado al portapapeles"));
}
// Resumen HTML descargable de la campaña (para revisar o compartir).
function generarHTMLDeAds(p){
  const d = p.adsData || { grupos:[], negativas:[] };
  const host = String(d.urlFinal||"").replace(/^https?:\/\//,"").split("/")[0];
  const grupos = (d.grupos||[]).map((g,i)=>`
  <section>
    <h2>Grupo ${i+1} · ${esc(_deslug(g.nombre))}</h2>
    <p class="int"><b>Intención:</b> ${esc(g.intencion||"")}${g.razonamiento?` — ${esc(g.razonamiento)}`:""}</p>
    <table><tr><th>Keyword</th><th>Concordancia</th></tr>${(g.keywords||[]).map(k=>`<tr><td>${esc(kwVisible(k))}</td><td>${k.tipo==="frase"?"Frase":"Exacta"}</td></tr>`).join("")}</table>
    <h3>Titulares (máx 30 caracteres)</h3><ol>${(g.titulares||[]).map(t=>`<li>${esc(t)} <span class="c">(${t.length})</span></li>`).join("")}</ol>
    <h3>Descripciones (máx 90 caracteres)</h3><ol>${(g.descripciones||[]).map(t=>`<li>${esc(t)} <span class="c">(${t.length})</span></li>`).join("")}</ol>
    ${(g.negativas||[]).length?`<h3>Negativas del grupo</h3><p>${g.negativas.map(esc).join(" · ")}</p>`:""}
    ${(g.path1||g.path2)?`<p class="c">Ruta visible: ${esc(host)}/${esc(g.path1||"")}${g.path2?"/"+esc(g.path2):""}</p>`:""}
  </section>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(_deslug(d.nombre)||p.nombre)}</title><style>
  body{font-family:Roboto,Arial,sans-serif;color:#12173d;max-width:880px;margin:34px auto;padding:0 22px;line-height:1.55;}
  h1{color:#040764;font-size:25px;margin:0 0 4px;} h2{color:#040764;font-size:18px;margin:36px 0 6px;} h3{font-size:14px;margin:18px 0 6px;}
  .sub{color:#5b6178;font-size:13px;margin:0 0 6px;} .int{background:#eef4fb;padding:10px 14px;font-size:13px;}
  table{border-collapse:collapse;width:100%;font-size:13px;} th,td{border:1px solid #e4e8f0;padding:6px 10px;text-align:left;} th{background:#eef1f6;color:#040764;}
  ol{font-size:13px;padding-left:22px;} ol li{margin:3px 0;} .c{color:#5b6178;font-size:11.5px;} a{color:#1c73cb;}
  </style></head><body>
  <h1>${esc(_deslug(d.nombre)||p.nombre)}</h1>
  <p class="sub">Campaña de Google Search · ${(d.grupos||[]).length} grupos de anuncios · solo concordancia exacta [ ] y de frase " "</p>
  ${d.urlFinal?`<p class="sub">Landing: <a href="${escAttr(d.urlFinal)}">${esc(d.urlFinal)}</a></p>`:""}
  ${grupos}
  <h2>Negativas de campaña</h2><p>${(d.negativas||[]).map(esc).join(" · ")||"—"}</p>
  </body></html>`;
}
