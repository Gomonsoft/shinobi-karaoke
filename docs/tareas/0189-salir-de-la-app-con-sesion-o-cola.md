# 0189 — Salir de la app con sesión o cola

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0181](0181-servicio-de-sesion-e-ipc-en-main.md) (motivo en `app:solicitudCierre`) y [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md) (textos)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §1 y §9 (salir con sesión o cola, variante de macOS), respuesta [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (4A)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) («Salir de la app con sesión o cola», S13) y la spec 04 (diálogo de cierre con trabajos)

## Objetivo

Elegir y mostrar el diálogo de cierre correcto cuando se sale de la app o se cierra la ventana principal con una sesión o con una cola.

## Contrato

- `DialogoCierre` lee el motivo de `app:solicitudCierre` y elige:
  - solo sesión o cola: `ses.salir`, con la variante «sin sesión, con cola»;
  - además, trabajos en curso: el diálogo de la spec 04 con `ses.salir.extra`;
  - en macOS, al cerrar la ventana principal: la variante «macOS, cerrar ventana» (la cola se conserva).
- El foco empieza en «Cancelar». Al confirmar se llama a `app.confirmarCierre()`, como hoy. Cancelar no cambia nada: la sesión sigue y la cuenta no se toca.

## Archivos

`app/src/renderer/src/navegacion/{DialogoCierre.tsx,textosCierre.ts}` y sus pruebas.

## Criterios de aceptación

- [x] S13 de la spec 02 en Vitest para cada combinación de motivos (sesión, cola sin sesión, sesión y trabajos, y la variante de macOS).
- [x] E2E: con sesión, Ctrl/Cmd + Q muestra `ses.salir`. «Salir» cierra las dos ventanas, y al volver a abrir la app la cola está vacía.

## Notas de implementación

### Qué se hizo

- `DialogoCierre.tsx` lee el motivo de `app:solicitudCierre` (`sesion`, `cola`, `variante`). Sin trabajos pero con sesión o cola muestra `ses.salir` (con sesión; sin sesión y con cola; macOS «¿Cerrar la ventana?»), con foco en «Cancelar». Con trabajos sigue un solo diálogo, el de la spec 04, y se le añade `ses.salir.extra` (en macOS, `extraMac`: solo avisa del reproductor, porque la cola se conserva). Sin nada en curso responde al instante, como antes. Confirmar llama a `app.confirmarCierre()`; cancelar no toca nada.
- `textosCierre.ts`: `textosSalirConSesion` y `cuerpoCierre(n, titulos, motivo?)`. `sesion/textos.ts`: se añade `SES.salir.extraMac`.
- Pruebas: Vitest (`DialogoCierre.test.tsx`, S13: sesión, cola sin sesión, sesión y trabajos, macOS, cancelar) y una spec nueva en `e2e/sesion-main.spec.ts` (con sesión, `app.quit()` muestra `ses.salir`; «Salir» cierra las dos ventanas; al reabrir no hay sesión ni cola).

### Cómo probarlo

`cd app && npm run test:cambios && npm run test:e2e:cambios`.

### Desviaciones y deuda

- `ses.salir.extraMac` es un texto nuevo (la spec no define el extra para macOS); es la primera frase de `cuerpoMac`.
- El E2E anterior de la sesión cerraba con `app.close()`, que ahora pide confirmación y se colgaba; sale con `app.exit(0)`.
- `npm run test:e2e:criticos` falla en `flujo-principal` (no aparece «Revisa los datos de la canción» tras «Elegir archivo…», antes de cualquier cierre): parece del entorno local, no del cambio.
- A mano (guía de Test-manuales): en macOS, cerrar la ventana principal con sesión muestra «¿Cerrar la ventana?», y Cmd + Q muestra «¿Salir…?».
