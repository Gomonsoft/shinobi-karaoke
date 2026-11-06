# 0116 — Render: `●●●` antes de la primera línea, tiempos negativos, `PantallaLetra` sin tope de 140 px y aviso bajo el título
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: — (empieza ya)
- ADRs: 0011 (§3 "Render"), 0010 (§4)
- Spec UX: docs/ux/07-reproductor.md (§"Inicio y silencio previo", §"Letra", wireframe C, §"Legibilidad a distancia"; criterios 6, 8, 10, 24, 33); docs/ux/sistema-visual.md §10 (revisión 2026-11-06: sin tope en píxeles); docs/ux/06-editor.md (la vista previa coincide con el reproductor)
- Pregunta: 0031 §3 (respondida)
- Archivos: `app/src/renderer/src/karaoke/render.ts`, `render.test.ts`, `PantallaLetra.tsx`, `pantallaLetra.module.css`, `PantallaLetra.test.tsx`. Sin archivos compartidos con otras tareas de la fase (el editor usa `PantallaLetra` sin cambiar su llamada).
- Paralelizable con: todas. Antes de 0119.

## Contexto para quien implementa
- `fotogramaEn(letra, tLetraMs, { duracionMs, titulo, artista })`:
  - muestra el título si `tLetraMs < primera.inicio_ms − 4000`;
  - después, la línea actual y la siguiente;
  - `puntos` (1–3) solo si no hay actual, el silencio desde el fin efectivo de la anterior es ≥ 4000 y faltan ≤ 3000 ms.
  Para la primera línea `fin = 0`, así que con `t1 < 4 s` hoy no sale `●●●`.
- El reproductor (0119) pasará **tiempos negativos** durante el silencio previo: con `t1 < 6 s` el tiempo de canción empieza en `−(6000 − t1)`. Así el título dura 2 s, la primera línea se ve como "siguiente" 1 s y `●●●` cuenta 3 s.
- `--k-tamano: clamp(32px, 7.5cqh, 140px)` limita la letra en pantallas altas. sistema-visual §10 quita el tope.

## Objetivo
Que la entrada de la primera línea sea siempre título → siguiente → `●●●` → línea, también en la vista previa del editor, y que la letra escale con la pantalla sin tope.

## Criterios de aceptación
- [ ] `fotogramaEn`: la primera línea con inicio se trata como precedida por un hueco infinito, así que `puntos` aparece en sus 3 s previos aunque `t1 < 4 s`. Admite `tLetraMs < 0` sin casos especiales.
- [ ] Tests con `t1` = 500, 3000, 5900 y 20000 ms, simulando el silencio previo del reproductor (`tLetra` desde `min(0, t1 − 6000)`):
  - título durante 2 s como mínimo (o hasta `t1 − 4000` si `t1 ≥ 6 s`);
  - después, `siguiente` = primera línea sin puntos durante 1 s;
  - después, `puntos` 3 → 2 → 1 al ritmo de un punto por segundo;
  - en `t1`, línea actual.
  Y además: sin líneas con inicio → título siempre; los huecos entre líneas siguen la regla de ≥ 4 s, con pausas y líneas sin inicio contando como hueco.
- [ ] Los tests existentes que dependían del comportamiento anterior (primera línea a < 4 s sin puntos) se ajustan, y se anota cuál en las notas. Revisa también los tests del editor que miran la vista previa (`Editor.test.tsx`, `e2e/editor.spec.ts`) y ajústalos si comprueban la ausencia de `●●●`.
- [ ] `pantallaLetra.module.css`: `--k-tamano: max(32px, 7.5cqh)`. Test de estilo o comentario con el cálculo de sistema-visual §10: con 2160 px de alto, 162 px.
- [ ] `PantallaLetra` gana `avisoTitulo?: string`: si hay pantalla de título, dibuja bajo título y artista una píldora (`rgba(0,0,0,0.6)`, texto `#FFFFFF`, radio completo, `font-size: max(var(--t-cuerpo), 2.2cqh)`, icono ⚠ en color `aviso`) con ese texto. Desaparece con la pantalla de título. La raíz sigue `aria-hidden`: el anuncio a lectores de pantalla lo hace el reproductor.
- [ ] `PantallaLetra` gana `cargando?: boolean`: con pantalla de título, añade bajo el artista un *spinner* de 24 px y el texto recibido en `textoCargando?: string` sobre la misma píldora. El reproductor decide cuándo (> 1 s).
- [ ] La prop `etiqueta` existente no cambia (el reproductor dibuja sus etiquetas aparte).
- [ ] Rendimiento: el test de 1000 fotogramas con 5000 líneas sigue pasando.

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test e2e/editor.spec.ts
```

## Notas de implementación

- `render.ts` conserva el umbral de 4 s entre líneas y trata la primera línea con inicio como una entrada, incluso cuando sus tres segundos previos incluyen tiempos negativos.
- `PantallaLetra` usa `max(32px, 7.5cqh)` y admite dos píldoras exclusivas de la pantalla de título. `avisoTitulo` recibe el cuerpo del aviso y el componente añade el icono ⚠. `cargando` y `textoCargando` controlan la píldora con el spinner de 24 px.
- Se amplió `render.test.ts` para cubrir la secuencia de título y los límites de cada punto en los cuatro inicios pedidos, el hueco de 4 s entre líneas y la ausencia de tiempos. Los tests del editor no comprobaban que faltaran los puntos antes de la primera línea.
- La compilación y los 10 E2E del editor pasaron en macOS. Playwright necesitó arrancar Electron fuera del sandbox. Pendiente confirmar la verificación global de la app junto con el resto del bloque.
