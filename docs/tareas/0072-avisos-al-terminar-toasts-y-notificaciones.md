# 0072 — Avisos al terminar o fallar un trabajo: toasts, notificaciones del sistema, Dock y barra de tareas
- Estado: Hecha
- Paso del pipeline: transversal (1 y 2)
- Depende de: 0059; integración real con 0065 (se prueba antes con eventos falsos del gestor)
- ADRs: 0008 (permisos: las notificaciones salen del main, no del renderer)
- Spec UX: docs/ux/04-progreso-pipeline.md §3 (tabla de avisos, criterios 10 y 10b; `prog.toast.*`); `preguntas/0005` §9
- Cuándo: en paralelo con 0069, 0070 y 0071

## Objetivo
Componente "Avisos del sistema" de `arquitectura.md` §2 y §6: que el usuario sepa que su separación (o descarga) ha terminado o ha fallado aunque esté en otra vista o en otra aplicación.

## Criterios de aceptación
- [x] **Renderer, en otra vista de la app**, cuando un trabajo termina:
  - separación completada → `prog.toast.ok` [Abrir], o `prog.toast.lista` [Abrir editor] si la canción ya cumple las condiciones para marcarse como lista (`puedeMarcarseComoLista`);
  - fallo → `prog.toast.error` persistente [Ver];
  - cancelado o interrumpido → sin toast.
  Si el usuario está en la vista de progreso de esa canción, no hay toast.
- [x] **Main, con la ventana sin foco o minimizada** (`main/avisos/`):
  - Windows y Linux: `Notification` con el mismo texto; un clic trae la ventana y abre la canción (evento al renderer). Además, `win.flashFrame(true)` hasta recuperar el foco. Si `Notification.isSupported()` es `false` o la notificación emite `failed`, solo el parpadeo, sin errores visibles.
  - macOS: `app.dock.bounce('informational')` una vez e insignia `app.dock.setBadge(String(n))` con el número de avisos pendientes. No se intenta la notificación nativa (app sin firmar, `arquitectura.md` §6).
  - Al recuperar el foco: los toasts pendientes se muestran y se borran la insignia y el parpadeo.
- [x] Windows: `app.setAppUserModelId` con el id del instalador. Si no lo está ya, coordinarlo con 0025.
- [x] Puertos inyectables (`Notificador`, `Dock`, `Ventana`) para los tests. En E2E se sustituyen por un registro (variable `SHINOBI_AVISOS_PRUEBAS`, ignorada si `app.isPackaged`, mismo patrón que `SHINOBI_PAPELERA_PRUEBAS`) que 0075 consulta.
- [x] Tests: con foco y otra vista → toast; en la vista de progreso → sin toast; sin foco en cada SO simulado → notificación o rebote más insignia; `failed` → sin error; recuperar el foco → limpieza; toast de error persistente.

## Notas de implementación
- **Reparto**: main decide y redacta (`app/src/main/avisos/`); el renderer solo muestra. `ServicioAvisos` se suscribe al gestor (`alCambiarTrabajo`), convierte cada trabajo terminado en un `AvisoTrabajoIpc` (`avisoDeTrabajo`: separación `completado` -> `ok` o `lista` según `puedeMarcarseLista` (nombre real en el código; la tarea decía `puedeMarcarseComoLista`); `error` de separación o de descarga -> `error` con el título del error y **sin la oferta de Rápido**; cancelado, interrumpido y descarga completada -> nada, porque la separación encadenada avisa al terminar) y lo envía siempre al renderer (`eventos.avisoTrabajo`). Con la ventana sin foco o minimizada: Windows/Linux `Notification` + `flashFrame` (sin soporte o `failed` -> solo parpadeo, se registra); macOS `dock.bounce('informational')` + `dock.setBadge(n)` (sin notificación nativa). Al recuperar el foco (`ventana.on('focus')`) se borran insignia y parpadeo. Clic en la notificación: trae la ventana y envía `eventos.abrirCancion`.
- **Renderer**: `navegacion/useAvisosTrabajos.ts` (montado en `App`): toast `exito`/`error` con acción [Abrir] / [Abrir editor] / [Ver] (las acciones hacen que el toast no caduque, regla de 0016, así el de error es persistente); no hay toast en la vista de progreso de esa canción; sin foco (`document.hasFocus()`) los avisos esperan y se muestran al volver (`focus`). `window.shinobi.avisos.{alAviso, alAbrirCancion}` en preload e `ipc.ts`.
- **Textos** en `shared/avisos.ts` (`AVISOS`, `tituloErrorAviso`): los mismos para toast y notificación; un test comprueba que los títulos de error coinciden con los de `vistas/progreso/textos.ts` (copia deliberada: main no importa del renderer).
- **Puertos** `Notificador`, `Dock`, `Ventana` (`servicio.ts`) y adaptadores de Electron (`puertos.ts`). `SHINOBI_AVISOS_PRUEBAS=<archivo>`: escribe una línea JSON por llamada (`notificacion` con `cuerpo`, `rebote`, `insignia` con `texto`, `parpadeo` con `activo`), la ventana cuenta siempre como sin foco; se ignora empaquetada. Para 0075.
- **Windows**: `app.setAppUserModelId(ID_APP_WINDOWS)` con `com.shinobikaraoke.app` (`shared/titulo.ts`). `electron-builder.yml` aún no existe: **0025 debe usar ese mismo `appId`**.
- **Tests**: `main/avisos/servicio.test.ts`, `puertos.test.ts`, `renderer/navegacion/useAvisosTrabajos.test.tsx` (`npx vitest run src/main/avisos src/renderer/src/navegacion`). `e2e/ipc.spec.ts` incluye la clave `avisos`.
- **Deuda**: sin prueba E2E propia ni verificación manual en Windows/Linux reales (0075); la insignia solo cuenta avisos de la sesión; los avisos pendientes del renderer se pierden si se recarga la ventana.
