# Registro de recursos Envato — Mi Publicidad

Flujo según lineamientos de marca Gamonal (`fotografia.md` + `registro-envato.md`).
El entorno de desarrollo no tiene salida de red hacia Envato, por lo que la
descarga la hace el usuario con su cuenta de Envato Elements y guarda el archivo
en la **Ruta final** indicada (el código ya apunta a esa ruta; no hay que tocar nada más).

| ID interno | Código Envato | Título | Autor | URL | Uso previsto | Formato/orientación | Ruta final | Estado |
|---|---|---|---|---|---|---|---|---|
| FOTO-001 | DGQZAQM | El equipo de la startup colabora en la selección de colores para un diseño de productos centrado en el usuario | SpaceOak | https://elements.envato.com/es/startup-team-collaborates-on-color-selection-for-u-DGQZAQM | Área visual del login (`/login`), recorte apaisado a sangre | JPG / landscape | `assets/login/foto_login_mi_publicidad.jpg` | YA NO NECESARIA (DEC-010: el login usa una foto propia del usuario — sobres sobre turquesa — incluida en el repo) |
| FOTO-002 | Y5H45VG | Brainstorm, equipo de diseñadores gráficos web creativos, planificación | nateemee | https://elements.envato.com/es/brainstorm-team-of-creative-web-graphic-designer-p-Y5H45VG | Alternativa para el login si FOTO-001 no convence | JPG / landscape | `assets/login/foto_login_mi_publicidad.jpg` | DESCARTADA (DEC-010) |

**Instrucción de sustitución:** descargar FOTO-001 desde Envato Elements (licencia
del proyecto "Mi Publicidad"), exportar en ≥1600 px de ancho, guardarla como
`assets/login/foto_login_mi_publicidad.jpg` y hacer push. El login la muestra
automáticamente; mientras el archivo no exista, se muestra el panel editorial navy
(sin foto rota).
