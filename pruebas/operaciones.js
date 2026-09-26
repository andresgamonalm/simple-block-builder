// CORRECCIONES POR PARTES (nucleo/operaciones.js) — sin navegador ni IA.
// Las operaciones que devuelve la IA se validan contra el esquema antes de
// tocar la campaña: lo inválido se rechaza con su motivo y lo demás se aplica.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const M = require(path.join(RAIZ, "nucleo/modelo.js"));
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
const R = require(path.join(RAIZ, "nucleo/reglas.js"));
const O = require(path.join(RAIZ, "nucleo/operaciones.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };
const ini = AE.importar(fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8")).iniciativa;
const c = ini.campanas[0], g = c.grupos[0], a = g.anuncios[0];
const huella = JSON.stringify(ini);

console.log("\n1 · Cambiar");
let r = O.aplicar(ini, [
  { op: "cambiar", id: a.titulos[6].id, campo: "texto", valor: "Deducible desde 3 UF" },
  { op: "cambiar", id: a.titulos[7].id, campo: "texto", valor: "Un título que claramente se pasa de treinta" },
  { op: "cambiar", id: g.keywords[0].id, campo: "concordancia", valor: "amplia" },
  { op: "cambiar", id: c.id, campo: "presupuestoDiario", valor: "25.000" },
  { op: "cambiar", id: g.id, campo: "id", valor: "grp_x" },
  { op: "cambiar", id: "tit_inventado", campo: "texto", valor: "Hola" }
]);
const t6 = r.iniciativa.campanas[0].grupos[0].anuncios[0].titulos[6];
T(t6.texto === "Deducible desde 3 UF" && r.iniciativa.campanas[0].presupuestoDiario === 25000, "cambia un título por su id y el presupuesto (\"25.000\" → 25000 CLP)");
T(r.aplicadas.length === 2 && r.rechazadas.length === 4, "4 rechazadas, cada una con su motivo", JSON.stringify(r.rechazadas.map(x => x.motivo)));
T(/máx 30/.test(r.rechazadas[0].motivo) && /exacta, frase/.test(r.rechazadas[1].motivo) && /no es un campo editable/.test(r.rechazadas[2].motivo) && /No existe/.test(r.rechazadas[3].motivo),
  "motivos: título de más de 30 · concordancia amplia (esta app no la usa) · el id no se edita · id inventado");
T(JSON.stringify(ini) === huella, "la iniciativa original no se toca (se devuelve una copia)");

console.log("\n2 · Agregar");
r = O.aplicar(ini, [
  { op: "agregar", en: g.id, lista: "keywords", elemento: { id: "kw_de_la_ia", texto: "seguro auto online", concordancia: "frase" } },
  { op: "agregar", en: c.id, lista: "keywords", elemento: { texto: "x" } },
  { op: "agregar", en: a.id, lista: "titulos", elemento: { texto: "Otro título" } },
  { op: "agregar", en: c.id, lista: "grupos", elemento: { nombre: "ao-comparar", intencion: "Compara precios",
      keywords: [{ texto: "comparar seguro auto", concordancia: "exacta" }],
      anuncios: [{ nombre: "ads-comparar", urlFinal: "https://www.acme.cl", titulos: [{ texto: "Compara y Ahorra", posicion: "1" }, { texto: "B" }, { texto: "C" }], descripciones: [{ texto: "Uno." }, { texto: "Dos." }] }] } }
]);
const kwN = r.iniciativa.campanas[0].grupos[0].keywords.slice(-1)[0];
T(kwN.texto === "seguro auto online" && kwN.id !== "kw_de_la_ia" && /^kw_/.test(kwN.id), "agrega una keyword; el id lo pone el modelo, no la IA");
T(/no tiene la lista «keywords»/.test(r.rechazadas[0].motivo) && /máximo de Google/.test(r.rechazadas[1].motivo), "no deja poner keywords en una campaña ni un título 16");
const gN = r.iniciativa.campanas[0].grupos.slice(-1)[0];
T(gN.nombre === "ao-comparar" && gN.keywords.length === 1 && gN.anuncios[0].titulos.length === 3 && gN.anuncios[0].titulos[0].posicion === "1" && /^rsa_/.test(gN.anuncios[0].id),
  "agrega un grupo entero con sus keywords y su anuncio (ids nuevos en todo)");
T(r.aplicadas.find(x => x.lista === "grupos").idNuevo === gN.id, "la operación devuelve el id que se creó");

console.log("\n3 · Quitar");
const neg = c.negativas.find(n => n.texto === "comprar auto");
const antes = R.validar(ini, { hoy: "2026-09-26" }).hallazgos.filter(h => h.codigo === "C01").length;
r = O.aplicar(ini, [{ op: "quitar", id: neg.id }]);
const despues = R.validar(r.iniciativa, { hoy: "2026-09-26" }).hallazgos.filter(h => h.codigo === "C01").length;
T(antes === 2 && despues === 0, "quitar la negativa «comprar auto» elimina los 2 errores que bloqueaba keywords propias", antes + " → " + despues);
T(O.aplicar(ini, [{ op: "quitar", id: ini.id }]).rechazadas.length === 1, "la iniciativa no se puede quitar");

console.log("\n4 · Protocolo: nombres fijos y UTM");
const i2 = M.nuevaIniciativa("x"), c2 = M.nuevaCampana(M.nombreCampana({ producto: "demo", tipo: "always-on" }));
const g2 = M.nuevoGrupo("ao-cotizar"), a2 = M.nuevoAnuncioRSA("ads-anual"); a2.urlFinal = "https://ejemplo.cl";
g2.anuncios.push(a2); c2.grupos.push(g2); c2.puja = "Maximize clicks"; i2.campanas.push(c2); M.aplicarUTM(i2);
r = O.aplicar(i2, [{ op: "cambiar", id: a2.id, campo: "nombre", valor: "ads-bienal" }]);
T(r.iniciativa.campanas[0].grupos[0].anuncios[0].sufijoUrlFinal.endsWith("utm_content=ads-bienal"), "renombrar el anuncio recalcula su utm_content");
r = O.aplicar(i2, [{ op: "cambiar", id: g2.id, campo: "nombre", valor: "ao-otro" }], { nombresFijos: [g2.id, c2.id] });
T(r.rechazadas.length === 1 && /duplicado/.test(r.rechazadas[0].motivo), "un grupo ya publicado no se renombra");

console.log("\n5 · Lo que ve la IA");
const res = O.resumen(ini);
T(res.includes("[" + g.id + "]") && res.includes("[" + a.id + "]") && res.split("\n").length < 20, "el índice lista campañas, grupos y anuncios con sus ids en pocas líneas");
const v = O.vista(ini, [a.id, a.titulos[2].id, g.keywords[0].id]);
T(v.length === 2 && v[0].entidad === "anuncio" && v[1].entidad === "keyword" && v[0].dentroDe.includes(g.id), "la vista trae solo lo pedido (el título ya va dentro de su anuncio) y dónde está");
T(JSON.stringify(v).length < JSON.stringify(ini).length / 20, `la vista pesa ${JSON.stringify(v).length} caracteres contra ${JSON.stringify(ini).length} de la campaña entera`);
const txt = O.operacionesParaIA();
T(txt.includes("cambiar") && txt.includes("grupo → keywords, negativas, anuncios") && txt.includes("titulo: texto(≤30)"), "las instrucciones para la IA salen del esquema (listas, campos y límites)");

console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
