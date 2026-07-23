// DESACTIVADO: el acceso por enlace mágico al correo fue reemplazado por
// usuario + contraseña (POST /api/auth/login, usuarios en usuarios.json).
import { json, corsPreflight } from '../_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestPost() {
  return json({ ok: false, error: 'El acceso por correo fue reemplazado: entra con tu usuario y contraseña.' }, 410);
}
