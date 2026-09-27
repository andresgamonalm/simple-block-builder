// Server local para verificar el aplicativo con Playwright.
// Sirve el repo tal cual + mocks de /api/*. Las imágenes externas están
// bloqueadas en el sandbox, así que /foto.svg y /logo.svg son locales.
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = process.argv[2] || require("path").resolve(__dirname, "..");
const PUERTO = parseInt(process.argv[3] || "8099", 10);

const MIME = { ".html":"text/html;charset=utf-8", ".js":"text/javascript;charset=utf-8",
  ".css":"text/css;charset=utf-8", ".json":"application/json;charset=utf-8",
  ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".ico":"image/x-icon" };

const FOTO = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a5f8f"/><stop offset="1" stop-color="#8fb0c9"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#g)"/>
  <circle cx="1150" cy="420" r="230" fill="#e8d9c0"/>
  <rect x="980" y="640" width="340" height="360" rx="30" fill="#c9a883"/>
</svg>`;
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">
  <rect width="420" height="120" fill="none"/>
  <circle cx="60" cy="60" r="40" fill="#ffffff"/>
  <rect x="120" y="40" width="270" height="18" fill="#ffffff"/>
  <rect x="120" y="70" width="180" height="12" fill="#ffffff" opacity=".8"/>
</svg>`;

const WS = {
  proyectos: [], marcas: [], banner: {}, imagenes: [
    { url:"/foto.svg", nombre:"fotos-generales/persona-auto.svg" },
    { url:"/foto2.svg", nombre:"fotos-seguros/familia.svg" }
  ], papelera: [], perfil: { nombre:"Andrés" }, _ts: 1
};

let guardado = null;

function api(req, res, url) {
  const j = (o, s=200) => { res.writeHead(s, {"content-type":"application/json;charset=utf-8"}); res.end(JSON.stringify(o)); };
  const p = url.pathname;
  // La pantalla de acceso necesita poder probarse SIN sesión. La prueba pone
  // la galleta sbb-sin-sesion y entonces whoami responde 401, como en vivo.
  if (p === "/api/whoami" && /sbb-sin-sesion=1/.test(req.headers.cookie || "")) {
    return j({ ok:false, error:"No autenticado" }, 401);
  }
  if (p === "/api/auth/login") {
    let b=""; req.on("data",d=>b+=d);
    req.on("end",()=>{ let c={}; try{ c=JSON.parse(b); }catch{}
      if (c.usuario === "andres" && c.password === "correcta") {
        // Entrar ABRE la sesión: se apaga la galleta de "sin sesión" para que
        // el escritorio no rebote de vuelta al formulario, igual que en vivo.
        res.writeHead(200, {"content-type":"application/json;charset=utf-8",
                            "set-cookie":"sbb-sin-sesion=0; Path=/"});
        return res.end(JSON.stringify({ ok:true, usuario:"andres", rol:"admin", permisos:["*"] }));
      }
      j({ ok:false, error:"Usuario o contraseña incorrectos." }, 401);
    });
    return;
  }
  if (p === "/api/whoami") return j({ ok:true, usuario:"andres", nombre:"Andrés", email:"andres",
      rol:"admin", permisos:["*"], isSuperAdmin:true,
      usuarios:[{usuario:"andres",rol:"admin",permisos:["*"],workspace:"andres"}],
      config:{ resendFrom:"", siteUrl:"", integraciones:{gemini:true,resend:false,d1:true,r2:true} } });
  if (p === "/api/proyectos") {
    if (req.method === "POST") { let b=""; req.on("data",d=>b+=d); req.on("end",()=>{ try{guardado=JSON.parse(b);}catch{} j({ok:true,actualizado_en:new Date().toISOString()}); }); return; }
    if (url.searchParams.get("todos") === "1") return j({ ok:true, espacios:[] });
    return j({ ok:true, proyecto: guardado ? guardado.proyecto : WS, actualizado_en:null });
  }
  if (p === "/api/upload") {
    if (url.searchParams.get("list") === "1") return j({ ok:true, imagenes: WS.imagenes });
    return j({ ok:true, url:"/foto.svg" });
  }
  if (p === "/api/ia") { let b=""; req.on("data",d=>b+=d); req.on("end",()=>{ try{ j(mockIA(JSON.parse(b))); }catch(e){ j({ok:false,error:String(e)},500); } }); return; }
  if (p === "/api/iniciativas") {
    if (req.method === "POST") { let b=""; req.on("data",d=>b+=d); req.on("end",()=>{ try{ const r = mockIniciativas(JSON.parse(b)); j(r, r._s || 200); }catch(e){ j({ok:false,error:String(e)},500); } }); return; }
    return j(mockIniciativasGet(url));
  }
  return j({ ok:false, error:"mock sin ruta "+p }, 404);
}

