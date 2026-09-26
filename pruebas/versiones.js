// VERSIONES Y ESTADOS (nucleo/versiones.js) — sin navegador.
// Sobre la campaña de referencia (copia anonimizada del CSV real):
//   estados y transiciones · huella · nombres fijos tras publicar ·
//   diferencias por id · archivo de SOLO CAMBIOS para Ads Editor.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const M = require(path.join(RAIZ, "nucleo/modelo.js"));
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
const V = require(path.join(RAIZ, "nucleo/versiones.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };
const ref = fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8");
const publicada = AE.importar(ref).iniciativa;
const copia = () => JSON.parse(JSON.stringify(publicada));
const filas = csv => csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);

console.log("\n1 · Estados");
T(V.puedePasar("borrador", "aprobada") && V.puedePasar("aprobada", "exportada") && V.puedePasar("exportada", "publicada"), "borrador → aprobada → exportada → publicada");
T(!V.puedePasar("borrador", "publicada") && !V.puedePasar("borrador", "exportada") && !V.puedePasar("aprobada", "publicada"), "no se salta pasos (no se publica ni exporta un borrador)");
T(V.puedePasar("publicada", "borrador") && V.puedePasar("exportada", "exportada") && V.puedePasar("archivada", "borrador"), "editar lo publicado vuelve a borrador · re-exportar · desarchivar");

console.log("\n2 · Huella de contenido");
const x = copia(); const c0 = x.campanas[0]; const reordenada = Object.fromEntries(Object.entries(c0).reverse()); x.campanas[0] = reordenada;
T(V.huella(x) === V.huella(publicada), "misma campaña con las claves en otro orden → misma huella (no crea versión)");
x.campanas[0].presupuestoDiario = 30000;
T(V.huella(x) !== V.huella(publicada), "cambia un monto → otra huella");

console.log("\n3 · Nombres fijos tras publicar");
const r = copia(); r.campanas[0].nombre = "chl-producto-auto-digital-always-on"; r.campanas[0].grupos[1].nombre = "ao-otro";
const nf = V.nombresFijos(publicada, r);
T(nf.length === 2 && nf[0].entidad === "campaña" && nf[1].entidad === "grupo", "renombrar una campaña o un grupo publicado se detecta (Ads Editor crearía un duplicado)", JSON.stringify(nf));
T(V.nombresFijos(publicada, copia()).length === 0, "sin renombres, nada que reclamar");

console.log("\n4 · Diferencias por id");
const e = copia(); const ce = e.campanas[0], ge = ce.grupos[0];
ce.presupuestoDiario = 30000;                                    // campaña modificada
ge.anuncios[0].titulos[3].texto = "Cotiza en 3 Minutos";         // anuncio reemplazado (cambia su contenido)
ge.keywords[0].urlFinal = "https://www.acme.cl/nueva";           // keyword modificada en su lugar
const kwQuitada = ge.keywords.splice(1, 1)[0];                    // keyword eliminada
ge.keywords[1].concordancia = ge.keywords[1].concordancia === "exacta" ? "frase" : "exacta";   // keyword reemplazada (otra concordancia)
ce.negativas.push(M.nuevaNegativa("arriendo", "frase"));         // negativa nueva
ce.destacados[0].texto = "Asistencia 24/7";                      // destacado reemplazado
const d = V.diferencias(publicada, e);
const hay = (cambio, entidad) => d.filter(z => z.cambio === cambio && z.entidad === entidad).length;
T(hay("modificado", "campaña") === 1 && hay("reemplazado", "anuncio") === 1 && hay("modificado", "keyword") === 1, "campaña modificada · anuncio reemplazado · keyword modificada", JSON.stringify(d.map(z => z.cambio + ":" + z.entidad)));
T(hay("eliminado", "keyword") === 1 && hay("reemplazado", "keyword") === 1 && hay("nuevo", "negativa de campaña") === 1 && hay("reemplazado", "destacado") === 1, "keyword eliminada y reemplazada · negativa nueva · destacado reemplazado");
T(d.length === 7, "ni un cambio de más: 7", d.length);
const regen = copia(); regen.campanas[0].grupos[0].anuncios[0].titulos.forEach(t => { t.id = M.uid("tit"); });
T(V.diferencias(publicada, regen).length === 0, "si la IA regenera ids de títulos sin cambiar el texto, NO cuenta como cambio");

console.log("\n5 · Archivo de SOLO CAMBIOS para Ads Editor");
const cam = V.cambiosParaEditor(publicada, e);
const csv = AE.exportar(cam.iniciativa), F = filas(csv);
T(cam.total === 7 && cam.resumen.nuevos === 1 && cam.resumen.modificados === 2 && cam.resumen.reemplazados === 3 && cam.resumen.eliminados === 1, "resumen: 1 nuevo · 2 modificados · 3 reemplazados · 1 eliminado", JSON.stringify(cam.resumen));
T(F.length - 1 < 20 && filas(AE.exportar(publicada)).length > 300, `el archivo de cambios tiene ${F.length - 1} filas (el completo, ${filas(AE.exportar(publicada)).length - 1})`);
const lineas = F.slice(1).join("\n");
T(/,30000,/.test(lineas) && (lineas.match(/Search \| Auto Digital \| Producto Always On,Search,/g) || []).length === 1, "la campaña modificada va con su fila (nuevo presupuesto)");
T(!/Promo 3 Cuotas,Search,/.test(lineas) && !lineas.includes("Promo 3 Cuotas"), "la campaña sin cambios no aparece");
T((lineas.match(/Removed/g) || []).length === 4, "4 filas «Removed»: el anuncio anterior, la keyword quitada, la keyword con la concordancia anterior y el destacado anterior", (lineas.match(/Removed/g) || []).length);
T(lineas.includes(kwQuitada.texto) && lineas.includes("Cotiza en 3 Minutos") && lineas.includes('"""arriendo"""') && lineas.includes("Asistencia 24/7"), "van la keyword quitada, el anuncio nuevo, la negativa nueva y el destacado nuevo");
T(!/,Chile,|Location ID/.test(lineas.replace(/^[^\n]*\n?/, "")) && !lineas.includes("Unknown"), "no repite ubicaciones ni edades que no cambiaron");
const vuelta = AE.importar(csv).iniciativa;
const kwv = vuelta.campanas[0].grupos[0].keywords;
T(kwv.some(k => k.texto === kwQuitada.texto && k.estado === "Removed") && vuelta.campanas[0].grupos[0].soloReferencia === true, "Ads Editor lo lee: la keyword con Status Removed, el grupo como referencia (sin fila propia)");
T(V.cambiosParaEditor(publicada, copia()).total === 0 && V.cambiosParaEditor(publicada, copia()).iniciativa.campanas.length === 0, "sin cambios → archivo vacío");

console.log("\n6 · Eliminar grupos, campañas, ubicaciones");
const q = copia(); q.campanas[0].grupos.pop(); q.campanas.pop(); q.campanas[0].ubicaciones.pop();
const cq = V.cambiosParaEditor(publicada, q), lq = filas(AE.exportar(cq.iniciativa)).slice(1).join("\n");
T(/,Removed,/.test(lq) && lq.includes("Promo 3 Cuotas") && cq.resumen.eliminados === 3, "grupo y campaña eliminados salen con estado «Removed»", JSON.stringify(cq.resumen));
T(cq.manual.length === 1 && /ubicación/.test(cq.manual[0]), "quitar una ubicación queda como instrucción a mano (el archivo no la expresa con seguridad)", JSON.stringify(cq.manual));

console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
