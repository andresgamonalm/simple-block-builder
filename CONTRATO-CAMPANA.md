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
| `nombre` | texto | sí |  | `Campaign` | Nombre EXACTO en Google Ads. Ads Editor reconoce la campaña por este nombre: cambiarlo después de publicar crea una campaña duplicada. Convención: "Search \| Producto \| Objetivo". |
| `tipo` | texto | sí |  | `Campaign type` | Tipo de campaña en Google Ads. Valores: `Search`. |
| `redes` | lista de texto | sí |  | `Networks` | Redes donde aparece. Separadas por ";" en el CSV. Recomendado: solo "Google Search". Valores: `Google Search`, `Search Partners`, `Display Network`. |
| `idiomas` | lista de texto | sí |  | `Language` | Códigos de idioma, p. ej. "es". |
| `presupuestoDiario` | número (CLP) | sí |  | `Campaign daily budget` | Presupuesto DIARIO en pesos chilenos, entero, sin puntos ni símbolo. |
| `puja` | texto | sí |  | `Bid strategy type` | Estrategia de puja. Valores: `Maximize clicks`, `Maximize conversions`, `Manual CPC`, `Target CPA`, `Target ROAS`, `Maximize conversion value`. |
| `inicio` | fecha AAAA-MM-DD |  |  | `Start date` | Fecha de inicio. Vacía = parte al publicar. |
| `fin` | fecha AAAA-MM-DD |  |  | `End date` | Fecha de término. En una promoción debe calzar con su vigencia. |
| `estado` | texto | sí |  | `Campaign Status` | Estado al importar. Recomendado: "Paused" para revisar en Ads Editor antes de activar. Valores: `Enabled`, `Paused`. |
| `politicaUE` | texto |  |  | `EU political ads` | Declaración de anuncios políticos de la UE. Para Chile: "No". Valores: `No`, `Yes`. |
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
| `edad` | texto | sí |  | `Age` | Valores: `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+`, `Unknown`. |
| `comentario` | texto |  |  | `Comment` |  |

### Grupo de anuncios (`grupo`)
Una intención de búsqueda: sus keywords, sus negativas y su(s) anuncio(s).

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (grp_…). |
| `nombre` | texto | sí |  | `Ad Group` | Nombre EXACTO del grupo (Ads Editor lo reconoce por nombre). Convención: "AD \| Intención". |
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
| `estado` | texto |  |  | `Status` | Valores: `Enabled`, `Paused`. |
| `urlFinal` | url | sí |  | `Final URL` |  |
| `ruta1` | texto |  | 15 | `Path 1` | Minúsculas y guiones. |
| `ruta2` | texto |  | 15 | `Path 2` |  |
| `titulos` | lista de {id, texto, posicion} | sí | 30 | `Headline 1…15 + Headline N position` | Entre 3 y 15 títulos de hasta 30 caracteres, sin punto final. "posicion" = "1", "2" o "3" si el título va fijado; vacío si rota. |
| `descripciones` | lista de {id, texto, posicion} | sí | 90 | `Description 1…4` | Entre 2 y 4 descripciones de hasta 90 caracteres. |
| `comentario` | texto |  |  | `Comment` |  |

### Sitelink (enlace de sitio) (`sitelink`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (sl_…). |
| `texto` | texto | sí | 25 | `Sitelink text` |  |
| `linea1` | texto |  | 35 | `Description 1` |  |
| `linea2` | texto |  | 35 | `Description 2` |  |
| `urlFinal` | url | sí |  | `Final URL` |  |
| `comentario` | texto |  |  | `Comment` |  |

### Texto destacado (callout) (`destacado`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (co_…). |
| `texto` | texto | sí | 25 | `Callout text` |  |
| `comentario` | texto |  |  | `Comment` |  |

### Fragmento estructurado (`fragmento`)

| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |
|---|---|---|---|---|---|
| `id` | texto |  |  | — | Identificador estable (sn_…). |
| `encabezado` | texto | sí |  | `Header` | Uno de los encabezados que acepta Google (p. ej. "Tipos", "Servicios"). |
| `valores` | lista de texto | sí | 25 | `Snippet Values` | Entre 3 y 10 valores de hasta 25 caracteres. Separados por ";" en el CSV. |
| `idioma` | texto |  |  | `Language` |  |
| `estado` | texto |  |  | `Status` |  |
| `comentario` | texto |  |  | `Comment` |  |

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

## 5. Pendiente de confirmar en la primera importación real
El archivo de referencia del usuario solo trae negativas amplias de campaña. Estas notaciones siguen la
convención de Ads Editor, pero todavía no se han visto importadas:
- Negativa de **frase** escrita como `"texto"` y de **exacta** como `[texto]` en la columna `Keyword`.
- Negativa **de grupo**: `Type` = `Negative` con `Ad Group` lleno.
- **Display y Performance Max** aún no forman parte del contrato.
