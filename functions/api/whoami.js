import { json, corsPreflight, getSesion, listaUsuarios } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const s = await getSesion(request, env);
  if (!s) return json({ ok: false, error: 'No autenticado' }, 401);
  const out = {
    ok: true,
    usuario: s.usuario,
    email: s.usuario,             // compat: la UI vieja muestra "email"
    rol: s.rol,
    permisos: s.permisos,
    isSuperAdmin: s.rol === 'admin',
  };
  // Solo el admin ve la lista de usuarios (sin sal/hash) y el estado del sistema.
  if (s.rol === 'admin') {
    out.usuarios = listaUsuarios().map(u => ({ usuario: u.usuario, rol: u.rol === 'admin' ? 'admin' : 'limitado', permisos: u.permisos || [], workspace: u.workspace || u.usuario }));
    out.config = {
      resendFrom: env.RESEND_FROM || '',
      siteUrl: env.SITE_URL || '',
      integraciones: { gemini: !!env.GEMINI_API_KEY, resend: !!env.RESEND_KEY, d1: !!env.DB, r2: !!env.IMAGENES },
    };
  }
  return json(out);
}
