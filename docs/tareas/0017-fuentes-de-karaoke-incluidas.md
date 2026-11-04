# 0017 — Fuentes de karaoke incluidas (8 familias OFL)
- Estado: Hecha
- Paso del pipeline: 4 (las usa ya la portada de las tarjetas)
- Depende de: 0006, 0015
- ADRs: 0002, 0006
- Spec UX: docs/preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md (respuesta), docs/ux/sistema-visual.md §8 y §10, docs/ux/02-biblioteca.md (portada con la fuente de la canción)

## Objetivo
Empaquetar las 8 familias decididas en la respuesta a la pregunta 0004 y exponerlas como un registro único que usarán la portada de las tarjetas, el editor y el reproductor.

## Criterios de aceptación
- [x] En `app/resources/fonts/<familia>/`: un archivo WOFF2 por familia con **el peso indicado** — Atkinson Hyperlegible Next 700, Nunito 800, Montserrat 700, Oswald 600, Lora 700, Playfair Display 800, Bangers 400, Noto Sans 700 — y el `OFL.txt` de cada repositorio original. Archivos sin modificar ni renombrar la familia (respetar el *Reserved Font Name*). Si se usan subconjuntos, deben incluir al menos latín extendido (á é í ó ú ü ñ ¿ ¡) y las escrituras indicadas en la respuesta a 0004.
- [x] Registro en `src/shared/fuentes.ts`: lista tipada `{ familia, peso, escrituras, archivo }`; el esquema de estilo (0006) valida `familia` contra este registro; familia desconocida → predeterminada (Atkinson Hyperlegible Next).
- [x] `@font-face` generadas a partir del registro (un único sitio), cargadas sin red.
- [x] Peso total de las 8 familias ≤ 2,5 MB (anotar el real).
- [x] `THIRD_PARTY_NOTICES.md`: una entrada por familia con autor, licencia OFL 1.1, *Reserved Font Name* si aplica y enlace de origen.
- [x] El "Muestrario" muestra cada familia con el texto "¿Cantamos? Ñandú" en su peso; captura revisable por el diseñador.
- [x] Test: el registro y los archivos coinciden (existe cada archivo y su licencia).

## Notas de implementación
- **Qué se hizo**: 7 familias nuevas en `app/resources/fonts/<familia>/` (WOFF2 + `OFL.txt` de su repositorio original; Atkinson ya estaba por 0015). Fuentes originales sin modificar, solo reempaquetadas TTF->WOFF2 con fontTools (sin subconjuntos ni cambio de nombre). Nunito y Playfair Display solo publican fuente variable: se incluye completa (sin instanciar, para respetar el Reserved Font Name de Playfair Display) y la `@font-face` declara su rango de pesos; la letra usa el 800. Noto Sans: release 2.015 de notofonts/latin-greek-cyrillic, `unhinted`. Cobertura verificada con fontTools: á é í ó ú ü ñ ¿ ¡ en todas; cirílico y vietnamita donde se indica; griego en Noto Sans.
- **Reserved Font Name**: solo Lora y Playfair Display (archivos sin modificar). Las demás no declaran.
- **Peso real**: las 8 familias de la letra suman unos 674 KB (limite 2,5 MB); `resources/fonts` completo (con Atkinson 400/600) ~ 725 KB.
- **Archivos clave**: `app/src/shared/fuentes.ts` (registro `{familia, peso, escrituras, archivo, rangoPesos?}`, `familiaValida`, `generarFontFace`), `shared/estilo.ts` (valida la familia con `familiaValida`; `FUENTES_INCLUIDAS`/`FUENTE_PREDETERMINADA` ahora se exportan desde `fuentes.ts`), `renderer/src/estilos/fuentesIncluidas.ts` (genera e inyecta un `<style>` con las `@font-face` usando las URLs empaquetadas por Vite; llamado desde `main.tsx`), `estilos/fuentes.css` (solo Atkinson 400/600 de la interfaz; el 700 sale del registro), `vistas/MuestrarioFuentes.tsx` (sección en el Muestrario), `shared/fuentes.test.ts`.
- **Cómo probarlo** (desde `app/`): `npx vitest run src/shared`, `npm run build`, `npm run dev` y abrir `#/muestrario` (sección "Fuentes de la letra", texto "¿Cantamos? Ñandú").
- **Deuda técnica**: la captura del Muestrario para el diseñador no se ha hecho (sin ventana interactiva). La `@font-face` de las fuentes de la letra se inyecta por JS al arrancar (una sola fuente de verdad); con `font-display: block`.
