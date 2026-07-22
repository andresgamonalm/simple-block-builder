import { json, corsPreflight, getUserEmail, isSuperAdmin, getAllowedEmails } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const email = await getUserEmail(request, env);
  if (!email) return json({ ok: false, error: 'No autenticado' }, 401);
  const out = { ok: true, email, isSuperAdmin: isSuperAdmin(email, env) };
  // Extensión aditiva (rediseño Portal): datos reales para Permisos y Configuración.
  // Solo el super admin ve la lista de autorizados y el estado de integraciones.
  if (out.isSuperAdmin) {
    out.allowed = getAllowedEmails(env);
    out.superAdmin = (env.SUPER_ADMIN_EMAIL || 'hola@andresgamonal.com').toLowerCase();
    out.config = {
      resendFrom: env.RESEND_FROM || '',
      siteUrl: env.SITE_URL || '',
      integraciones: { gemini: !!env.GEMINI_API_KEY, resend: !!env.RESEND_KEY, d1: !!env.DB, r2: !!env.IMAGENES },
    };
  }
  return json(out);
}
