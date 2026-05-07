// Solicita un enlace mágico para entrar.
// Siempre responde "ok" (incluso si el email no está permitido) para no
// revelar quién está en la lista.

import { json, corsPreflight, randomToken, sha256B64, isEmailAllowed, nowIso } from '../_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestPost({ request, env }) {
  try {
    const { email: emailRaw } = await request.json();
    const email = (emailRaw || '').trim().toLowerCase();
    if (!email) return json({ ok: false, error: 'Email requerido.' }, 400);

    // Si no está permitido, fingimos éxito para no filtrar la lista.
    if (!isEmailAllowed(email, env)) return json({ ok: true });

    const token = randomToken(32);
    const tokenHash = await sha256B64(token);
    const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

    await env.DB
      .prepare('INSERT INTO login_codes (email, token_hash, expira, fecha) VALUES (?, ?, ?, ?)')
      .bind(email, tokenHash, expira, nowIso())
      .run();

    const link = `${env.SITE_URL}/api/auth/verify?t=${encodeURIComponent(token)}`;
    const fromEmail = env.RESEND_FROM || 'Simple Block Builder <onboarding@resend.dev>';
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#ffffff">
      <h2 style="font-weight:600;margin:0 0 12px;color:#040764">Entrar a Simple Block Builder</h2>
      <p style="font-size:15px;line-height:1.5;color:#4a4a4a;margin:0 0 18px">Haz click en el botón para entrar. El enlace expira en 15 minutos.</p>
      <p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;padding:12px 22px;background:#040764;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Entrar</a></p>
      <p style="font-size:13px;color:#888;margin:0 0 6px">Si el botón no funciona, copia este enlace en tu navegador:</p>
      <p style="font-size:12px;color:#666;word-break:break-all;margin:0 0 14px">${link}</p>
      <p style="font-size:13px;color:#888;margin:0">Si no fuiste tú, ignora este correo.</p>
    </body></html>`;

    if (!env.RESEND_KEY) {
      console.error('RESEND_KEY no configurado en el entorno');
      return json({ ok: false, error: 'Servidor mal configurado: falta RESEND_KEY.' }, 500);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Entrar a Simple Block Builder',
        html
      })
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => '');
      console.error('Resend rechazó el envío:', resendRes.status, errBody);
      return json({
        ok: false,
        error: `Resend rechazó el envío (${resendRes.status}). ${errBody.slice(0, 300)}`
      }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
