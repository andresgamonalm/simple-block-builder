// Login por usuario + contraseña (usuarios.json del repo).
//   POST /api/auth/login { usuario, password } → cookie de sesión + { ok, usuario, rol, permisos }
// Mismo mensaje de error exista o no el usuario (no se regala información).

import { json, corsPreflight, buscarUsuario, verificarPassword, signJWT, buildSessionCookie } from '../_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const usuario = String(body.usuario || '').trim();
  const password = String(body.password || '');
  if (!usuario || !password) return json({ ok: false, error: 'Escribe tu usuario y tu contraseña.' }, 400);

  const u = buscarUsuario(usuario);
  const okPass = u ? await verificarPassword(u, password) : false;
  if (!u || !okPass) return json({ ok: false, error: 'Usuario o contraseña incorrectos.' }, 401);

  const jwt = await signJWT({ u: u.usuario }, env.JWT_SECRET || 'dev-only-secret');
  return json(
    { ok: true, usuario: u.usuario, rol: u.rol === 'admin' ? 'admin' : 'limitado', permisos: u.permisos || [] },
    200,
    { 'Set-Cookie': buildSessionCookie(jwt) }
  );
}
