// El contrato (CONTRATO-CAMPANA.md) se genera del esquema. Si alguien cambia el
// esquema y no regenera el documento, esta prueba lo grita.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const { contrato } = require(path.join(RAIZ, "nucleo/generar-contrato.js"));
const actual = fs.readFileSync(path.join(RAIZ, "CONTRATO-CAMPANA.md"), "utf8");
const ok = actual === contrato();
console.log(ok ? "  ok   CONTRATO-CAMPANA.md está al día con el esquema\n\nTODO BIEN · 1/1"
              : "  MAL  CONTRATO-CAMPANA.md quedó desactualizado: corre  node nucleo/generar-contrato.js\n\nFALLAN 1 · 0/1");
process.exit(ok ? 0 : 1);
