// PODA DE PROYECTOS VIEJOS (27-sep-2026) — sin navegador: se extraen las dos funciones de editor.html.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "editor.html"), "utf8");
const trozo = html.slice(html.indexOf('const PODA_ID'), html.indexOf('function recuperar()'));
const uid = () => Math.random().toString(36).slice(2);
const { podarProyectosUnaVez, normalizarWorkspace, PODA_ID } = new Function("uid", trozo + "\nreturn { podarProyectosUnaVez, normalizarWorkspace, PODA_ID };")(uid);
let ok = 0, mal = 0;
const T = (c, n) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n); } };
const ws = { proyectos: [{ id: "a", nombre: "Uno", piezas: [] }, { id: "b", nombre: "Dos", piezas: [] }], marcas: [{ id: "m" }], imagenes: [{ url: "x" }], papelera: [{ id: "z" }], perfil: { nombre: "A" }, _ts: 123 };
const r = normalizarWorkspace(ws);
T(r.proyectos.length === 0 && r.papelera.length === 3 && r.papelera.every(p => p.id === "z" || p.borradoTs), "los proyectos pasan a la Papelera (con fecha) y lo que ya estaba ahí se queda");
T(r.marcas.length === 1 && r.imagenes.length === 1 && r.perfil.nombre === "A", "marcas, fotos y perfil intactos");
T(r._ts === 123 && r._poda === PODA_ID, "no toca la fecha de sincronización y deja la bandera");
r.proyectos.push({ id: "c", nombre: "Nuevo", piezas: [] });
T(normalizarWorkspace(JSON.parse(JSON.stringify(r))).proyectos.length === 1, "no se repite: un proyecto creado después se conserva");
T(normalizarWorkspace(null)._poda === PODA_ID && normalizarWorkspace({ piezas: [{ id: "p" }] }).proyectos.length === 0, "espacio vacío nace con la bandera; formato viejo también se poda");
console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
