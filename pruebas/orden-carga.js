// ORDEN DE CARGA del editor (sin navegador). El código del editor está separado por
// función en funciones/** y editor.html lo carga como scripts CLÁSICOS que comparten el
// ámbito global, en un orden fijo. Esta prueba asegura que:
//   1. cada archivo existe y se puede leer como JavaScript;
//   2. ningún nombre global (const/let/función) se declara dos veces de forma incompatible;
//   3. nada que se EJECUTA al cargar (arranque, listeners, constantes calculadas) usa algo
//      de un archivo que todavía no se cargó — ni directamente ni a través de las funciones
//      que llama. Si alguien mueve una función de archivo o cambia el orden, aquí se ve.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const acorn = require(path.join(RAIZ, "node_modules/acorn"));
const walk = require(path.join(RAIZ, "node_modules/acorn-walk"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

const html = fs.readFileSync(path.join(RAIZ, "editor.html"), "utf8");
const archivos = [...html.matchAll(/<script src="\/(funciones\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
T(archivos.length >= 20, "editor.html carga el código desde funciones/ (" + archivos.length + " archivos)");
T(archivos[archivos.length - 1] === "funciones/comun/arranque.js", "el arranque es lo último que se carga");

const orden = [], pos = {};
let parseOk = true, dup = [];
archivos.forEach((f, fi) => {
  let ast;
  try { ast = acorn.parse(fs.readFileSync(path.join(RAIZ, f), "utf8"), { ecmaVersion: "latest", sourceType: "script" }); }
  catch (e) { parseOk = false; console.log("     " + f + ": " + e.message); return; }
  ast.body.forEach(n => {
    const i = orden.length; orden.push({ n, f, fi });
    const decl = (nombre, k) => { const prev = pos[nombre]; if (prev && (prev.k !== "fn" || k !== "fn")) dup.push(nombre + " (" + archivos[prev.fi] + " y " + f + ")"); if (!prev || k === "fn") pos[nombre] = { fi, k, i, n }; };
    if (n.type === "FunctionDeclaration") decl(n.id.name, "fn");
    if (n.type === "VariableDeclaration") n.declarations.forEach(d => decl(d.id.name, n.kind));
    if (n.type === "ClassDeclaration") decl(n.id.name, "class");
  });
});
T(parseOk, "todos los archivos existen y se leen como JavaScript");
T(dup.length === 0, "ningún nombre global declarado dos veces de forma incompatible", dup.join(", "));

const DIFERIDOS = ["addEventListener", "setTimeout", "setInterval", "requestAnimationFrame", "then", "MutationObserver"];
const esDiferida = (fn, padre) => padre && (padre.type === "CallExpression" || padre.type === "NewExpression") && padre.arguments.includes(fn) &&
  DIFERIDOS.includes(padre.callee.type === "MemberExpression" ? padre.callee.property.name : padre.callee.name);
function refs(node, saltarFunciones) {
  const out = new Set();
  walk.fullAncestor(node, (nd, st, anc) => {
    if (nd.type !== "Identifier") return;
    if (saltarFunciones && anc.some(a => /Function/.test(a.type))) return;
    if (anc.some((a, j) => /Function/.test(a.type) && esDiferida(a, anc[j - 1]))) return;
    const p = anc[anc.length - 2];
    if (p && p.type === "MemberExpression" && p.property === nd && !p.computed) return;
    if (p && p.type === "Property" && p.key === nd && !p.computed && !p.shorthand) return;
    out.add(nd.name);
  });
  return out;
}
const cache = {};
function cierre(nombre, visto) {
  if (visto.has(nombre)) return; visto.add(nombre);
  const b = pos[nombre]; if (!b || b.k !== "fn") return;
  for (const r of (cache[nombre] = cache[nombre] || refs(b.n.body, false))) cierre(r, visto);
}
const rotas = [];
orden.forEach((t, i) => {
  const n = t.n;
  if (n.type === "FunctionDeclaration") return;
  let directos = new Set();
  if (n.type === "VariableDeclaration") n.declarations.forEach(d => { if (d.init) refs(d.init, true).forEach(x => directos.add(x)); });
  else directos = refs(n, false);
  // «if (typeof X === "function") X()» ya se cuida solo: no es una dependencia de carga.
  walk.simple(n, { UnaryExpression(u) { if (u.operator === "typeof" && u.argument.type === "Identifier") directos.delete(u.argument.name); } });
  const vistos = new Set(); directos.forEach(r => cierre(r, vistos));
  for (const r of vistos) {
    const b = pos[r]; if (!b) continue;
    if (b.fi > t.fi) rotas.push(`${t.f} usa al cargar «${r}», que está en ${archivos[b.fi]} (se carga después)`);
    else if (b.fi === t.fi && b.k !== "fn" && b.i > i && directos.has(r)) rotas.push(`${t.f} usa «${r}» antes de declararlo`);
  }
});
T(rotas.length === 0, "nada se ejecuta al cargar usando algo que aún no se cargó", "\n       " + rotas.slice(0, 15).join("\n       "));
// Cada hoja de estilos enlazada existe.
const hojas = [...html.matchAll(/<link rel="stylesheet" href="\/(funciones\/[^"]+\.css)">/g)].map(m => m[1]);
T(hojas.length > 0 && hojas.every(h => fs.existsSync(path.join(RAIZ, h))), "las " + hojas.length + " hojas de estilo existen");
T(/COMPONENT STYLES/.test((html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || ""), "el CSS que viaja al exportar sigue en línea (primer <style>)");
console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
