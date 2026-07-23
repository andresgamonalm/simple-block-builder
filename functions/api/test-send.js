// Envía una prueba del HTML de una pieza a los correos indicados, vía Resend.
// Requiere sesión válida. Nota: con el remitente de pruebas de Resend
// (onboarding@resend.dev) solo llega al dueño de la cuenta; para enviar a
// cualquier destinatario hay que verificar un dominio propio en Resend.

import { json, corsPreflight, getSesion, tienePermiso } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestPost({ request, env }) {
  const s = await getSesion(request, env);
  if (!s) return json({ ok: false, error: 'No autenticado' }, 401);
  if (!tienePermiso(s, 'email')) return json({ ok: false, error: 'Tu usuario no tiene acceso al servicio de email.' }, 403);
  const email = s.ws;

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const destinatarios = Array.isArray(body.destinatarios)
    ? body.destinatarios.map(s => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  const html = typeof body.html === 'string' ? body.html : '';
  const asunto = (body.asunto || 'Prueba — Simple Block Builder').toString().slice(0, 150);

  const validos = destinatarios.filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (!validos.length) return json({ ok: false, error: 'Indica al menos un correo válido.' }, 400);
  if (!html) return json({ ok: false, error: 'La pieza no tiene contenido.' }, 400);
  if (html.length > 2_000_000) return json({ ok: false, error: 'El HTML es demasiado grande.' }, 413);
  if (!env.RESEND_KEY) return json({ ok: false, error: 'Servidor sin RESEND_KEY configurado.' }, 500);

  const from = env.RESEND_FROM || 'Simple Block Builder <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: validos, subject: asunto, html })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ ok: false, error: `Resend rechazó el envío (${res.status}). ${t.slice(0, 240)}` }, 502);
  }
  return json({ ok: true, enviados: validos.length });
}
