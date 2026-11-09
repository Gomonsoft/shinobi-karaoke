# 0161 — Persistir la distribución de paneles

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0155](0155-preferencia-de-paneles-en-config-y-ventana-minima.md), [0160](0160-modos-minimizados-con-controles-rapidos.md). El hook y sus tests se pueden escribir tras 0155 y 0156. La conexión con el editor, tras 0160.
- ADRs: [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--preferencias-de-paneles-del-editor), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles)
- Specs: [Editor, subfase 2.1 · Persistencia](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor)

## Objetivo

Los tres tamaños preferidos y los tres estados minimizado/expandido se guardan para todas las canciones en `config.editor.paneles` (contrato de 0155). Se recuperan al abrir cualquier canción y tras reiniciar la app.

## Enfoque

- Hook `vistas/editor/usePreferenciasPaneles.ts`:
  - Lee `config.obtener()` al montar el editor. Mientras llega la respuesta, usa los valores por defecto de `shared/paneles.ts` sin parpadeo visible: la rejilla se pinta con el defecto y aplica la preferencia en el mismo fotograma o en el siguiente.
  - Escucha `alCambiarConfig` para mantener la copia en memoria.
  - Expone `preferencias` y `actualizar(parcial, motivo)`.
- **Cuándo se escribe** (`config.actualizar({ editor: { paneles: … } })`):
  - Al confirmar un arrastre (`alConfirmar`).
  - 500 ms después de la última tecla en un divisor (*debounce*).
  - Al minimizar o expandir por acción del usuario.
  - Al restablecer.
  - **Nunca** durante el arrastre ni por la minimización por falta de espacio, el modo sincronizar o la disposición bajo mínimo.
- Antes de enviar, se redondea a entero y se acota a los límites absolutos de `shared/paneles.ts`. Un rechazo del IPC se registra en consola de desarrollo y no muestra aviso: es una preferencia cosmética. El estado en memoria se conserva.
- `linea_tiempo.alto` se guarda como `null` hasta que el usuario actúa sobre el divisor del dock. Restablecer vuelve a `null`, para que el defecto siga el modo compacto.
- Al salir del editor con una ráfaga de teclado pendiente, se envía en el desmontaje (sin esperar respuesta).
- Ni el historial de deshacer ni `useGuardadoEditor` intervienen.

## Archivos

- `app/src/renderer/src/vistas/editor/usePreferenciasPaneles.ts`, `usePreferenciasPaneles.test.ts` (nuevos).
- `app/src/renderer/src/vistas/editor/Editor.tsx` (sustituir el estado en memoria de 0159/0160 por el hook).
- `app/src/renderer/src/vistas/editor/fixturesApi.ts` (doble de `config` con `editor.paneles`, si hace falta).
- `app/e2e/editor-layout.spec.ts`.

## Criterios de aceptación

- [ ] Criterios 21–23 de la spec.
- [ ] Vitest con temporizadores falsos: un arrastre produce **una** llamada a `config.actualizar` al soltar y ninguna durante el movimiento. Cinco flechas seguidas producen una llamada a los 500 ms. Minimizar produce una llamada inmediata. La minimización por espacio y el modo sincronizar no producen ninguna.
- [ ] E2E: cambiar los tres tamaños y minimizar dos zonas, cerrar la app, relanzarla con el mismo `SHINOBI_DATOS` y abrir **otra** canción: mismos tamaños y estados. `config.json` contiene exactamente esos valores.
- [ ] E2E: sembrar `config.json` con lista 480 y panel 480 y abrir a 1024 de ancho. Se dibujan recortados sin scroll de página y `config.json` no cambia. Al agrandar a 1920 se ven a 480. Con `linea_tiempo.alto: 600` a 1280 × 720 ocurre lo mismo en alto.
- [ ] E2E: sembrar `config.json` con `editor.paneles` corrupto o fuera de rango. El editor arranca con los valores por defecto, sin aviso y sin `config.json.danado`. El resto de la configuración sigue intacto (por ejemplo `reproductor.volumen`).
- [ ] Redimensionar o minimizar no crea pasos de deshacer ni cambia el indicador de guardado, y `cancion.json` no se escribe.

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas/editor`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor-layout.spec.ts`.

## Notas de implementación

- Hecho: `usePreferenciasPaneles.ts`. El editor arranca con el `config.editor.paneles` que ya trae `config.obtener()` al abrir (sin parpadeo: el primer fotograma ya usa la preferencia), mantiene la copia con `alCambiarConfig` (no adopta cambios mientras haya una escritura propia en vuelo o una ráfaga sin enviar, para que el eco no pise el estado local) y expone `preferencias` y `actualizar(siguiente, motivo)`. Escritura: inmediata al confirmar un arrastre, minimizar, expandir y restablecer; 500 ms tras la última tecla (`ESPERA_TECLADO_MS`); al desmontar con una ráfaga pendiente se envía sin esperar. Nunca durante el arrastre, ni por la minimización por falta de espacio, ni por el modo sincronizar ni por «bajo mínimo» (esas rutas no llaman a `actualizar`). Se redondea y acota a los límites absolutos (`normalizarPreferencias`). `linea_tiempo.alto` sigue en `null` hasta que se actúa sobre el dock y «Restablecer» lo devuelve a `null`. Un rechazo del IPC solo se registra en la consola de desarrollo.
- `fixturesApi.ts`: el doble de `config` guarda `editor.paneles` y emite `alCambiarConfig`. `Editor.tsx` usa el hook en lugar de un estado en memoria.
- Pruebas: `usePreferenciasPaneles.test.ts` (8: sin escritura al montar, una llamada al confirmar, cinco flechas en una llamada a los 500 ms, la inmediata sustituye a la ráfaga, envío al desmontar, normalización, rechazo del IPC y eco en vuelo), `Editor.paneles.test.tsx` (arrastre sin escritura hasta soltar y una sola llamada, minimizar una llamada, sin espacio ninguna, preferencia recortada sin sobrescribir) y, en E2E: reinicio con el mismo `SHINOBI_DATOS` y otra canción (mismos tamaños y estados, `config.json` con esos valores), preferencias 480/480/600 recortadas a 1024 de ancho y a 1280 × 720 sin cambiar `config.json` y recuperadas al agrandar, y preferencia corrupta (valores por defecto, sin aviso ni `config.json.danado`, `reproductor.volumen` intacto).
- Cómo probarlo, desde `app/`: `npm test -- src/renderer/src/vistas/editor` y `npm run test:e2e -- e2e/editor-layout.spec.ts`.
