# 0004 — Fuentes tipográficas: ¿solo un conjunto incluido o también las del sistema? ¿Cuáles?
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (necesario antes de las tareas del editor de estilo, fase 5)

## Contexto
ADR 0006 define `estilo.letra.fuente` con `origen: "incluida" | "sistema"`.
- **Incluidas**: fuentes con licencia SIL OFL empaquetadas en la app; siempre disponibles, sin conexión, se ven igual en todos los equipos. Cada familia añade ~50–500 KB (CJK: varios MB).
- **Del sistema**: Chromium permite listarlas (Local Font Access API, con un permiso que el usuario debe conceder). Amplían mucho la elección, pero la lista es larga y heterogénea, puede incluir fuentes ilegibles o sin acentos, y si la fuente se desinstala se cae a una de respaldo.

## Pregunta
1. ¿Se ofrecen también fuentes del sistema en el MVP o solo un conjunto curado incluido?
2. ¿Qué familias OFL concretas (y pesos) proponéis para el conjunto incluido, teniendo en cuenta legibilidad a gran tamaño, soporte de español (acentos, ñ, ¿¡) y, si se quiere, otros alfabetos?

## Opción provisional tomada (si no bloquea)
Solo un conjunto curado incluido de 6–10 familias OFL con soporte latino extendido; el modelo de datos ya admite fuentes del sistema para añadirlas después.

## Respuesta
**Respondida por disenador-ux (2026-11-03).**

### 1. ¿Fuentes del sistema en el MVP?
**No. Solo el conjunto curado incluido.** Motivos de UX:
- Un karaoke se crea para cantarse "como se ve": las fuentes incluidas garantizan que la vista previa del editor y el reproductor sean idénticas en cualquier equipo y sin conexión.
- La lista del sistema (cientos de fuentes, muchas de símbolos o sin ñ/acentos) contradice el principio "Simple" del editor, y el permiso de Local Font Access es un diálogo más que explicar.
- Evita el estado "la fuente ya no está instalada" (aviso + respaldo) en el MVP.
El campo `origen: "sistema"` se mantiene en el modelo para añadirlo después (sería una opción "Más fuentes de tu equipo…" al final del selector, tras pedir el permiso).

### 2. Conjunto incluido: 8 familias, **un solo peso por familia** para la letra
La letra se muestra siempre grande y en negrita, así que basta un peso por familia (menos tamaño, selector más simple). Todas con licencia SIL OFL 1.1, cobertura latina completa (á é í ó ú ü ñ ¿ ¡ y latín extendido).

| # | Familia | Peso incluido | Carácter / por qué | Escrituras extra |
|---|---------|---------------|--------------------|------------------|
| 1 | **Atkinson Hyperlegible Next** (predeterminada) | 700 | Máxima legibilidad a distancia; letras inconfundibles. También es la fuente de la interfaz (pesos 400/600/700) | — |
| 2 | **Nunito** | 800 | Redondeada, amable, ideal para fiestas y público infantil | Cirílico, vietnamita |
| 3 | **Montserrat** | 700 | Geométrica, moderna, muy usada en pósters | Cirílico, vietnamita |
| 4 | **Oswald** | 600 | Condensada: cabe más texto por línea en letras largas | Cirílico, vietnamita |
| 5 | **Lora** | 700 | Serif cálida para baladas y boleros | Cirílico, vietnamita |
| 6 | **Playfair Display** | 800 | Serif de alto contraste, elegante (en peso 800 sigue siendo legible a distancia) | Cirílico, vietnamita |
| 7 | **Bangers** | 400 (único) | Cómic, festiva, en mayúsculas visuales | Vietnamita |
| 8 | **Noto Sans** | 700 | Neutra y con la cobertura más amplia (latín, griego, cirílico); recomendada para letras en esos alfabetos | Griego, cirílico, vietnamita |

- Peso estimado total: ~1,5–2,5 MB (variable según subconjuntos; usar WOFF2).
- **CJK, árabe, hebreo, devanagari…**: no se incluyen en el MVP (varios MB cada una). Los caracteres no cubiertos se muestran con la fuente de respaldo del sistema que elija Chromium. Si el usuario pide cobertura CJK, se puede añadir Noto Sans JP/SC/KR como paquete aparte.
- El selector muestra cada familia en su propia fuente con el texto "¿Cantamos? Ñandú" (comprueba ¿, ñ y tildes de un vistazo). Ver `docs/ux/06-editor.md` y `docs/ux/sistema-visual.md`.
- Para la tarea de integración: verificar en cada repositorio el archivo OFL y el *Reserved Font Name* (no renombrar ni modificar los archivos), y listarlas en `THIRD_PARTY_NOTICES.md`.

