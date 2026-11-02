// AUDITORÍA ESTÁTICA del aplicativo entero.
// En un SPA de un solo archivo, casi todos los controles son onclick="fn(...)".
// Si `fn` no existe como global, el botón está MUERTO: no lanza error visible,
// simplemente no hace nada. Esto los encuentra todos de una pasada, sin recorrer
// la interfaz a mano. Igual con los íconos: data-ic="x" o svgIcon("x") con un
// nombre que no está en el registro deja un hueco.
const fs = require("fs");
const RAIZ = process.env.SBB_RAIZ || require("path").resolve(__dirname, "..");
const src = fs.readFileSync(RAIZ + "/editor.html", "utf8");

// ── 1 · Manejadores en el HTML ──────────────────────────────────────────
const atributos = ["onclick", "oninput", "onchange", "onsubmit", "onkeydown", "onblur", "onfocus", "ondblclick"];
const llamadas = new Set();
for (const at of atributos) {
  const re = new RegExp(at + '="([^"]*)"', "g");
  let m;
  while ((m = re.exec(src))) {
    // Extrae los identificadores llamados como función: nombre(
    const cuerpo = m[1];
    let f; const reF = /([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)\s*\(/g;
    while ((f = reF.exec(cuerpo))) llamadas.add(f[1]);
  }
}

// ── 2 · Declaraciones disponibles en el script ──────────────────────────
const declarados = new Set();
let d;
const reFn = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)/g;
while ((d = reFn.exec(src))) declarados.add(d[1]);
const reConst = /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)\s*=\s*(?:\(|async|function)/g;
while ((d = reConst.exec(src))) declarados.add(d[1]);
const reWin = /window\.([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)\s*=/g;
while ((d = reWin.exec(src))) declarados.add(d[1]);

// Globales del navegador y palabras clave que aparecen en los atributos
const NATIVAS = new Set(["alert","confirm","prompt","setTimeout","setInterval","fetch","event","stopPropagation",
  "preventDefault","focus","blur","select","click","reload","open","print","parseInt","parseFloat","String",
  "Number","Boolean","Array","Object","JSON","Math","Date","encodeURIComponent","decodeURIComponent","if","for",
  "while","return","typeof","this","querySelector","querySelectorAll","getElementById","classList","toggle","add",
  "remove","contains","closest","matches","map","filter","forEach","join","split","slice","trim","replace","test",
  "push","indexOf","includes","charAt","toLowerCase","toUpperCase","catch","then","console","log","warn","error"]);

const muertos = [...llamadas].filter(n => !declarados.has(n) && !NATIVAS.has(n)).sort();

// ── 3 · Íconos referenciados que no existen en el registro ──────────────
const registro = new Set();
const iBloque = src.indexOf("ICONOS_SVG");
if (iBloque > 0) {
  // claves del registro: nombre: `<svg…  o  "nombre":
  const trozo = src.slice(iBloque, iBloque + 40000);
  // El registro es  nombre: { nombre:"…", svg:'…' }  → la clave precede a "{"
  let k; const reK = /(?:^|[\n,])\s*["']?([a-zA-Z][\w-]*)["']?\s*:\s*\{\s*nombre/g;
  while ((k = reK.exec(trozo))) registro.add(k[1]);
}
// Se escanea el archivo SIN comentarios: un ejemplo dentro de un comentario
// ("<span class=ico data-ic=clave>") no es un icono que la app pinte, y contarlo
// daba un falso positivo.
const sinComentarios = src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");
const usados = new Set();
let u;
const reIc = /data-ic="([^"]+)"/g;
while ((u = reIc.exec(sinComentarios))) usados.add(u[1]);
const reSv = /svgIcon\(\s*["']([^"']+)["']/g;
while ((u = reSv.exec(sinComentarios))) usados.add(u[1]);
const iconosFaltantes = [...usados].filter(n => !registro.has(n)).sort();

// ── 4 · Rutas declaradas vs rutas servidas por _redirects ───────────────
const redir = fs.readFileSync(RAIZ + "/_redirects", "utf8");
const rutasCodigo = new Set();
let r;
const reRuta = /["'](\/[a-z0-9-]+)["']\s*:\s*\{/g;
while ((r = reRuta.exec(src))) rutasCodigo.add(r[1]);
const rutasServidas = new Set((redir.match(/^\/[a-z0-9-]+/gm) || []).map(x => x.trim()));
const rutasSinServir = [...rutasCodigo].filter(x => !rutasServidas.has(x)).sort();

// ── Informe ─────────────────────────────────────────────────────────────
console.log("AUDITORÍA ESTÁTICA · " + (src.length / 1024).toFixed(0) + " KB de editor.html\n");
console.log(`Manejadores distintos referenciados en el HTML: ${llamadas.size}`);
console.log(`Funciones/constantes declaradas:               ${declarados.size}`);
console.log(`\n1 · CONTROLES MUERTOS (llaman a algo que no existe): ${muertos.length}`);
muertos.forEach(n => {
  // ¿dónde se usa? primera aparición con contexto
  const i = src.indexOf(n + "(");
  const linea = src.slice(0, i).split("\n").length;
  const ctx = src.slice(Math.max(0, i - 90), i + 40).replace(/\s+/g, " ").slice(-110);
  console.log(`   ✗ ${n}()  línea ~${linea}\n       …${ctx}…`);
});
console.log(`\n2 · ÍCONOS QUE NO ESTÁN EN EL REGISTRO: ${iconosFaltantes.length}`);
iconosFaltantes.forEach(n => console.log(`   ✗ "${n}"`));
console.log(`\n3 · RUTAS DEL CÓDIGO QUE _redirects NO SIRVE: ${rutasSinServir.length}`);
rutasSinServir.forEach(n => console.log(`   ✗ ${n}  → recarga o enlace directo daría 404`));
console.log(`\nRutas declaradas: ${[...rutasCodigo].sort().join(" ")}`);
process.exit(muertos.length + iconosFaltantes.length + rutasSinServir.length ? 1 : 0);
