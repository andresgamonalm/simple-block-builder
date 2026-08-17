import { json, corsPreflight, getSesion, listaUsuarios, leerAccesos, leerUsoIA } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const s = await getSesion(request, env);
  if (!s) return json({ ok: false, error: 'No autenticado' }, 401);
  const out = {
    ok: true,
    usuario: s.usuario,
    nombre: s.nombre || null,
    email: s.usuario,             // compat: la UI vieja muestra "email"
    rol: s.rol,
    permisos: s.permisos,
    isSuperAdmin: s.rol === 'admin',
  };
  // Uso del asistente: es el dato que de verdad limita el trabajo del usuario,
  // así que cada uno ve el suyo (el historial del §05 lo muestra).
  try {
    const usados = await leerUsoIA(env, s.usuario);
    out.usoIA = { usados, limite: s.limiteIA };
  } catch {}
  // Solo el admin ve la lista de usuarios (sin sal/hash) y el estado del sistema.
  if (s.rol === 'admin') {
    // §03: el administrador "ve el historial completo".
    out.accesos = await leerAccesos(env, 120);
    out.usuarios = listaUsuarios().map(u => ({ usuario: u.usuario, rol: u.rol === 'admin' ? 'admin' : 'limitado', permisos: u.permisos || [], workspace: u.workspace || u.usuario }));
    out.config = {
      resendFrom: env.RESEND_FROM || '',
      siteUrl: env.SITE_URL || '',
      integraciones: { gemini: !!env.GEMINI_API_KEY, resend: !!env.RESEND_KEY, d1: !!env.DB, r2: !!env.IMAGENES },
    };
  }
  return json(out);
}
