# 0011 — API IPC tipada y preload
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0008, 0010
- ADRs: 0001, 0006, 0007
- Spec UX: —

## Objetivo
Exponer al renderer, mediante `contextBridge`, una API mínima, tipada y validada para biblioteca, configuración y sistema, con eventos de cambio.

## Criterios de aceptación
- [ ] Contrato único en `src/shared/ipc.ts`: nombre de cada canal, esquema Zod de argumentos y de respuesta. Preload y main lo importan; no hay cadenas de canal sueltas.
- [ ] `window.shinobi` expone: `biblioteca.listar()`, `obtener(id)`, `actualizarMetadatos(id, {titulo, artista, album})`, `volverABorrador(id)`, `eliminar(id)`, `mostrarEnCarpeta(id)`; `config.obtener()`, `config.actualizar(parcial)` (solo campos permitidos al renderer: `reproductor`, `separacion.modo`, `estilo_predeterminado`, `aviso_youtube_aceptado`); `sistema.info()` (versión, SO, plataforma); `sistema.abrirEnlace(url)` (solo `https:` a una lista blanca: web del proyecto, lrclib.net); y suscripciones `alCambiarCancion(cb)` y `alCambiarConfig(cb)` que devuelven una función para desuscribirse.
- [ ] Main valida **todos** los argumentos con Zod; argumentos inválidos → error tipado, nunca excepción sin controlar. Los errores llegan al renderer como `{ codigo, mensaje }`.
- [ ] El renderer no tiene acceso a `ipcRenderer` ni a Node; solo a `window.shinobi` (tipado en `src/renderer/src/env.d.ts`).
- [ ] Tests unitarios de los handlers (con servicios simulados) y una prueba E2E: `biblioteca.listar()` devuelve las canciones de la semilla.

## Notas de implementación
(las rellena el programador al terminar)
