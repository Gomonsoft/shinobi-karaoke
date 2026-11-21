# 0260 — Sondeo de perfiles con una captura real y «Reintentar» tras un fallo de captura

- Estado: Pendiente
- Paso del pipeline: 6 (exportación)
- Fase: 7 de 0.2.1 · Lote A (exportación)
- Depende de: 0258 (mismo lote: `servicio.ts` y el diálogo), 0283 (`detalle` del error en `shared/ipc.ts`). 0244 y 0246 ya están hechas.
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) §1 y §2 de la revisión para 0.2.1; respuesta a [0146](../preguntas/0146-captura-reintentar-y-errores-tempranos-de-la-exportacion.md) §1 y §2
- Spec UX: [10 · Fase 7](../ux/10-exportacion.md#fase-7-de-021--perfiles-capturables-reintentar-y-errores-tempranos), secciones «Perfiles que el equipo no puede capturar» y «Fallo de captura al exportar y «Reintentar»» (tabla de acciones por código); criterios **V31**, **V32**, **V33** y **V34**; claves `exp.perfil.noSoportado` (motivo `captura`), `exp.error.captura`, `exp.error.capturaPasajera`
- Tamaño: M

## Objetivo

Que el diálogo no ofrezca perfiles que el equipo no puede capturar ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-2: 0 de 48 marcados aunque 18 fallaban) y que el fallo ofrezca «Reintentar» cuando repetir puede funcionar. Cierra también la [0242](0242-captura-4k-en-linux-con-tamano-incorrecto.md).

## Archivos (solo estos)

- `app/src/main/exportacion/ventana.ts`, `servicio.ts` y sus tests (`sondearCaptura`; `screen` no hace falta: el sondeo es una vez por arranque)
- `app/src/shared/exportacion.ts` (motivo `captura` en `MotivoPerfilNoSoportado`) y su test
- `app/src/renderer/src/exportacion/dialogo/**` (motivo `captura`, acciones de D por código) y sus tests
- `app/e2e/exportacion-captura.spec.ts`

## Criterios de aceptación

- [ ] `perfiles()` lanza a la vez el sondeo de codificadores y `sondearCaptura`: por proporción, de la resolución mayor a la menor, ventana offscreen con las opciones de exportación (sin preload ni rol, `about:blank`), `setContentSize`, primera carga, `capturePage()` y comparación del tamaño; el primer tamaño exacto es el máximo capturable. Ventanas de una en una, destruidas al momento, ≤ 3 s cada una.
- [ ] Los perfiles mayores que el máximo de su proporción salen `soportado: false, motivo: "captura"` (V31). Lo que no esté comprobado a los 10 s sale `no_comprobado` (V32). Una excepción del sondeo no marca nada y se registra en `app.log`. El resultado dura todo el arranque.
- [ ] Un trabajo que falla con `PERFIL_NO_SOPORTADO` por la captura vuelve a sondear ese tamaño antes de cerrarse y lleva `detalle: { causa: "captura", reintentable }`; con `false`, el perfil queda `captura` hasta reiniciar.
- [ ] D aplica la tabla «Reintentar en el diálogo de fallo» de la spec para todos los códigos, con el primario y el foco indicados (V34); `exp.error.captura` sin [Reintentar] y foco en [Cambiar opciones], que abre A con el perfil soportado más cercano por debajo y `exp.anuncio.resolucion`; `exp.error.capturaPasajera` con foco en [Reintentar] (contrato de 0133) (V33).
- [ ] En el equipo de referencia (3440 × 1440, con 0244) no aparece ningún perfil con `captura` (V31, comprobado en la guía).
- [ ] `exportacion-captura.spec.ts` deja de **omitir** 3840 × 2160 en Linux: si la captura es exacta lo comprueba; si no, comprueba que `exportacion.perfiles()` marca 3840 × 2160 y 2880 × 2160 con `captura`. `qa` actualiza la regla 10 de `docs/pruebas.md` (anótalo en las notas para la sesión principal).
- [ ] La 0242 pasa a `Hecha` con la nota «resuelta por 0260: marcado previo; Linux real con GPU en la guía» y el enlace a la ejecución del CI de Linux.

## Pruebas de feedback

- Unitarias: `ventana.test.ts`/`servicio.test.ts` con dobles de ventana que recortan a 2159 líneas, que tardan más de 10 s y que lanzan excepción; recomprobación con `reintentable` `true` y `false`; pruebas del diálogo D por código (V34).
- E2E: `npx playwright test e2e/exportacion-captura.spec.ts` (cambiada) tras `npm run build`.
- Críticos: sí (`main/`).
- Manual: guía de la fase 7 — caso 10.1 de la guía de la fase 6 (perfiles del diálogo) en Windows con monitor < 4K y, si hay equipo, Linux con GPU (8.10).

## Notas de implementación
