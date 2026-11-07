# Pendientes de la Fase 8

## Revisión prioritaria: Windows

Esta lista registra la revisión del instalador en un equipo Windows real. El paquete es de prueba interna; todavía no es una versión pública. Pasaron el [empaquetado](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42291261968) y el [CI de seis trabajos](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42295868094). El usuario probó el artefacto y aprobó cerrar la fase para Windows el 2026-11-07; los controles que no se registraron con detalle siguen como requisitos previos de la tarea 0142.

### Preparar el instalador

- [x] Descargar y ejecutar el artefacto de Windows de Actions (prueba confirmada por el usuario el 2026-11-07).
- [ ] Extraer el ZIP del artefacto con Windows y comprobar el SHA-256 del instalador contra el archivo `SHA256SUMS-*.txt` incluido.
- [ ] Anotar fecha, edición y versión completa de Windows, idioma, navegador y espacio libre en disco. Datos disponibles: Windows build `10.0.26200.9711`, x64; la app estaba en español. Edición, navegador y espacio libre no quedaron registrados.

### Descargar e instalar

- [ ] Descargar el artefacto desde el navegador y anotar cualquier aviso de descarga (Edge o Chrome, según disponibilidad).
- [ ] Registrar el texto literal y los botones de SmartScreen. El usuario confirma que apareció y pudo continuar; no se conservaron el texto literal ni una captura de esa pantalla.
- [ ] Confirmar que la instalación por usuario no pide permisos de administrador, crea accesos en Inicio y escritorio y abre la app al terminar.
- [ ] Guardar la captura de SmartScreen en `docs/imagenes/instalar/windows-smartscreen.png`. Ocultar datos personales antes de compartirla.

### Primer arranque y uso

- [ ] Registrar por separado los tiempos y el resultado de B1 → B2 → B3, con componentes y modelo Calidad. El usuario reporta haber probado las funciones del artefacto; no quedaron tiempos ni tamaño en disco.
- [x] Importar, separar y reproducir una canción (confirmado por el usuario, sin incidencias generales). NVIDIA GeForce RTX 4070, 12 GB; la ejecución se percibió muy rápida, sin medición de duración/modelo/audio.
- [ ] Repetir una comprobación sin conexión: confirmar que la app explica el problema y permite reanudar al volver la red.
- [ ] Comprobar una notificación mientras la ventana de la app no tiene el foco.
- [ ] En «Acerca de», abrir `LICENSE` y `THIRD_PARTY_NOTICES.md`.
- [ ] Registrar cuánto tardó la descarga, el espacio ocupado durante la instalación y si el primer arranque encontró algún problema.

### Desinstalación y reinstalación

- [ ] Desinstalar desde Windows y anotar el texto y resultado.
- [ ] Confirmar que los datos de la aplicación se conservan.
- [ ] Reinstalar y comprobar que se pueden reutilizar los datos existentes sin volver a descargar componentes y modelo.

## Registro de resultados de Windows

| Comprobación | Resultado / texto literal | Incidencias |
|---|---|---|
| Descarga y SHA-256 | El artefacto de Windows se descargó y probó; hash no confirmado | |
| SmartScreen | Apareció y el usuario continuó; texto literal/captura no registrados | Sin impedimento para ejecutar |
| Instalación y accesos | La app arrancó y se probó; UAC y accesos directos no registrados | |
| Primer arranque y modelo Calidad | Funcionalidades probadas según el usuario; tiempos y espacio no registrados | |
| Importar, separar y reproducir | Confirmado por el usuario; RTX 4070, ejecución percibida muy rápida, sin benchmark | |
| Reanudación sin conexión | Pendiente | |
| Notificación sin foco | Pendiente | |
| Licencias en «Acerca de» | Pendiente | |
| Desinstalar y conservar datos | Pendiente | |
| Reinstalar sin descargar de nuevo | Pendiente | |

## Hallazgo corregido durante la revisión

Al pulsar «Usar esta letra» mientras YouTube seguía descargando, el servicio rechazaba el guardado y la interfaz mostraba «No se pudo guardar la letra». El servicio ahora acepta guardar la letra durante la descarga; la vista muestra el indicador «Esperando la canción para continuar…» y mantiene inactivo «Ir al editor» hasta que el audio esté listo. La cobertura específica de main y renderer pasó (45 pruebas).

## Cierre de la fase

El usuario aprobó el artefacto interno de Windows y pidió cerrar la Fase 8 el 2026-11-07. Se acepta como cierre de la validación funcional en Windows. No es autorización de publicación: la verificación del SHA-256, el texto/captura de SmartScreen, la prueba sin conexión, licencias, notificaciones, desinstalación/reinstalación, macOS/Linux y las mediciones técnicas siguen antes de 0142.

Verificaciones locales de la corrección: `npm run lint`, `npm run typecheck`, `npm run format:check` y `npm run build` pasaron. Las pruebas enfocadas de servicio y vista Letra pasaron (45). La suite Vitest completa registró 1829 aprobadas y 42 omitidas; 8 fallaron al crear enlaces simbólicos (`EPERM` de Windows) en `appProtocolo.test.ts` y `medios.test.ts`. `uv` no está en el PATH de este equipo; no se ejecutó localmente `runtime-real`.

## Pendiente con menor prioridad

- **Linux**: se baja la prioridad por ahora. Quedan pendientes la comprobación manual de `.deb` y AppImage en un escritorio real y la decisión sobre el AppImage en Ubuntu, que puede arrancar con `--no-sandbox`. Se retomará antes de decidir la primera publicación.
- **macOS**: sigue pendiente probar el DMG en un Mac real, incluidos Gatekeeper, el primer arranque, el Dock y la verificación de firma tras usar la app.
- **Runtime**: faltan mediciones en equipos reales de descarga, caché y pico de disco, y validaciones del modelo Calidad en las plataformas y GPU indicadas por las tareas 0133, 0058 y 0062. Anotar las que no se puedan ejecutar como pendientes.
- **Publicación**: antes de crear una versión pública deben resolverse las decisiones y comprobaciones de la tarea 0142. Estos paquetes son solo artefactos internos de Actions.

## Fuentes del proyecto

- [Plan de fases](plan.md), Fase 8.
- [Prueba manual de instalación](tareas/0139-prueba-manual-de-instalacion-y-capturas.md).
- [Icono en los instaladores](tareas/0140-icono-de-la-app-en-los-instaladores.md).
- [Decisión pendiente sobre AppImage](preguntas/0045-appimage-sin-sandbox-en-ubuntu.md).
