# Pruebas del aplicativo

Batería que recorre el aplicativo entero y **mide el resultado**, no que "no
reventó". Es la condición que pide el manual de construcción: *comprobar que el
HTML generado no venga vacío ni contenga errores no es comprobar calidad — un
banner completamente vacío pasa ese test*.

## Cómo correrla

```bash
npm install playwright --no-save     # solo la primera vez
bash pruebas/correr-todo.sh          # todo
bash pruebas/correr-todo.sh geom insp   # solo algunas
```

Levanta un servidor local que sirve el repo con **mocks de `/api/*`** y corre
todo contra él. **No toca producción, ni D1, ni el bucket R2, ni gasta llamadas
a la IA.** Al terminar apaga el servidor.

Las imágenes externas están bloqueadas en el entorno de pruebas, así que el
servidor sirve un `/foto.svg` y un `/logo.svg` locales.

## Qué comprueba cada una

| Prueba | Qué mide |
|---|---|
| `audita-estatica` | **Sin navegador.** Botones muertos (un `onclick` que llama a algo que no existe no da error: simplemente no hace nada), íconos que no están en el registro, y rutas del código que `_redirects` no sirve. |
| `login` | **Sin navegador.** Que se pueda entrar con el `usuario` y también con el **correo** (el identificador que hubo durante meses), contra la lógica real de `_shared.js` y la ficha real de `usuarios.js`. Comprueba además que la contraseña siga mandando y que un correo ajeno o un workspace que no es correo NO abran nada. |
| `ia-json` | **Sin navegador.** Que la respuesta de Gemini se interprete aunque el modelo devuelva su razonamiento pegado al JSON. Corre con la respuesta REAL que tumbó la app. |
| `ads-ia` | **Sin navegador.** Pipeline de Google Search: investigación (Gemini lee la landing y busca la competencia en Google), crítico que reescribe lo genérico, filtros de frases trilladas y cifras inventadas, negativas con motivo que no bloquean keywords propias, y que genere igual si la investigación falla. Gemini y la landing se simulan. |
| `acceso` | La **pantalla de acceso**: la diagramación adaptada del paquete de referencia (tarjeta de 440px centrada, logotipo sobre el rótulo, 22px parejos, objetivos de 50px), el anillo de foco que no se quita, el aviso con su barra de color y su mailto, que un texto con HTML dentro NO se ejecute, entrar de verdad, el teléfono, y que no se haya colado nada de la marca de la referencia. |
| `geom` | La tabla de geometría cerrada calza con `mockups/flash-campaign-spec.json` en los 11 formatos. Si alguien toca una fórmula, esto lo grita. |
| `medir` | Los 11 banners **medidos sobre el render real**: desborde, colisión, cuerpos de letra, contraste, elementos presentes y zona muerta. Corre con copy dentro de los límites y con copy que los excede. |
| `insp` | El inspector: que corra sobre el tablero, que avise junto a la pieza, y que **detecte de verdad** una pieza rota a mano. |
| `panel` | El **editor de banners**: cuántos controles hay que atravesar al abrir (la queja fue "es tremendamente complejo"), que escribir en un campo se vea en el banner, que la oferta encienda el círculo sola y que el legal —que antes no tenía dónde escribirse— salga en su banda. |
| `arrastre` | El **arrastre**: que se agarre cualquier elemento del banner (logo, textos, botón), que el gesto sea fluido y que lo movido sobreviva a replicar. |
| `libre` | El **lienzo libre** —el modelo del usuario—: anclas que sobreviven a los 11 tamaños, replicar, y la exportación en JPG, PNG y HTML5. |
| `proporciones` | Las **maquetas del usuario**: la franja horizontal en 25 / 50 / 25 y el lateral en 20 / 50 / 20 / 10, medidas sobre el render real después de replicar. Y que el legal caiga —sin encogerse hasta ser ilegible— donde no cabe. |
| `escribir` | Escribir el texto **sobre el banner** (doble clic, barrita de tamaño/negrita/alineación, el cuadro que crece para no cortar lo escrito) y que el asistente genere **en el lienzo libre**: sus elementos se arrastran, se editan y se replican como los dibujados a mano. |
| `alcance` | El **alcance del manual (§01)**: que las superficies de creación ofrezcan solo las tres plataformas de pago, que ninguna abra un lienzo vacío, y que quitar el email NO haya roto las piezas de email ya guardadas. Además las páginas del §05 (en curso · realizados · historial) y la zona horaria. |
| `iaq` | Los límites de caracteres que se le pasan a la IA, la exclusión de logos por carpeta, el encogido antes de partir una palabra y los avisos en pantalla. |
| `asis` | El asistente en una sola ventana: todos los campos a la vista, Limpiar y Generar en su sitio. |
| `xls` | La planilla de Google Ads es un XLSX válido (se descomprime y se revisan sus partes) con una hoja por tipo y la columna de posición de los anclados. |
| `fb` | Facebook Ads: máster propio 1080×1350, las tres piezas, y los textos del anuncio con su contador contra el límite visible. |
| `tablet` | En tablet ningún botón queda fuera de la pantalla, y editar el texto del banner es fluido (no repinta los 11 banners, no pierde el foco). |
| `migra` | **Piezas ya guardadas** en formatos antiguos (modelo de 6 capas, layout de marca apagado, valores fuera de rango) siguen abriendo, conservan su texto y exportan. |
| `cierres` | Cada modal abre y cierra sin dejar una capa invisible comiéndose los clics. |
| `regres` | Regresión: email, formato libre, los 43 tipos de bloque, Search, export y dashboard. |
| `recorrido` | **Recorrido completo**: entra a cada sección, abre cada panel, pulsa todos los controles no destructivos y anota el que falle. |

## Dos trampas que ya costaron un rato

**Medir a escala.** El tablero pinta los banners con `transform: scale(0.7)` y
`getBoundingClientRect()` devuelve píxeles de pantalla. Sin dividir por la escala
real, cada elemento parece desbordar el marco: 11 falsos positivos de 11.

**Medir antes de que carguen las imágenes.** Un logo aún sin cargar mide 0×0, y
entonces el inspector canta "falta el logo" y una zona muerta que no existe. Por
eso `esperarImagenes()` antes de medir, con tope de 1,2 s (si la URL está muerta,
el logo SÍ falta de verdad y hay que decirlo).

## Cuando una prueba falla

Los avisos del inspector distinguen **el fallo del sistema** del **texto que no
cabe**. Si dice «"protegido" no cabe a lo ancho del título», la pieza no está
rota: el copy es más largo de lo que ese formato admite y hay que reescribirlo
más corto — la regla 3 del manual. Si dice desborde, colisión o contraste, eso sí
es del motor.
