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
  return j({ ok:false, error:"mock sin ruta "+p }, 404);
}

function mockIA(body) {
  const modo = body.modo || "", prod = body.producto || "";
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
  let rel = url.pathname === "/" ? "/editor.html" : url.pathname;
  let f = path.join(RAIZ, rel);
  if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end("no"); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(RAIZ, "editor.html");
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
}).listen(PUERTO, () => console.log("srv en http://127.0.0.1:" + PUERTO));
