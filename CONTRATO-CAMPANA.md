# Contrato de campaña · Mi Publicidad (`mp-campana/1`)

> **Documento generado** desde `nucleo/modelo.js` y `nucleo/ads-editor.js`. No se edita a mano:
> `node nucleo/generar-contrato.js`. Es la referencia para personas **y para la IA**.

## 1. Qué es
La campaña se guarda con la misma forma que Google Ads Editor. Exportar es escribir filas, no traducir.
Montos siempre en **CLP** (pesos chilenos, enteros).

```
Iniciativa ─ campañas[] ─ grupos[] ─ keywords[] · negativas[] · anuncios[]
                        └ ubicaciones · edades excluidas · negativas de campaña
                          sitelinks · destacados · fragmentos
```

**Identificadores:** cada elemento tiene un `id` estable. Las correcciones por partes
("cambia solo los títulos del grupo X") apuntan a ese `id`; nunca se regenera la campaña entera.

## 2. El archivo para Ads Editor
- Un solo archivo CSV, **UTF-8 con BOM**, separado por **comas**, líneas **CRLF**.
- **60 columnas**, siempre en este orden:

  `Campaign` · `Campaign type` · `Networks` · `Language` · `Campaign daily budget` · `Bid strategy type` · `Start date` · `End date` · `Campaign Status` · `EU political ads` · `Location` · `Location ID` · `Age` · `Ad Group` · `Ad Group Status` · `Status` · `Type` · `Keyword` · `Final URL` · `Path 1` · `Path 2` · `Headline 1` · `Headline 2` · `Headline 3` · `Headline 4` · `Headline 5` · `Headline 6` · `Headline 7` · `Headline 8` · `Headline 9` · `Headline 10` · `Headline 11` · `Headline 12` · `Headline 13` · `Headline 14` · `Headline 15` · `Headline 1 position` · `Headline 2 position` · `Headline 3 position` · `Headline 4 position` · `Headline 5 position` · `Headline 6 position` · `Headline 7 position` · `Headline 8 position` · `Headline 9 position` · `Headline 10 position` · `Headline 11 position` · `Headline 12 position` · `Headline 13 position` · `Headline 14 position` · `Headline 15 position` · `Description 1` · `Description 2` · `Description 3` · `Description 4` · `Sitelink text` · `Callout text` · `Header` · `Snippet Values` · `Comment`

- **Orden de las filas:** 1) campañas, cada una seguida de sus ubicaciones y edades excluidas ·
  2) grupos, cada uno seguido de sus anuncios · 3) keywords · 4) negativas (de grupo y luego de campaña) ·
  5) sitelinks, destacados y fragmentos, por campaña.
- **Garantía:** importar el archivo y volver a exportarlo da el mismo archivo, byte a byte
  (prueba `pruebas/nucleo.js`). Lo que el modelo no entiende se conserva y se devuelve tal cual.

- **Columnas opcionales** (se agregan al final solo si se usan): `Tracking template` · `Final URL suffix`.
- **Nombre del archivo:** `<base>-ads-editor-<aaaa-mm-dd>.csv`, en minúsculas y con guion. `base` = el nombre de la campaña si es
  una; el prefijo común de los nombres si son varias (`chl-producto-auto-digital-ads-editor-2026-09-26.csv`); si no, la iniciativa.

### Cómo reconoce Ads Editor cada fila
| Fila | Columnas que la identifican |
|---|---|
| Campaña | `Campaign type` lleno |
| Ubicación | `Location` + `Location ID` |
| Edad excluida | `Type` = `Campaign negative` + `Age` |
| Grupo | `Ad Group` + `Ad Group Status` |
| Anuncio adaptable (RSA) | `Headline 1…15` (+ `Headline N position` si va fijado) y `Description 1…4` |
| Keyword | `Keyword` + `Type` = `Exact` / `Phrase` |
| Negativa de campaña | `Type` = `Campaign negative` + `Keyword` |
| Sitelink | `Sitelink text` (+ `Description 1/2`, `Final URL`) |
| Destacado | `Callout text` |
| Fragmento estructurado | `Header` + `Snippet Values` (valores separados por `;`) |
| UTM | `Tracking template` o `Final URL suffix` en la fila de la campaña; `Final URL suffix` también en la del anuncio |

