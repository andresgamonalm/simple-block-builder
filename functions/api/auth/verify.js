// DESACTIVADO: el acceso por enlace mágico al correo fue reemplazado por
// usuario + contraseña (POST /api/auth/login, usuarios en usuarios.json).
export async function onRequestGet({ request, env }) {
  let base = env.SITE_URL || '';
  if (!base) { try { base = new URL(request.url).origin; } catch {} }
  return Response.redirect(base + '/?login_error=desactivado', 302);
}
