# Cómo trabajamos: borrador y producción

Documento corto y sin tecnicismos. Explica dónde se prueba, dónde vive lo real,
y cómo pasa una mejora de un lado al otro.

---

## Las dos copias

| | **Producción** | **Borrador** |
|---|---|---|
| Rama en GitHub | `main` | `sbb-draft-mejoras` |
| Dirección | simple-block-builder.gamonal.app | la URL de preview de Cloudflare |
| Quién la usa | tú y tu equipo, de verdad | solo para probar |
| Base de datos | `simple-block-builder` | `simple-block-builder-draft` |
| Imágenes (R2) | `zurich-chile` | `zurich-chile-draft` |

**Lo importante: no comparten datos.** Puedes romper lo que quieras en el
borrador — crear, borrar, exportar, generar con IA — y producción no se entera.

Antes de esto no era así: el borrador escribía en la misma base que producción,
así que una prueba podía sobrescribir tu espacio real. Quedó cerrado en
`wrangler.toml`, sección `[env.preview]`.

---

## Puntos de retorno (si algo sale mal)

Dos seguros, tomados el 13 de agosto de 2026 antes de tocar nada:

1. **El código**: rama congelada `respaldo-produccion-2026-08-13`, apuntando al
   commit `2f72775`. Nadie escribe ahí nunca; es la foto del día. Vuelve todo a
   como estaba con un comando.
2. **Tus datos**: fila `backup-20260813:hola@andresgamonal.com` en la base de
   producción — copia exacta de tu espacio (202.276 bytes). Ya existía otro
   respaldo del 22 de julio, que se conserva.

---

## Estado de los secretos del entorno Preview

- `GEMINI_API_KEY` — **cargada** (15-ago-2026). Char-B responde en el borrador.
- `RESEND_KEY` — pendiente. Solo hace falta si quieres probar "Enviar prueba"
  por correo desde el borrador; nada más depende de ella.

Recordatorio: los secretos NO se aplican a un deployment ya publicado. Cada vez
que agregues o cambies uno hay que volver a desplegar (basta un push) para que
lo tome. Esto vale igual para **producción**.

## Cómo se cargaron (por si hay que repetirlo)

En **Cloudflare → Workers & Pages → simple-block-builder → Settings →
Variables and Secrets** hay un selector **Production / Preview**. Los secretos
cargados en Production **no** se copian solos a Preview. Para que el borrador
funcione completo, cárgalos también en **Preview**:

- `JWT_SECRET` — sin esto el borrador igual deja entrar, pero con una clave de
  firma que está escrita en el código fuente: cualquiera con la URL podría
  entrar. Ponle un valor largo y distinto al de producción.
- `GEMINI_API_KEY` — sin esto Char-B no genera nada en el borrador.
- `RESEND_KEY` — solo si quieres probar "Enviar prueba" por correo.

Si prefieres, dime y te indico el paso a paso con capturas.

---

## El ciclo de trabajo

1. Yo hago los cambios en la rama `sbb-draft-mejoras`.
2. Cloudflare publica solo esa rama en la URL de preview.
3. Tú la pruebas. Si algo no te gusta, se corrige ahí mismo — producción sigue
   intacta todo este tiempo.
4. Cuando apruebas, recién ahí pasa a `main` y sale a producción (1-2 minutos).

Nada llega a producción sin que lo hayas visto funcionando antes.
