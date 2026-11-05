# 0084 — Vista Letra: búsqueda, resultados, vista previa y estados (wireframe A)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0077 (API falsa); 0043, 0016, 0018 (Hechas). Integración real con 0082.
- ADRs: 0005, 0008 (enlaces externos: `lrclib.net` ya está en `ENLACES_PERMITIDOS`, 0021)
- Spec UX: docs/ux/05-letra.md (wireframe A, componentes, estados, microcopy `let.*`, criterios 1–4, 6–8, 12–13, 18); docs/ux/00-mapa-de-vistas.md §2 (stepper)
- Cuándo: en cuanto esté 0077, con la API falsa; en paralelo con 0078–0083.

## Objetivo
Crear la vista `app/src/renderer/src/vistas/letra/` y montarla en `App.tsx` para `{ tipo: 'cancion', paso: 'letra' }`, en lugar del `Marcador`, con la cabecera y el stepper (0043) arriba. Esta tarea cubre el wireframe A. B y el diálogo de sustituir son de 0085; C es de 0086.

## Criterios de aceptación
- [ ] **Qué se muestra al entrar**:
  - si `contarLineas(cancion.letra) ≥ 1`, la vista C, que hasta 0086 es un marcador sencillo con el número de líneas;
  - si no, la A, que lanza **sola** `letras.buscar` con `usarCache: true` y los metadatos de la canción (criterio 1).
  Los textos van en `vistas/letra/textos.ts` con las claves `let.*` de `ux/05`.
- [ ] **Campos Título y Artista** prerrellenados y editables. Intro o **Buscar** lanzan `letras.buscar` sin caché y con los valores escritos, que el main guarda (0082). Con el título vacío, Buscar está deshabilitado.
- [ ] **Cargando**: tres filas esqueleto, "Buscando la letra…" y el botón en estado "Buscando…". "Pegar la letra" e "Importar" siguen disponibles. Los resultados de una búsqueda que vuelve tarde (rechazada con `CANCELADO`, o de otra canción) se ignoran.
- [ ] **Resultados** (`role="listbox"`, selección única, `aria-activedescendant`):
  - Cada opción muestra:
    - título — artista;
    - álbum (si hay) · duración `m:ss`;
    - **insignia** con icono + texto: ◆ palabra (`exito`), ◇ línea (`info`), ▭ texto (`texto-2`);
    - **comparación de duración** con `compararDuracion` (0077) y los textos `let.dur.*`, con el aviso (`aviso`) cuando no es igual.
  - El primer candidato viene seleccionado. ↑/↓ cambian la selección y la vista previa (criterio 4).
  - Encabezado "Resultados ({n})".
- [ ] **Vista previa**:
  - las ~15 primeras líneas con `[mm:ss.x]` si tienen tiempo, desplazable hasta el final;
  - las pausas como renglón vacío;
  - el total de líneas con `contarLineas`.
- [ ] **Atribución** "Letra: LRCLIB" bajo los resultados, como enlace que abre `https://lrclib.net` con `sistema.abrirEnlace`.
- [ ] **Banners**:
  - `LETRA_NO_ENCONTRADA` (`info`, con el foco en Título);
  - `INSTRUMENTAL` (`aviso`, `let.error.INSTRUMENTAL`) solo **sin** candidatos;
  - con `instrumental: true` **y** candidatos, banner `aviso` `let.aviso.instrumentalConCandidatos` encima de la lista, que se muestra y se usa con normalidad, con el foco en la lista (`preguntas/0022` §5, criterio 18);
  - `SIN_CONEXION` y `SERVICIO_NO_DISPONIBLE` (`aviso`, con [Reintentar]).
  "¿No es ninguna?" con [Pegar la letra] [Importar archivo .lrc o .txt] está **siempre visible** (criterio 7). Hasta 0085, esos botones llaman a funciones que 0085 implementa.
- [ ] **"Usar esta letra"** (primario y Ctrl/Cmd+Intro): llama a `letras.guardar({ origen: 'lrclib', lrclib_id, lineas })` con las líneas del candidato y, al terminar, muestra C con el foco en "Ir al editor". La confirmación de sustituir la añade 0085.
- [ ] **Foco inicial** en la lista si hay resultados; si no, en el campo Título. Esc no hace nada especial (el marco ya gestiona "‹ Biblioteca").
- [ ] **Resultados durante la sesión**: al volver a la vista sin haber elegido, se vuelven a mostrar gracias a `usarCache` (10 min); "Buscar" siempre consulta de nuevo (`preguntas/0022` §7, definitivo).
- [ ] Tests (Testing Library, API falsa de 0077):
  - búsqueda automática al entrar sin letra y no con letra;
  - los tres tipos de insignia y los tres de duración;
  - ↑/↓ actualizan la vista previa;
  - los cuatro banners y Reintentar;
  - instrumental con candidatos → `let.aviso.instrumentalConCandidatos` y lista; sin candidatos → `let.error.INSTRUMENTAL`;
  - Intro en Título busca con los metadatos nuevos;
  - respuesta tardía ignorada;
  - Ctrl/Cmd+Intro;
  - atribución → `abrirEnlace('https://lrclib.net')`.
  Más una revisión de accesibilidad con `axe` si la suite ya la usa.

## Notas de implementación
- Qué se hizo: vista Letra en `app/src/renderer/src/vistas/letra/` (`Letra.tsx` carga la canción y elige A o C; `BusquedaLetra.tsx` es el wireframe A; `modelo.ts` marcas `[mm:ss.x]`; `textos.ts` claves `let.*`; `letra.module.css`). Montada en `App.tsx` para `paso: 'letra'` en lugar del `Marcador`, con `CabeceraCancion`.
- Decisiones: C es un marcador (líneas + "Ir al editor", que navega a `paso: 'editor'`) hasta 0086. "Pegar" e "Importar" son props opcionales (`onPegar`, `onImportar`) sin efecto hasta 0085. INSTRUMENTAL, LETRA_NO_ENCONTRADA también se tratan si llegan como resultado vacío (`instrumental`) y no solo como error. Reintentar busca sin caché. Foco: lista si hay resultados, Título si no; en la búsqueda automática solo se mueve si el usuario no ha puesto el foco en otro sitio. Ctrl/Cmd+Intro en toda la vista. Sin axe (la suite no lo usa). Hay `eslint-disable` puntuales y justificados (patrón listbox con `aria-activedescendant`, región de vista previa enfocable, `set-state-in-effect` en la búsqueda inicial).
- Probar: `npx vitest run src/renderer/src/vistas/letra` (20 tests con la API falsa de 0077).
- Deuda: sin confirmación de sustituir (0085); C real (0086); sin E2E propio (0088).
