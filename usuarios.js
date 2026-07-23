// ═══════════════════════════════════════════════════════════════════════
// USUARIOS DE SIMPLE BLOCK BUILDER — edita este archivo directo en GitHub.
//
// Cada usuario es un bloque { ... }. Al guardar (commit en main) el cambio
// queda activo en 1-2 minutos (auto-deploy).
//
// CONTRASEÑA — dos formas, elige una por usuario:
//   (A) Simple:    "clave": "LaContraseñaQueInventes"
//       (queda legible para quien pueda ver este repositorio)
//   (B) Protegida: "sal" + "hash" — genera la línea en la app:
//       Configuración → "Generador de acceso" (la contraseña no queda legible).
//   Si un usuario tiene "clave", esa manda sobre sal/hash.
//
// "rol":      "admin" (todo + ve los espacios de los demás) o "limitado".
// "permisos": ["*"] = todos los servicios, o una lista con:
//             "email", "banner", "ads", "libre".
// "workspace": el espacio de proyectos del usuario. NO lo cambies después
//              de creado (el usuario dejaría de ver sus proyectos).
// ═══════════════════════════════════════════════════════════════════════
export default {
  usuarios: [
    {
      usuario: "andres",
      rol: "admin",
      permisos: ["*"],
      workspace: "hola@andresgamonal.com",
      sal: "f47421c0741305d5",
      hash: "440065259d127367c6b38c1725f53b28bc5c788d3bc55a0841ea3c369e276d5a"
    },
    {
      usuario: "equipo",
      rol: "limitado",
      permisos: ["email", "banner"],
      workspace: "ws-equipo",
      sal: "7b7a481b252594d0",
      hash: "b19e7bf3ea2cfcc7a12f5ac22380934ec44a6880a1fb0f88f585e92b595a7426"
    }
  ]
};
