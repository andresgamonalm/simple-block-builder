# My Ads — mapa del proyecto

My Ads arma publicidad pagada para **Google Display**, **Facebook Ads** y **Google Search**
(más la «Campaña completa», que junta las tres). Corre en Cloudflare Pages + D1:
`https://my-ads.gamonal.app`. La memoria de trabajo para la IA está en `CLAUDE.md`.

## Quiero cambiar X, abro Y

| Quiero cambiar | Abro |
|---|---|
| Los tamaños de **Google Display** (los 11) | `funciones/display/config.js` |
| Los tamaños de **Facebook** o el contador de sus textos | `funciones/facebook/config.js` · `funciones/facebook/estilos.css` |
| Las pantallas de **Campañas de Search** (crear, trabajar, exportar) | `funciones/search/campanas.js` · `funciones/search/campanas.css` |
| La consola de Search de piezas guardadas / «Tu campaña actual» | `funciones/search/consola.js` · `funciones/search/consola.css` |
| Qué hace la tarjeta **Campaña completa** | `funciones/campana-completa/crear.js` |
| Qué abre cada tarjeta del Inicio | `funciones/comun/dashboard.js` → `crearConIA` |
| Cómo se diseña, arrastra y **replica** un banner (Display y Facebook) | `funciones/comun/banners/lienzo-libre.js` |
| El panel de edición del banner y sus plantillas | `funciones/comun/banners/panel.js` |
| Exportar banners (ZIP, HTML5, PNG/JPG) | `funciones/comun/banners/exportar.js` |
| La revisión automática de cada banner (inspector) | `funciones/comun/banners/inspector.js` |
| Lo que la IA escribe para un banner | `functions/api/ia/display.js` (servidor) y `funciones/comun/banners/ia-banner.js` (cómo se coloca) |
| Lo que la IA hace en Search | `functions/api/ia/search.js` y la lección en `nucleo/lecciones.js` |
| Las reglas que revisan una campaña de Search | `nucleo/reglas.js` |
| Colores y tipografía de la interfaz | `funciones/comun/estilos/interfaz.css` |
| Marcas · Fotos · Proyectos · Inicio | `funciones/comun/marcas.js` · `imagenes.js` · `dashboard.js` |
| Usuarios y contraseñas | `functions/usuarios.js` (no lleva claves en texto: ver ese archivo) |

## Cómo está ordenado

```
editor.html          La puerta del editor (Inicio, Proyectos y los editores). Solo HTML:
                     carga su código desde funciones/ en un ORDEN fijo.
campanas.html        La puerta de /campanas (Search). Carga funciones/search/campanas.*.
index.html           El acceso (login).
funciones/           EL CÓDIGO DE LA PANTALLA, separado por función:
  display/           Google Display  (tamaños; usa el motor compartido de banners)
  facebook/          Facebook Ads    (tamaños y textos del anuncio; usa el motor compartido)
  search/            Google Search   (Campañas nuevas + consola de piezas guardadas)
  campana-completa/  La tarjeta que crea las tres juntas
  comun/             Lo compartido: estado, guardado, Inicio, marcas, fotos, asistente, rutas
    banners/         MOTOR COMPARTIDO de banners (Display y Facebook)
    estilos/         Diseño general de la interfaz
  documentos/        Email y formato libre: ya no se crean desde el Inicio, se conservan
                     para abrir, editar y exportar lo que ya estaba guardado
nucleo/              El modelo de campaña (Search hoy; Display y PMax después): reglas,
                     Ads Editor, versiones. Lo usan la pantalla Y el servidor.
functions/api/       El servidor (no se publica como archivo):
  ia.js              Puerta /api/ia
  ia/                comun · display · search · documentos
pruebas/             La batería: bash pruebas/correr-todo.sh (ver pruebas/LEEME.md)
```

Cada archivo de `funciones/` empieza con un índice: **qué hay**, **quién lo usa** y sus
secciones en orden.

## Por qué Display y Facebook comparten el motor

Display y Facebook se diseñan, replican y exportan con el MISMO motor
(`funciones/comun/banners/`). Duplicarlo obligaría a arreglar cada fallo dos veces.
**Para hacer una versión propia de una de ellas** (p. ej. un Display v2): copiar
`funciones/comun/banners/` a `funciones/display/motor/`, cambiar ahí lo que se quiera y que
esa versión cargue su copia. Facebook sigue intacto.

## Reglas para no romper nada

1. **El orden de los `<script>` en `editor.html` importa**: son archivos que comparten sus
   funciones. El arranque (`comun/arranque.js`) va siempre al final.
   `node pruebas/orden-carga.js` revisa que nada se use antes de cargarse.
2. **El orden de las hojas de estilo también importa** (es la cascada).
3. El `<style>` que queda dentro de `editor.html` es el CSS que **viaja dentro de cada archivo
   exportado**. El exportador lo lee de ahí: no moverlo a un archivo.
4. Antes de subir: `bash pruebas/correr-todo.sh` (todo en verde).

## Archivos que no se tocan a mano

`_redirects` y `_headers` (los lee Cloudflare), `wrangler.toml` (configuración del servidor),
`package.json`, `CONTRATO-CAMPANA.md` (se genera con `node nucleo/generar-contrato.js`).

## Cómo levantarlo en local

1. `npm install` (instala wrangler) y `npm install --no-save playwright acorn acorn-walk` para las pruebas.
2. `npm run dev` levanta el sitio con el servidor.
3. `bash pruebas/correr-todo.sh` corre la batería sin tocar producción.
