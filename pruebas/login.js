// LOGIN: que se pueda entrar con el USUARIO y también con el CORREO.
// Se prueba contra la lógica REAL de functions/api/_shared.js (buscarUsuario y
// verificarPassword) y la ficha real de usuarios.js — no con mocks, porque lo que
// falló fue justamente el emparejado del identificador.
const path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");

let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };

(async () => {
  const shared = await import("file://" + RAIZ + "/functions/api/_shared.js");
  const { buscarUsuario, verificarPassword, listaUsuarios } = shared;
  const usuarios = listaUsuarios();

  console.log("\n1 · Identificadores de cada ficha");
  usuarios.forEach(u => {
    const modo = (u.clave != null && u.clave !== "") ? "clave en texto" : "sal+hash";
    console.log(`  ${String(u.usuario).padEnd(10)} rol ${String(u.rol).padEnd(9)} workspace ${String(u.workspace || "(el usuario)").padEnd(26)} ${modo}`);
  });

  console.log("\n2 · Se entra con el USUARIO");
  usuarios.forEach(u => T(buscarUsuario(u.usuario) === u, `"${u.usuario}" encuentra su ficha`));
  T(buscarUsuario("ANDRES") && buscarUsuario("ANDRES").usuario === "andres", "no distingue mayúsculas");
  T(buscarUsuario("  andres  ") && buscarUsuario("  andres  ").usuario === "andres", "ignora espacios sobrantes");

  console.log("\n3 · Se entra con el CORREO (lo que el usuario tenía en la memoria)");
  const conCorreo = usuarios.filter(u => String(u.workspace || "").includes("@"));
  T(conCorreo.length > 0, "hay al menos una ficha con correo como workspace");
  conCorreo.forEach(u => {
    T(buscarUsuario(u.workspace) === u, `"${u.workspace}" encuentra a ${u.usuario}`);
    T(buscarUsuario(String(u.workspace).toUpperCase()) === u, "el correo tampoco distingue mayúsculas");
  });

  console.log("\n4 · Lo que NO debe entrar");
  T(buscarUsuario("") === null, "vacío no entra");
  T(buscarUsuario("   ") === null, "solo espacios no entra");
  T(buscarUsuario("noexiste") === null, "un usuario inventado no entra");
  T(buscarUsuario("otro@correo.cl") === null, "un correo que no es de nadie no entra");
  T(buscarUsuario("ws-lorena") === null, "un workspace que NO es correo no sirve como alias");
  T(buscarUsuario(null) === null, "null no entra");
  T(buscarUsuario(undefined) === null, "undefined no entra");
  // Un workspace repetido tiene que RECHAZARSE en vez de adivinar de quién es.
  const wss = usuarios.map(u => String(u.workspace || "").toLowerCase());
  T(new Set(wss).size === wss.length, "no hay workspaces duplicados en usuarios.js", wss.join(","));

  console.log("\n5 · La contraseña sigue mandando (el alias no abre ninguna puerta)");
  const conClave = usuarios.find(u => u.clave != null && u.clave !== "");
  if (conClave) {
    T(await verificarPassword(conClave, conClave.clave), `la contraseña correcta de "${conClave.usuario}" pasa`);
    T(!(await verificarPassword(conClave, conClave.clave + "x")), "una contraseña equivocada NO pasa");
    T(!(await verificarPassword(conClave, "")), "contraseña vacía no pasa");
  }
  const conHash = usuarios.find(u => u.hash);
  if (conHash) {
    T(!(await verificarPassword(conHash, "cualquier-cosa")), `"${conHash.usuario}" (sal+hash) rechaza una contraseña falsa`);
  }
  // Entrar por correo con la contraseña equivocada tiene que fallar igual.
  if (conCorreo.length) {
    const u = buscarUsuario(conCorreo[0].workspace);
    T(!(await verificarPassword(u, "clave-falsa-123")), "por correo, una contraseña falsa sigue siendo rechazada");
  }

  console.log("\n" + (mal ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.log("ERROR: " + e.message); process.exit(1); });