/* ── Campañas de Search (/campanas): iniciativas con versiones, en memoria ── */
const NUC = require("path").resolve(__dirname, "..", "nucleo");
const INI = {};   // id → { meta, versiones:{n: json} , eventos:[] }
const pub = m => ({ id:m.id, nombre:m.nombre, estado:m.estado, version:m.version, exportada_version:m.exportada_version||null,
  publicada_version:m.publicada_version||null, creado_en:m.creado_en, actualizado_en:m.actualizado_en, actualizado_por:"andres" });
function mockIniciativasGet(url) {
  const id = url.searchParams.get("id");
  if (!id) return { ok:true, iniciativas:Object.values(INI).map(x => pub(x.meta)).reverse() };
  const x = INI[id]; if (!x) return { ok:false, error:"No existe esa iniciativa" };
  if (url.searchParams.get("historial") === "1") return { ok:true, meta:pub(x.meta),
    versiones:Object.keys(x.versiones).map(Number).sort((a,b)=>b-a).map(v => ({ version:v, nota:x.notas[v]||"", autor:"andres", creado_en:x.meta.actualizado_en })), eventos:[] };
  const v = url.searchParams.has("version") ? parseInt(url.searchParams.get("version"),10) : x.meta.version;
  if (!x.versiones[v]) return { ok:false, error:"Versión no encontrada" };
  return { ok:true, meta:pub(x.meta), version:v, iniciativa:JSON.parse(x.versiones[v]) };
}
function mockIniciativas(b) {
  const V = require(NUC + "/versiones.js"), R = require(NUC + "/reglas.js");
  const ahora = new Date().toISOString();
  if (b.accion === "guardar") {
    const ini = b.iniciativa, x = INI[ini.id];
    if (!x) { INI[ini.id] = { meta:{ id:ini.id, nombre:ini.nombre, estado:"borrador", version:1, creado_en:ahora, actualizado_en:ahora }, versiones:{1:JSON.stringify(ini)}, notas:{1:b.nota||""} }; return { ok:true, version:1, estado:"borrador", creada:true }; }
    if (Number(b.base) !== x.meta.version) return { ok:false, conflicto:true, version:x.meta.version, error:"Conflicto de versión", _s:409 };
    if (V.huella(JSON.parse(x.versiones[x.meta.version])) === V.huella(ini)) return { ok:true, version:x.meta.version, estado:x.meta.estado, sinCambios:true };
    const volvio = x.meta.estado !== "borrador", v = x.meta.version + 1;
    x.versiones[v] = JSON.stringify(ini); x.notas[v] = b.nota || "";
    Object.assign(x.meta, { version:v, estado:"borrador", nombre:ini.nombre, actualizado_en:ahora });
    return { ok:true, version:v, estado:"borrador", volvioABorrador:volvio };
  }
  if (b.accion === "estado") {
    const x = INI[b.id]; if (!x) return { ok:false, error:"No existe", _s:404 };
    if (Number(b.base) !== x.meta.version) return { ok:false, conflicto:true, error:"Conflicto", _s:409 };
    if (!V.puedePasar(x.meta.estado, b.estado)) return { ok:false, error:"Transición no permitida", _s:422 };
    if (b.estado === "aprobada" || b.estado === "exportada") {
      const r = R.validar(JSON.parse(x.versiones[x.meta.version]), { hoy:ahora.slice(0,10) });
      if (!r.exportable) return { ok:false, error:"Tiene " + r.errores + " error(es) que Google rechazaría.", hallazgos:r.hallazgos.filter(h=>h.nivel==="error"), _s:422 };
      if (b.estado === "exportada") x.meta.exportada_version = x.meta.version;
    }
    if (b.estado === "publicada") { if (x.meta.exportada_version !== x.meta.version) return { ok:false, error:"Solo se publica la versión exportada.", _s:422 }; x.meta.publicada_version = x.meta.version; }
    x.meta.estado = b.estado;
    return { ok:true, estado:b.estado, version:x.meta.version, exportada_version:x.meta.exportada_version||null, publicada_version:x.meta.publicada_version||null };
  }
  return { ok:false, error:"Acción desconocida", _s:400 };
}
// Salida del pipeline de Search tal como la entrega ia.js a campana-ia.js (datos genéricos, marca "Acme").
function datosCampanaMock() {
  const fijos = ["Seguro de auto Acme","Acme: seguro auto online","Seguro auto digital Acme","Contrata tu seguro Acme","Acme seguro automotriz"];
  const rota = n => ["Contrata en minutos","Sin inspección presencial","Paga en cuotas mensuales","Cotiza y contrata hoy","Asistencia en ruta 24/7",
    "Liquidación en línea","Elige tu deducible","Cobertura desde el primer día","Todo desde tu celular","Grúa incluida en tu plan"].map(t => n ? t.replace("hoy","ahora") : t);
  const grupo = (nombre, angulo, kws) => ({ nombre, intencion:"contratar un seguro de auto online ahora", razonamiento:"búsqueda de compra directa", angulo,
    keywords:kws.map((t,i)=>({t, tipo:i%2?"frase":"exacta"})), negativas:["gratis"], titularesFijos:fijos, titularesRotan:rota(0),
    descripciones:["Contrata tu seguro de auto 100 % online, sin inspección presencial.","Asistencia en ruta 24/7 y liquidación en línea. Contrata hoy."],
    path1:"seguro", path2:"auto",
    anuncioB:{ angulo:"respaldo", titularesRotan:["Liquidación en línea","Asistencia en ruta 24/7","Grúa incluida en tu plan","Taller en convenio","Respaldo de Acme","Auto de reemplazo","Contrata en minutos","Paga en cuotas mensuales","Cobertura desde el primer día","Elige tu deducible"],
      descripciones:["Si chocas, liquidas en línea y te acompaña la asistencia 24/7.","Contrata online y queda cubierto desde el primer día."] } });
  const roles = {}; ["Contrata en minutos","Sin inspección presencial","Todo desde tu celular"].forEach(t=>roles[t]="tramite");
  ["Paga en cuotas mensuales","Elige tu deducible"].forEach(t=>roles[t]="precio"); ["Asistencia en ruta 24/7","Liquidación en línea","Grúa incluida en tu plan"].forEach(t=>roles[t]="respaldo");
  fijos.forEach(t=>roles[t]="keyword"); roles["Cotiza y contrata hoy"]="cta";
  return { nombre:"Auto digital", urlFinal:"https://ejemplo.cl/seguro-auto",
    grupos:[grupo("contratar online","tramite",["seguro auto online","seguro automotriz online","contratar seguro auto","seguro de auto digital"]),
            grupo("precio cuotas","precio",["seguro auto cuotas","precio seguro auto","seguro auto barato","cotizar seguro auto"])],
    negativas:["trabajo","empleo","soap"], negativasMotivos:{ trabajo:"búsqueda de empleo", empleo:"búsqueda de empleo", soap:"SOAP fuera de temporada" },
    sitelinks:[1,2,3,4].map(i=>({ texto:["Coberturas","Asistencias","Preguntas","Siniestros"][i-1], desc1:"Conoce el detalle", desc2:"Todo en línea", url:"https://ejemplo.cl/p"+i })),
    destacados:["Sin inspección","100 % online","Pago en cuotas","Asistencia 24/7"], rolesTitulos:roles };
}
function mockIA(body) {
  const modo = body.modo || "", prod = body.producto || "";
  if (modo === "campana") {
    const CIA = require(NUC + "/campana-ia.js"), R = require(NUC + "/reglas.js");
    const o = body.opciones || {}, br = body.brief || {};
    const ficha = { producto:"seguro auto digital", competidores:[{nombre:"Otra Aseguradora",promesa:"precio bajo"}], noOfrece:["soap"],
      evidencia:{ tramite:["Contratación 100 % online"], precio:[], respaldo:["Asistencia 24/7"] }, momentos:["auto recién comprado"], fuentes:[br.ctaUrl] };
    const ini = CIA.iniciativaDesdeIA(datosCampanaMock(), { objetivo:{ que:br.que, accion:br.accion, gancho:br.gancho, ctaUrl:br.ctaUrl, notas:br.notas, producto:o.producto, tipo:o.tipo, enfoque:o.enfoque === "" ? "" : "conversion" },
      ficha, presupuestoDiario:o.presupuestoDiario, puja:o.puja });
    if (o.nombre) ini.nombre = o.nombre;
    return { ok:true, iniciativa:ini, validacion:R.validar(ini, {}), avisos:[{ texto:"No encontré precio visible en la landing: los anuncios van sin precio." }], ortografia:"revisada" };
  }
  if (modo === "corregir") {
    const OPS = require(NUC + "/operaciones.js");
    const ids = body.ids || [], ops = [];
    for (const id of ids) { const u = OPS.ubicar(body.iniciativa, id); if (u && u.obj && typeof u.obj.texto === "string" && (u.entidad === "titulo" || u.entidad === "descripcion")) ops.push({ op:"cambiar", id, campo:"texto", valor:u.entidad === "titulo" ? "Contrata sin inspección" : "Contrata online y queda cubierto hoy, sin inspección presencial." }); }
    if (!ops.length) { const c = body.iniciativa.campanas[0]; ops.push({ op:"agregar", en:c.id, lista:"negativas", elemento:{ texto:"usado", concordancia:"frase", comentario:"no vendemos autos" } }); }
    const r = OPS.aplicar(body.iniciativa, ops, {});
    return { ok:true, explicacion:"Cambié solo lo que pediste.", iniciativa:r.iniciativa, aplicadas:r.aplicadas, rechazadas:r.rechazadas, tocados:r.tocados, parcial:true, erroresNuevos:[], ortografia:"revisada" };
  }
  if (modo === "investigar") {
    const f = Object.assign({}, body.iniciativa.ficha || {}); f.condiciones = ["Cuotas según plan"];
    return { ok:true, respuesta:"La web indica pago en cuotas según el plan.", ficha:f, cambiados:["condiciones"], fuentes:["https://ejemplo.cl/seguro-auto"] };
  }
  if (modo === "concepto") return { ok:true, nombre:"Tarifas renovadas", concepto:{ idea:"La tarifa baja, la protección no", titular:"Tu auto protegido por menos", mensajes:["Cotiza en 3 minutos","Cobertura desde el día uno"] } };
  if (modo === "textos") return { ok:true, titular:"Tu auto protegido por menos", cuerpo:"Cotiza en línea y elige tu plan en minutos", cta:"Cotiza aquí" };
  if (prod === "banner") return { ok:true, nombre:"Seguro Auto Digital", zonas:{ etiqueta:"Seguro", titular:"Tu auto protegido por menos", cuerpo:"Cotiza en línea y elige tu plan en minutos", cta:"Cotiza aquí" }, burbuja:"2 Cuotas Gratis", imagen:"/foto.svg" };
  if (prod === "ads") return { ok:true, nombre:"Auto Digital", urlFinal:"https://ejemplo.cl/auto", grupos:[{ nombre:"Seguro auto digital", intencion:"contratar seguro de auto en línea", razonamiento:"búsquedas con intención de compra", keywords:[{t:"seguro automotriz online",tipo:"exacta"},{t:"cotizar seguro de auto",tipo:"frase"}], negativas:["gratis"], titulares:["Seguro Auto Digital","Cotiza en 3 minutos"], descripciones:["Contrata en línea y queda cubierto hoy mismo."], path1:"auto", path2:"digital" }], negativas:["trabajo","empleo"] };
  return { ok:true, nombre:"Campaña", bloques:[] };
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  if (url.pathname === "/foto.svg" || url.pathname === "/foto2.svg") { res.writeHead(200,{"content-type":"image/svg+xml"}); return res.end(FOTO); }
  if (url.pathname === "/logo.svg") { res.writeHead(200,{"content-type":"image/svg+xml"}); return res.end(LOGO); }
  let rel = url.pathname === "/" ? "/editor.html" : /^\/campanas(\/|$)/.test(url.pathname) ? "/campanas.html" : url.pathname;
  let f = path.join(RAIZ, rel);
  if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end("no"); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(RAIZ, "editor.html");
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
}).listen(PUERTO, () => console.log("srv en http://127.0.0.1:" + PUERTO));
