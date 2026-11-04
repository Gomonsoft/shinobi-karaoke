# 0017 — Fuentes de karaoke incluidas (8 familias OFL)
- Estado: Pendiente
- Paso del pipeline: 4 (las usa ya la portada de las tarjetas)
- Depende de: 0006, 0015
- ADRs: 0002, 0006
- Spec UX: docs/preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md (respuesta), docs/ux/sistema-visual.md §8 y §10, docs/ux/02-biblioteca.md (portada con la fuente de la canción)

## Objetivo
Empaquetar las 8 familias decididas en la respuesta a la pregunta 0004 y exponerlas como un registro único que usarán la portada de las tarjetas, el editor y el reproductor.

## Criterios de aceptación
- [ ] En `app/resources/fonts/<familia>/`: un archivo WOFF2 por familia con **el peso indicado** — Atkinson Hyperlegible Next 700, Nunito 800, Montserrat 700, Oswald 600, Lora 700, Playfair Display 800, Bangers 400, Noto Sans 700 — y el `OFL.txt` de cada repositorio original. Archivos sin modificar ni renombrar la familia (respetar el *Reserved Font Name*). Si se usan subconjuntos, deben incluir al menos latín extendido (á é í ó ú ü ñ ¿ ¡) y las escrituras indicadas en la respuesta a 0004.
- [ ] Registro en `src/shared/fuentes.ts`: lista tipada `{ familia, peso, escrituras, archivo }`; el esquema de estilo (0006) valida `familia` contra este registro; familia desconocida → predeterminada (Atkinson Hyperlegible Next).
- [ ] `@font-face` generadas a partir del registro (un único sitio), cargadas sin red.
- [ ] Peso total de las 8 familias ≤ 2,5 MB (anotar el real).
- [ ] `THIRD_PARTY_NOTICES.md`: una entrada por familia con autor, licencia OFL 1.1, *Reserved Font Name* si aplica y enlace de origen.
- [ ] El "Muestrario" muestra cada familia con el texto "¿Cantamos? Ñandú" en su peso; captura revisable por el diseñador.
- [ ] Test: el registro y los archivos coinciden (existe cada archivo y su licencia).

## Notas de implementación
(las rellena el programador al terminar)