## 3. Entidades y campos

### Iniciativa (`iniciativa`)
La acción comercial completa (p. ej. "Auto Digital · Septiembre"). Agrupa una o varias campañas de Google Ads.

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (ini_…). No se muestra ni se exporta. |
| `nombre` | texto | sí |  | — | Nombre interno de la iniciativa. |
| `moneda` | texto |  |  | — | Siempre "CLP". Todos los montos son pesos chilenos enteros. |
| `campanas` | lista de campaña | sí |  | — | Las campañas de Google Ads. |

### Campaña (`campana`)
Una campaña de Google Ads. Por ahora: Search.

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (cmp_…). |
| `nombre` | texto | sí |  | `Campaign` | Nombre EXACTO en Google Ads. Ads Editor reconoce la campaña por este nombre: cambiarlo después de publicar crea una campaña duplicada. Protocolo: sigla país-producto-nombre del producto-tipo de campaña, p. ej. "chl-producto-auto-digital-always-on". |
| `tipo` | texto | sí |  | `Campaign type` | Tipo de campaña en Google Ads. Valores: `Search`. |
| `redes` | lista de texto | sí |  | `Networks` | Redes donde aparece. Separadas por ";" en el CSV. Recomendado: solo "Google Search". Valores: `Google Search`, `Search Partners`, `Display Network`. |
| `idiomas` | lista de texto | sí |  | `Language` | Códigos de idioma, p. ej. "es". |
| `presupuestoDiario` | número (CLP) | sí |  | `Campaign daily budget` | Presupuesto DIARIO en pesos chilenos, entero, sin puntos ni símbolo. |
| `puja` | texto | sí |  | `Bid strategy type` | Estrategia de puja. Valores: `Maximize clicks`, `Maximize conversions`, `Manual CPC`, `Target CPA`, `Target ROAS`, `Maximize conversion value`. |
| `inicio` | fecha AAAA-MM-DD |  |  | `Start date` | Fecha de inicio. Vacía = parte al publicar. |
| `fin` | fecha AAAA-MM-DD |  |  | `End date` | Fecha de término. En una promoción debe calzar con su vigencia. |
| `estado` | texto | sí |  | `Campaign Status` | Estado al importar. Recomendado: "Paused" para revisar en Ads Editor antes de activar. Valores: `Enabled`, `Paused`. |
| `politicaUE` | texto |  |  | `EU political ads` | Declaración de anuncios políticos de la UE. Para Chile: "No". Valores: `No`, `Yes`. |
| `taxonomia` | {pais, producto, tipo} |  |  | — | Partes del nombre según el protocolo: "chl" + "producto" + nombre del producto + tipo de campaña → chl-producto-auto-digital-always-on. Minúsculas, sin tildes ni símbolos, con guion medio. |
| `utmEn` | texto |  |  | — | Dónde van las UTM. "sufijo" (recomendado por Google, permite utm_content por anuncio) o "plantilla" ({lpurl}?utm_…). Valores: `sufijo`, `plantilla`. |
| `plantillaSeguimiento` | texto |  |  | `Tracking template` | Plantilla de seguimiento con {lpurl}. Se genera sola si utmEn = "plantilla". |
| `sufijoUrlFinal` | texto |  |  | `Final URL suffix` | Parámetros que se agregan a la URL final: utm_source=gads&utm_medium=clics\|conversion&utm_campaign=<nombre de la campaña>. |
| `precios` | extensión de precio |  |  | — | Opcional. Tipo + 3 a 8 ítems. (Modelada y validada; su exportación espera confirmar las columnas de Ads Editor.) |
| `ubicaciones` | lista de ubicación |  |  | — | Dónde se muestra. Cada una va en su propia fila del CSV. |
| `edadesExcluidas` | lista de edad |  |  | — | Rangos de edad excluidos ("18-24", "Unknown"…). Cada uno en su fila. |
| `negativas` | lista de negativa |  |  | — | Negativas de campaña: búsquedas por las que NO se paga. |
| `grupos` | lista de grupo | sí |  | — | Grupos de anuncios. Cada grupo = UNA intención de búsqueda. |
| `sitelinks` | lista de sitelink |  |  | — | Enlaces de sitio a nivel campaña. |
| `destacados` | lista de destacado |  |  | — | Textos destacados (callouts) a nivel campaña. |
| `fragmentos` | lista de fragmento |  |  | — | Fragmentos estructurados a nivel campaña. |
| `comentario` | texto |  |  | `Comment` | Por qué la campaña está armada así. Viaja en la columna Comment. |

