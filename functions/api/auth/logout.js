import { json, corsPreflight, buildLogoutCookie } from '../_shared.js';

export const onRequestOptions = () => corsPreflight();

export const onRequestPost = () =>
  json({ ok: true }, 200, { 'Set-Cookie': buildLogoutCookie() });
