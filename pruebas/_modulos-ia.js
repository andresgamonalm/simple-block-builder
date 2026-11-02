// Prepara los módulos de la IA para importarlos desde node en las pruebas.
// functions/ usa módulos ES dentro de un paquete CommonJS: se copian como .mjs a
// una carpeta temporal, ajustando las rutas de import. La IA vive repartida en
// functions/api/ia.js (la puerta) + functions/api/ia/*.js (por función).
const fs = require("fs"), path = require("path"), os = require("os");
module.exports = function prepararModulosIA(RAIZ, prefijo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefijo || "ia-"));
  fs.mkdirSync(path.join(dir, "api/ia"), { recursive: true });
  const nucleo = "'" + path.join(RAIZ, "nucleo") + "/";
  const cp = (src, dst, fix) => { let s = fs.readFileSync(path.join(RAIZ, src), "utf8"); if (fix) s = fix(s); fs.writeFileSync(path.join(dir, dst), s); };
  cp("functions/usuarios.js", "usuarios.mjs");
  cp("functions/api/_shared.js", "api/_shared.mjs", s => s.replace("'../usuarios.js'", "'../usuarios.mjs'"));
  cp("functions/api/ia.js", "api/ia.mjs", s => s.replace("'./_shared.js'", "'./_shared.mjs'").replace(/'\.\/ia\/([\w-]+)\.js'/g, "'./ia/$1.mjs'").replace(/'\.\.\/\.\.\/nucleo\//g, nucleo));
  for (const f of fs.readdirSync(path.join(RAIZ, "functions/api/ia")).filter(f => f.endsWith(".js")))
    cp("functions/api/ia/" + f, "api/ia/" + f.replace(/\.js$/, ".mjs"), s => s.replace("'../_shared.js'", "'../_shared.mjs'").replace(/'\.\/([\w-]+)\.js'/g, "'./$1.mjs'").replace(/'\.\.\/\.\.\/\.\.\/nucleo\//g, nucleo));
  return dir;
};