### Ubicación (`ubicacion`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `nombre` | texto | sí |  | `Location` | Nombre canónico de Google (p. ej. "Santiago Metropolitan Region,Chile"). |
| `idGoogle` | texto |  |  | `Location ID` | ID de criterio geográfico de Google (p. ej. "20160"). |
| `comentario` | texto |  |  | `Comment` |  |

### Edad excluida (`edad`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `edad` | texto | sí |  | `Age` | Valores: `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65 or more`, `Unknown`. |
| `comentario` | texto |  |  | `Comment` |  |

### Grupo de anuncios (`grupo`)
Una intención de búsqueda: sus keywords, sus negativas y su(s) anuncio(s).

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (grp_…). |
| `nombre` | texto | sí |  | `Ad Group` | Nombre EXACTO del grupo (Ads Editor lo reconoce por nombre). Protocolo: <abreviatura del tipo de campaña>-<naturaleza>, p. ej. "ao-coberturas", "promo-cuotas". |
| `estado` | texto |  |  | `Ad Group Status` | Valores: `Enabled`, `Paused`. |
| `keywords` | lista de keyword | sí |  | — |  |
| `negativas` | lista de negativa |  |  | — | Negativas propias del grupo. |
| `anuncios` | lista de anuncio | sí |  | — |  |
| `comentario` | texto |  |  | `Comment` |  |

### Keyword (`keyword`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (kw_…). |
| `texto` | texto | sí | 80 | `Keyword` | En minúsculas, sin corchetes ni comillas (la concordancia va aparte). |
| `concordancia` | texto | sí |  | `Type` | En el CSV: Exact / Phrase. La amplia NO se usa en esta app. Valores: `exacta`, `frase`. |
| `estado` | texto |  |  | `Status` | Valores: `Enabled`, `Paused`. |
| `urlFinal` | url |  |  | `Final URL` |  |
| `comentario` | texto |  |  | `Comment` |  |

### Keyword negativa (`negativa`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (neg_…). |
| `texto` | texto | sí |  | `Keyword` | El término excluido. |
| `concordancia` | texto | sí |  | — | Amplia: bloquea búsquedas que contengan TODAS sus palabras en cualquier orden. Frase: esa secuencia. Exacta: solo esa búsqueda. En el CSV: "Campaign negative" + texto tal cual (amplia), "texto" (frase) o [texto] (exacta). Valores: `amplia`, `frase`, `exacta`. |
| `comentario` | texto |  |  | `Comment` | Motivo de la exclusión. |

### Anuncio adaptable de búsqueda (RSA) (`anuncio`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (rsa_…). |
| `nombre` | texto |  |  | — | Nombre del anuncio según el protocolo: "ads-" + característica (ads-anual, ads-3-cuotas-gratis). Google no tiene campo de nombre para este anuncio: viaja como utm_content y en Comment. |
| `estado` | texto |  |  | `Status` | Valores: `Enabled`, `Paused`. |
| `urlFinal` | url | sí |  | `Final URL` | https:// obligatorio (protocolo). |
| `sufijoUrlFinal` | texto |  |  | `Final URL suffix` | UTM del anuncio: las de la campaña + utm_content=<nombre del anuncio>. Reemplaza al sufijo de la campaña para este anuncio. |
| `ruta1` | texto |  | 15 | `Path 1` | Minúsculas y guiones. |
| `ruta2` | texto |  | 15 | `Path 2` |  |
| `titulos` | lista de {id, texto, posicion} | sí | 30 | `Headline 1…15 + Headline N position` | Entre 3 y 15 títulos de hasta 30 caracteres, sin punto final. "posicion" = "1", "2" o "3" si el título va fijado; vacío si rota. PROTOCOLO: 15 títulos = 5 fijados en la posición 1 (con la marca o la oferta/precio) + 10 que rotan. |
| `descripciones` | lista de {id, texto, posicion} | sí | 90 | `Description 1…4` | Entre 2 y 4 descripciones de hasta 90 caracteres. |
| `comentario` | texto |  |  | `Comment` |  |

