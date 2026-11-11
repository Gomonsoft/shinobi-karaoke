# 0189 — Salir de la app con sesión o cola

- Estado: Pendiente
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

- [ ] S13 de la spec 02 en Vitest para cada combinación de motivos (sesión, cola sin sesión, sesión y trabajos, y la variante de macOS).
- [ ] E2E: con sesión, Ctrl/Cmd + Q muestra `ses.salir`. «Salir» cierra las dos ventanas, y al volver a abrir la app la cola está vacía.

## Notas de implementación
