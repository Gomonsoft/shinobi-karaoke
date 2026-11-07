# Pendientes de la Fase 8

## Revisión prioritaria: Windows

Esta lista sirve para revisar el primer instalador en un equipo Windows real. El paquete es de prueba interna; todavía no es una versión pública. Pasaron el [empaquetado](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42291261968) y el [CI de seis trabajos](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42295868094), pero faltan estas comprobaciones manuales.

### Preparar el instalador

- [ ] Abrir la [ejecución de empaquetado 42291261968](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42291261968) y descargar el artefacto de Windows.
- [ ] Extraer el ZIP del artefacto con Windows y comprobar el SHA-256 del instalador contra el archivo `SHA256SUMS-*.txt` incluido.
- [ ] Anotar fecha, edición y versión de Windows (10/11), arquitectura, idioma, navegador y espacio libre en disco.

### Descargar e instalar

- [ ] Descargar el artefacto desde el navegador y anotar cualquier aviso de descarga (Edge o Chrome, según disponibilidad).
- [ ] Ejecutar el instalador y registrar el texto literal de SmartScreen. Si aparece «Windows protegió su PC», comprobar «Más información» y «Ejecutar de todas formas».
- [ ] Confirmar que la instalación por usuario no pide permisos de administrador, crea accesos en Inicio y escritorio y abre la app al terminar.
- [ ] Guardar la captura de SmartScreen en `docs/imagenes/instalar/windows-smartscreen.png`. Ocultar datos personales antes de compartirla.

### Primer arranque y uso

- [ ] Completar B1 → B2 → B3 y llegar a la Biblioteca con los componentes y el modelo Calidad descargados.
- [ ] Importar un audio propio o generado, separar voz e instrumental, y reproducir la canción.
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
| Descarga y SHA-256 | Pendiente | |
| SmartScreen | Pendiente | |
| Instalación y accesos | Pendiente | |
| Primer arranque y modelo Calidad | Pendiente | |
| Importar, separar y reproducir | Pendiente | |
| Reanudación sin conexión | Pendiente | |
| Notificación sin foco | Pendiente | |
| Licencias en «Acerca de» | Pendiente | |
| Desinstalar y conservar datos | Pendiente | |
| Reinstalar sin descargar de nuevo | Pendiente | |

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