### Sitelink (enlace de sitio) (`sitelink`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (sl_…). |
| `texto` | texto | sí | 25 | `Sitelink text` | PROTOCOLO: al menos 4 sitelinks por campaña, cada uno a una página DISTINTA de la URL de destino principal. |
| `linea1` | texto |  | 35 | `Description 1` |  |
| `linea2` | texto |  | 35 | `Description 2` |  |
| `urlFinal` | url | sí |  | `Final URL` |  |
| `comentario` | texto |  |  | `Comment` |  |

### Texto destacado (callout) (`destacado`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (co_…). |
| `texto` | texto | sí | 25 | `Callout text` | PROTOCOLO: recomendado 4 o más por campaña. |
| `comentario` | texto |  |  | `Comment` |  |

### Fragmento estructurado (`fragmento`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (sn_…). |
| `encabezado` | texto | sí |  | `Header` | Uno de los encabezados predefinidos de Google (también se aceptan sus nombres en inglés). Valores: `Servicios`, `Marcas`, `Cursos`, `Programas de grado`, `Destinos`, `Hoteles destacados`, `Cobertura de seguro`, `Modelos`, `Barrios`, `Catálogo de servicios`, `Programas`, `Estilos`, `Tipos`. |
| `valores` | lista de texto | sí | 25 | `Snippet Values` | Entre 3 y 10 valores de hasta 25 caracteres. Separados por ";" en el CSV. |
| `idioma` | texto |  |  | `Language` |  |
| `estado` | texto |  |  | `Status` |  |
| `comentario` | texto |  |  | `Comment` |  |

### Extensión de precio (opcional) (`precio`)
Un tipo y de 3 a 8 ítems, cada uno con su precio en CLP y su propia URL.

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `tipo` | texto | sí |  | — | Valores: `Marcas`, `Eventos`, `Ubicaciones`, `Barrios`, `Categorías de productos`, `Niveles de productos`, `Servicios`, `Categorías de servicios`, `Niveles de servicios`. |
| `items` | lista de {id, encabezado, descripcion, precio, unidad, urlFinal} | sí | 25 | — | Entre 3 y 8 ítems. Encabezado y descripción de hasta 25 caracteres; precio entero en CLP; unidad opcional (por mes, por año…); URL propia del producto. |

## 4. Límites de Google (Search)
| Elemento | Límite |
|---|---|
| Título de anuncio | 30 caracteres · entre 3 y 15 |
| Descripción de anuncio | 90 caracteres · entre 2 y 4 |
| Ruta (Path 1/2) | 15 caracteres |
| Sitelink | texto 25 · cada línea 35 |
| Texto destacado | 25 caracteres |
| Fragmento estructurado | valores de 25 caracteres · entre 3 y 10 |
| Keyword | 80 caracteres · 10 palabras |

## 5. Protocolo de la casa: nombres y UTM
Lámina "Reglas y requisitos ADS". Todo nombre va en **minúsculas, sin tildes, sin símbolos y con guion medio**.

| Nivel | Estructura | Ejemplos |
|---|---|---|
| Campaña | `<sigla país>-producto-<nombre del producto>-<tipo de campaña>` | `chl-producto-auto-digital-always-on` · `chl-producto-auto-digital-promociones` |
| Grupo de anuncios | `<abreviatura del tipo>-<naturaleza>` (always-on → ao, promociones → promo, promocion → promo) | `ao-coberturas` · `promo-cuotas` |
| Anuncio | `ads-<característica>` | `ads-anual` · `ads-bienal` · `ads-3-cuotas-gratis` |

**Títulos:** 5 fijados en la posición 1 (con la marca o la oferta/precio) y 10 que rotan.
**Recursos:** al menos 4 sitelinks, cada uno a una página distinta de la URL principal; 4 o más textos destacados.

