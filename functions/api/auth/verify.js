// Verifica un enlace mágico. Es un GET porque se llega haciendo click en
// el link del correo. Si el token es válido, marca el código como usado,
// crea cookie de sesión y redirige al editor.

import { sha256B64, signJWT, buildSessionCookie, isEmailAllowed } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const home = `${env.SITE_URL || ''}/editor.html`;
  const errorRedirect = `${env.SITE_URL || ''}/?login_error=`;

  if (!token) return Response.redirect(errorRedirect + 'sin_token', 302);
  if (!env.JWT_SECRET) return Response.redirect(errorRedirect + 'config', 302);

  try {
    const tokenHash = await sha256B64(token);
    const code = await env.DB
      .prepare('SELECT id, email, expira, usado FROM login_codes WHERE token_hash = ?')
      .bind(tokenHash)
      .first();

    if (!code)                                  return Response.redirect(errorRedirect + 'invalido', 302);
    if (code.usado)                             return Response.redirect(errorRedirect + 'ya_usado', 302);
    if (new Date(code.expira) < new Date())     return Response.redirect(errorRedirect + 'expirado', 302);
    if (!isEmailAllowed(code.email, env))       return Response.redirect(errorRedirect + 'no_permitido', 302);

    await env.DB.prepare('UPDATE login_codes SET usado = 1 WHERE id = ?').bind(code.id).run();

    const sessionToken = await signJWT({ email: code.email }, env.JWT_SECRET);
    return new Response(null, {
      status: 302,
      headers: {
        Location: home,
        'Set-Cookie': buildSessionCookie(sessionToken)
      }
    });
  } catch (e) {
    return Response.redirect(errorRedirect + encodeURIComponent(e.message || 'error'), 302);
  }
}
