import { json, corsPreflight, getUserEmail, isSuperAdmin } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const email = await getUserEmail(request, env);
  if (!email) return json({ ok: false, error: 'No autenticado' }, 401);
  return json({ ok: true, email, isSuperAdmin: isSuperAdmin(email, env) });
}
