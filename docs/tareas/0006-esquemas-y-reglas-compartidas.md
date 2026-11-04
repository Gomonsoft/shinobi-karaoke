# 0006 — Esquemas y reglas de dominio compartidas (cancion.json, config.json, errores, JSON Lines)
- Estado: Pendiente
- Paso del pipeline: 5 (afecta a todos)
- Depende de: 0002
- ADRs: 0005, 0006, 0007
- Spec UX: docs/ux/00-mapa-de-vistas.md §3 y §7 (paso actual, códigos de error), docs/ux/sistema-visual.md §8 (estilo predeterminado), docs/ux/06-editor.md criterio 7d (palabras que se mueven con su línea)

## Objetivo
Una única fuente de verdad en `app/src/shared/` para los formatos de datos y las reglas derivadas que usarán main y renderer.

## Criterios de aceptación
- [ ] Esquemas Zod y tipos inferidos para `cancion.json` versión 1 exactamente como ADR 0006 (revisión 2026-11-03): `metadatos`, `fuente` (con `mezcla`), `pistas` (nullable), `letra` (nullable) con elementos `tipo: "linea" | "pausa"`, `estilo` v1 (sólido/degradado con 2–4 paradas, colores `#RRGGBB`, ángulo 0–359, `fuente.origen` solo `"incluida"` en el MVP), `pasos` con sus estados y `error {codigo, mensaje}`.
- [ ] Validación de los invariantes de la letra de ADR 0006 (inicios crecientes, `inicio < fin ≤ siguiente inicio`, pausas sin texto ni palabras, sin pausas consecutivas ni al principio/final, **palabras** solo en líneas con inicio, crecientes, dentro de `[inicio de la línea, inicio del siguiente elemento con inicio]`), con mensajes de error comprensibles.
- [ ] Esquema de `config.json` v1 (ADR 0006): `instalacion`, `separacion` (`modo`, `modelos_descargados`, `factores_medidos`), `reproductor` (`volumen`, `silenciado`), `aviso_youtube_aceptado`, `ultima_comprobacion_ytdlp`, `estilo_predeterminado`; con **valores por defecto** para campos ausentes (lectura tolerante). El estilo predeterminado es el de `sistema-visual.md` §8.
- [ ] Función de migración `migrarCancion(json)` / `migrarConfig(json)` con la versión 1 como única versión (estructura preparada para versiones futuras) y prueba de que rechaza `esquema` > 1.
- [ ] Catálogo de códigos de error estables (`arquitectura.md` "Restricciones" §3 + `ARGUMENTOS_NO_VALIDOS`, `ERROR_INTERNO`, `DEMO_FALLO`) como constante tipada.
- [ ] Esquemas de los mensajes JSON Lines del worker (`progreso`, `log`, `resultado`, `error`).
- [ ] Funciones puras con tests: `pasoActual(cancion)` (orden fuente → separación → letra → edición, ADR 0006), `motivosParaNoEstarLista(cancion)` (lista de motivos: pistas, líneas sin inicio con su número), `puedeMarcarseLista`, `estaIncompleta` (lista con líneas sin inicio), `contarLineas` (excluye pausas), `vistaAlContinuar(cancion)` según la tabla de `ux/00-mapa-de-vistas.md` §3.
- [ ] Operaciones puras sobre la letra (las usará el editor de la Fase 5; `ux/06` criterio 7d), que devuelven una letra nueva que cumple los invariantes:
  - `moverInicioLinea(letra, id, nuevoInicioMs)`: si la línea tiene `palabras`, todas se desplazan el mismo delta (inicio y fin). Si tras el cambio las palabras de esa línea o de la anterior ya no caben en su intervalo, se descartan (`palabras: null`, la línea pasa a barrido progresivo) y el resultado lo indica (`palabrasDescartadas: [ids]`) para que el editor pueda deshacer o avisar. No toca `fin_ms`; si un fin fijado deja de cumplir `inicio < fin ≤ siguiente inicio`, pasa a `null` (automático) y también se indica.
  - `borrarTiemposLinea(letra, id)`: `inicio_ms`, `fin_ms` y `palabras` a `null`.
  - Tests: desplazamiento hacia delante y atrás con palabras, descarte en el límite, línea sin palabras, y que `finEfectivo` sigue siendo coherente tras mover.
- [ ] Fixtures de ejemplo en `app/src/shared/__fixtures__/` (borrador recién creado, separando, sin letra, letra a medias con 1 y con varias líneas sin inicio, lista, lista con palabras, lista incompleta con 1 y con varias líneas, con error, interrumpido) reutilizables por los tests y por el script `semilla` (0009).
- [ ] Cobertura de tests ≥ 90 % en `shared/`.

## Notas de implementación
(las rellena el programador al terminar)
