# 0263 — Importar letras sin tiempos por palabra

- Estado: Hecha
- Paso del pipeline: 3 (letra)
- Fase: 8 de 0.2.1 · Lote B1 (contratos y main de letras)
- Depende de: 0262 (mismo lote: comparte `shared/letrasBusqueda.ts`), 0261 (`palabrasVisibles` para el exportador LRC)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §5; [0005](../adr/0005-letras-y-formato-de-sincronia.md#revisión-para-021--fases-8-y-9)
- Spec UX: [05 · Letra](../ux/05-letra.md) (insignias de sincronía) con la opción provisional de la pregunta [0149](../preguntas/0149-indicador-por-palabra-en-la-vista-letra.md)
- Tamaño: S

## Objetivo

Que ninguna importación nueva (LRCLIB, LRC mejorado pegado o en archivo) cree tiempos por palabra, conservando el fin de línea que daban, y que la vista Letra deje de prometer «por palabra».

## Archivos (solo estos)

- `app/src/main/letras/lyricsfile.ts` y su test
- `app/src/shared/letras/lrc.ts`, `normalizar.ts` y `letras.test.ts`
- `app/src/shared/letrasBusqueda.ts` (solo comentarios de `sincroniaDe`, si cambian)
- `app/src/renderer/src/vistas/letra/` (insignia y resumen de sincronía: `modeloElegida.ts` y el componente que pinta `let.sync.*`) y sus tests

## Criterios de aceptación

- [ ] Una letra de LRCLIB con `hasWordSync` se guarda con `palabras: null` en todas sus líneas. El fin fijado de cada línea es su `end_ms` si cumple la regla vigente; si no, el `end_ms` de su última palabra, con la misma regla (`inicio < fin < inicio del siguiente elemento con tiempo`, o última línea).
- [ ] Un LRC mejorado (`<mm:ss.xx>`) produce el mismo texto de línea que hoy y `palabras: null`; el cierre de la última palabra abierta se usa como fin de la línea con la misma regla.
- [ ] La búsqueda sigue ordenando primero los registros con sincronía por palabra (`sincroniaDe` no cambia).
- [ ] La vista Letra muestra esos candidatos y la letra actual como «Sincronizada por línea» / «sincronizada por línea» (provisional de 0149; si el diseñador responde otra cosa, se aplica su texto). `let.sync.palabra` y `let.actual.sync.palabra` dejan de usarse.
- [ ] El exportador LRC (sin interfaz) solo escribe palabras de `palabrasVisibles`.

## Pruebas de feedback

- Unitarias: `lyricsfile` con y sin `end_ms` de línea y de palabra; LRC mejorado con la última palabra abierta y cerrada; insignia de la vista Letra.
- E2E: `e2e/letras.spec.ts` solo si alguna aserción busca «por palabra» (ajustar el texto y ejecutar esa spec con `npx playwright test e2e/letras.spec.ts`).
- Críticos: sí (`main/`, `shared/`).
- Manual: guía de la fase 8 — buscar una canción con sincronía por palabra en LRCLIB, guardarla y comprobar que el editor la barre por línea.

## Notas de implementación

- **Hecho**: `convertirLyricsfile` y `lrcALetra` dejan `palabras: null`. Fin de línea: `end_ms` de la línea si `inicio < fin < siguiente`; si no, el `end_ms` **explícito de la última palabra** con la misma regla (LRCLIB), y en LRC mejorado el fin (cierre o estimado) de la última palabra con la misma regla; la marca final vacía sigue fijando el fin de la última línea. El exportador (`exportar` en `lrc.ts`) solo escribe `palabrasVisibles(e, inicio del siguiente)`. `busqueda.ts`: `sincroniaOrden` mantiene `palabra` en el candidato de un registro con `hasWordSync` solo para ordenar (`sincroniaDe` no cambia). Vista Letra: los candidatos `palabra` se ven como ◇ «Sincronizada por línea» (`BusquedaLetra.tsx`); `sincroniaActual` devuelve `palabra` solo con palabras `origen_palabras: "manual"` (0149); se retiró `TEXTO.sync.palabra` y `.sync_palabra`.
- Archivos: `main/letras/{lyricsfile,busqueda}.ts` y tests, `shared/letras/lrc.ts` y `letras.test.ts`, `renderer/src/vistas/letra/{BusquedaLetra.tsx,modeloElegida.ts,textos.ts,letra.module.css}` y tests, `e2e/letras.spec.ts` (aserciones «por palabra» → «por línea»; **escrito sin ejecutar**: `npx playwright test e2e/letras.spec.ts`). `normalizar.ts` no cambió.
- Interpretación: «última palabra con `end_ms` explícito» = la última palabra de la línea, si tiene `end_ms`.
- Manual (guía de la fase 8): buscar en LRCLIB una canción con sincronía por palabra, guardarla y comprobar que el editor la barre por línea.