**UTM** — `utm_source=gads` · `utm_medium=clics` (pujas por clic) o `conversion` (pujas por conversión) ·
`utm_campaign=<nombre exacto de la campaña>` · `utm_content=<nombre del anuncio>`. Van en minúsculas y con guion.
- **Por defecto van en el sufijo de URL final** (`Final URL suffix`): es lo que recomienda Google y permite `utm_content` por
  anuncio. El sufijo del anuncio **reemplaza** al de la campaña, por eso lleva las UTM completas + `utm_content`.
- **Alternativa:** plantilla de seguimiento (`Tracking template`) `{lpurl}?utm_source=…`. No se mezcla con sufijos: si el anuncio
  agregara el suyo, la URL quedaría con dos `?`.
- Google no tiene campo "nombre" para el anuncio adaptable de búsqueda: el nombre `ads-…` viaja en `utm_content`.

## 6. Reglas que toda campaña debe cumplir
Las aplica `nucleo/reglas.js` en la IA (antes y después de generar), en la pantalla y antes de exportar.
**error** = bloquea la exportación · **aviso** = hay que revisarlo · **sugerencia** = mejora opcional.

| Código | Nivel | Tipo | Qué revisa | Respaldo |
|---|---|---|---|---|
| G01 | error | google | La campaña tiene nombre, tipo, redes, idioma, puja y estado válidos. | [google-ads/editor/answer/57747](https://support.google.com/google-ads/editor/answer/57747) |
| G02 | error | google | El presupuesto diario es un entero positivo en CLP. | [google-ads/editor/answer/57747](https://support.google.com/google-ads/editor/answer/57747) |
| G03 | error | google | Las fechas son AAAA-MM-DD o van vacías; el término no es anterior al inicio ni a hoy. | [google-ads/editor/answer/57747](https://support.google.com/google-ads/editor/answer/57747) |
| G04 | error | google | Cada grupo tiene nombre único en su campaña, al menos una keyword y al menos un anuncio. | [google-ads/editor/answer/57747](https://support.google.com/google-ads/editor/answer/57747) |
| G05 | error | google | Keyword: máx 80 caracteres y 10 palabras, sin símbolos inválidos (@ \ ^ , = ! ` < > [ ] ( ) % \| ? ; ~ y el asterisco *, que solo vale en negativas), sin repetirse en el grupo. | [google-ads/answer/2453981](https://support.google.com/google-ads/answer/2453981) |
| G06 | error | google | Anuncio: 3-15 títulos de máx 30, 2-4 descripciones de máx 90, rutas de máx 15, URL final http(s). Sin textos repetidos. | [google-ads/answer/7684791](https://support.google.com/google-ads/answer/7684791) |
| G07 | error | google | Sin puntuación repetida ("!!", "??", "..") en títulos, descripciones, sitelinks ni destacados. | [adspolicy/answer/14847994](https://support.google.com/adspolicy/answer/14847994) |
| G08 | error | google | Posición fijada: títulos solo 1, 2 o 3; descripciones solo 1 o 2. | [google-ads/answer/7684791](https://support.google.com/google-ads/answer/7684791) |
| G09 | error | google | Sitelink: texto máx 25, líneas máx 35 (las dos o ninguna), URL http(s), sin textos repetidos (aunque vayan a páginas distintas). | [adspolicy/answer/1054210](https://support.google.com/adspolicy/answer/1054210) |
| G10 | error | google | Destacado máx 25, sin repetir otro destacado. Fragmento: 3-10 valores de máx 25. | [adspolicy/answer/6084196](https://support.google.com/adspolicy/answer/6084196) · [google-ads/answer/6280012](https://support.google.com/google-ads/answer/6280012) |
| G11 | error | google | Negativa con texto, máx 10 palabras, sin símbolos inválidos (, ! @ % ^ ( ) = { } ; ~ ` < > ? \ \|). | [google-ads/answer/2453972](https://support.google.com/google-ads/answer/2453972) |
| G12 | aviso | google | Mayúsculas excesivas: palabras enteras en mayúscula que no son siglas. | [adspolicy/answer/6021546](https://support.google.com/adspolicy/answer/6021546) |
| G13 | aviso | google | El encabezado del fragmento estructurado es uno de los predefinidos de Google. | [google-ads/answer/6280012](https://support.google.com/google-ads/answer/6280012) |
| G14 | error | google | Extensión de precio: 3-8 ítems, encabezado y descripción de máx 25, precio entero en CLP, URL propia. | [adspolicy/answer/7048464](https://support.google.com/adspolicy/answer/7048464) |
| G15 | error | google | Discordancia de destino: las URL finales de las keywords van al mismo dominio que el anuncio del grupo. | [adspolicy/answer/6368661](https://support.google.com/adspolicy/answer/6368661) |
| G16 | aviso | google | Signo de exclamación en un título: Google lo desaprobaba ("exclamation mark in the ad's headline"); la política vigente ya no lo nombra, pero sigue siendo riesgo de rechazo. | [adspolicy/answer/14847994](https://support.google.com/adspolicy/answer/14847994) |
| G17 | aviso | google | Sitelink o destacado que la política de Google desaprueba: signo de exclamación, empieza con un símbolo, repite un texto del anuncio o de otro recurso, o lleva a un dominio distinto al del anuncio. Solo ese recurso deja de mostrarse. | [adspolicy/answer/1054210](https://support.google.com/adspolicy/answer/1054210) · [adspolicy/answer/6084196](https://support.google.com/adspolicy/answer/6084196) |
| P01 | aviso | protocolo | Nombres de campaña, grupo y anuncio en minúsculas, sin tildes ni símbolos, con guion medio. (Renombrar una campaña ya publicada crea un duplicado en Ads Editor.) | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P02 | aviso | protocolo | Estructura de nombres: campaña chl-producto-<producto>-<tipo>; grupo <abreviatura del tipo>-<naturaleza>; anuncio ads-<característica>. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P03 | aviso | protocolo | Títulos: 5 fijados en la posición 1 y 10 que rotan. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P04 | aviso | protocolo | Los títulos fijados en la posición 1 llevan la marca o la oferta/precio. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P05 | aviso | protocolo | Al menos 4 sitelinks por campaña. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P06 | aviso | protocolo | Cada sitelink lleva a una página DISTINTA de la URL de destino principal. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P07 | sugerencia | protocolo | Al menos 4 textos destacados por campaña. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P08 | aviso | protocolo | UTM presentes y correctas: utm_source=gads, utm_medium=clics o conversion según la puja, utm_campaign = nombre de la campaña; todo en minúsculas y con guion medio. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P09 | error | protocolo | Toda URL final (anuncios, keywords, sitelinks, precios) usa https://. | protocolo de la casa (lámina "Reglas y requisitos ADS") |
| P10 | aviso | protocolo | Keywords solo en concordancia exacta o de frase (la amplia no se usa por decisión de la casa). | protocolo de la casa (lámina "Reglas y requisitos ADS") · Google, en cambio, recomienda la amplia: [google-ads/answer/7478529](https://support.google.com/google-ads/answer/7478529) |
| C01 | error | coherencia | Ninguna negativa (de campaña o del grupo) bloquea una keyword propia, según su concordancia. | [google-ads/answer/2453972](https://support.google.com/google-ads/answer/2453972) |
| C03 | aviso | coherencia | Una promoción con "hasta el DD/MM" debe calzar con la fecha de término de la campaña (ofrecer algo que ya no está disponible es tergiversación). | [adspolicy/answer/6020955](https://support.google.com/adspolicy/answer/6020955) |
| C04 | sugerencia | coherencia | Más de 3 títulos fijados en una misma posición: Google recomienda fijar 2 o 3 por posición; fijar más le quita combinaciones y puede bajar la calidad del anuncio. | [google-ads/answer/7684791](https://support.google.com/google-ads/answer/7684791) |
| C05 | aviso | coherencia | Títulos casi iguales (mismas palabras en otro orden): Google pide títulos únicos y advierte que fijar textos similares baja la calidad del anuncio. | [google-ads/answer/7684791](https://support.google.com/google-ads/answer/7684791) |
| C07 | aviso | coherencia | Ningún título del anuncio contiene las palabras de alguna keyword del grupo (Google pide al menos una keyword en los títulos). | [google-ads/answer/9438230](https://support.google.com/google-ads/answer/9438230) |
| C08 | aviso | coherencia | Cifras de los anuncios que no aparecen en la ficha del producto (posible dato inventado: afirmación no confiable). | [adspolicy/answer/6020955](https://support.google.com/adspolicy/answer/6020955) |
| K01 | aviso | criterio | Presupuesto diario menor a $1.000 CLP: probablemente un error de unidades. | criterio propio (sin documento de Google que lo respalde o lo contradiga); caso real: $25 CLP diarios |
| K02 | sugerencia | criterio | Maximizar clics sin tope de CPC: Google puja lo necesario para gastar el presupuesto; el tope ayuda a controlar el costo si el CPC sale más alto de lo deseado (a costa de algunos clics). | [google-ads/answer/6268626](https://support.google.com/google-ads/answer/6268626) |
| K03 | sugerencia | criterio | Red de búsqueda asociada o de Display en una campaña Search: mide su rendimiento por separado antes de dejarla encendida. | criterio propio (sin documento de Google que lo respalde o lo contradiga) |
| K04 | aviso | criterio | Campaña sin ubicaciones: se mostraría en todos los países. | [google-ads/answer/1722043](https://support.google.com/google-ads/answer/1722043) |
| K05 | sugerencia | criterio | Método de ubicación no fijado en el archivo: queda "presencia o interés", que es lo que Google recomienda en Search. Cámbialo a "presencia" en Ads Editor solo si no quieres gente que está fuera de la zona. | [google-ads/answer/1722038](https://support.google.com/google-ads/answer/1722038) |
| K06 | aviso | criterio | Edad "Desconocida" excluida: Google advierte que puede dejar fuera a una cantidad importante de personas. | [google-ads/answer/2580383](https://support.google.com/google-ads/answer/2580383) |
| K09 | sugerencia | criterio | Muchas negativas idénticas en varias campañas: mejor una lista compartida (hasta 5.000 por lista y 20 listas por cuenta). | [google-ads/answer/2453983](https://support.google.com/google-ads/answer/2453983) |
| K10 | sugerencia | criterio | La misma keyword en exacta y en frase en el mismo grupo: la de frase ya cubre las búsquedas de la exacta. | [google-ads/answer/7478529](https://support.google.com/google-ads/answer/7478529) |
| K11 | sugerencia | criterio | Grupo con un solo anuncio: Google recomienda al menos 2 anuncios adaptables por grupo (en promedio +6,6 % de conversiones al pasar de 1 a 2). | [google-ads/answer/7684791](https://support.google.com/google-ads/answer/7684791) |
| K12 | sugerencia | criterio | Fragmento estructurado con menos de 4 valores: Google recomienda al menos 4 por encabezado. | [google-ads/answer/6280012](https://support.google.com/google-ads/answer/6280012) |

Revisadas una a una contra la documentación de Google el 26-sep-2026. Donde Google y el protocolo de la casa no
coinciden (fijados en la posición 1: Google recomienda 2 o 3, el protocolo usa 5; concordancia amplia: Google la
recomienda, la casa no la usa) manda el protocolo y la diferencia queda a la vista como sugerencia.

Cada hallazgo apunta al `id` del elemento: una corrección puede tocar solo esa parte.

## 7. Pendiente de confirmar en la primera importación real
El archivo de referencia del usuario solo trae negativas amplias de campaña. Estas notaciones siguen la
convención de Ads Editor, pero todavía no se han visto importadas:
- Negativa de **frase** escrita como `"texto"` y de **exacta** como `[texto]` en la columna `Keyword`.
- Negativa **de grupo**: `Type` = `Negative` con `Ad Group` lleno.
- El **método de ubicación** ("presencia") no tiene columna en el contrato de 60: hoy se fija en Ads Editor (regla K05).
- Nombres de columna `Tracking template` y `Final URL suffix` (a nivel de campaña y de anuncio).
- **Extensión de precio:** está modelada y validada (regla G14), pero NO se exporta hasta confirmar sus columnas.
- **Display y Performance Max** aún no forman parte del contrato.
