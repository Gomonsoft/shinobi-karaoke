# 0139 — Prueba manual de instalación (P1–P16) y capturas
- Estado: En curso (revisión manual prioritaria en Windows; macOS pendiente y Linux en prioridad baja por ahora)
- Paso del pipeline: 0 (distribución)
- Depende de: 0136, 0137, 0138; icono (0140) para las capturas definitivas
- ADRs: 0012, 0013
- Spec UX: docs/ux/09-descarga-e-instalacion.md §5 y §7; docs/ux/01-primer-arranque.md, criterios 13 y 17
- Preguntas: 0041, 0042, 0043, 0044
- ¿Red?: sí. **Con el runtime y los modelos reales**: es la única prueba del primer arranque con la app empaquetada. Es manual.

## Objetivo
Comprobar lo que ningún runner puede ejecutar, antes de la primera versión pública.

## Requisitos previos
Descargar el instalador **con un navegador** desde el artefacto del workflow, sin copiarlo desde el build: así lleva la marca de descarga o la cuarentena reales. Descomprimir el zip del artefacto con la herramienta del sistema.

## Parte 1 — Textos del sistema (`ux/09` §5)
Anotar SO, versión, idioma y **texto literal**, y quitar de la guía las variantes que no aparezcan:

| Id | Qué | Dónde |
|----|-----|-------|
| P1 | "Windows protegió su PC" | Windows 10 y 11 |
| P2 | "Más información" | Windows 10 y 11 |
| P3 | "Ejecutar de todas formas" | Windows 10 y 11 |
| P4 | Aviso del navegador al descargar y su botón | Edge y Chrome |
| P5 | "Aceptar" o "Listo", y "Mover a la Papelera" | macOS 14, 15 y actual |
| P6 | Ajustes o Configuración del Sistema; "Abrir igualmente", "Abrir de todos modos" o "Abrir"; orden de los pasos | macOS 15 y actual; en macOS 14, el botón |
| P7 | "Aceptar" u "OK" tras la contraseña | macOS 15 y actual |
| P8 | Clic derecho → Abrir → Abrir | macOS 14 |
| P9 | Mensaje en un Mac Intel | Mac Intel, si hay uno disponible |
| P10 | Nombre de la opción de ejecutar en Propiedades | Ubuntu LTS (GNOME), Linux Mint |
| P11 | Doble clic en un `.deb` | Ubuntu LTS, Debian, Linux Mint |
| P12 | Mensaje del Control inteligente de aplicaciones | Windows 11 con la función activada |
| P13 | Desinstalar con la app real | Windows 10 y 11 |
| P14 | "Ir" → "Ir a la carpeta…" | macOS |
| P15 | Alerta «está dañada» con firma *ad hoc*. Si aparece, comprobar el sello en el Mac de destino y registrar si la alerta ofrece una salida | macOS 14, 15 y actual |
| P16 | Arranque del AppImage y el `.deb` con la restricción de AppArmor activa. Registrar si interviene FUSE y si aparece `--no-sandbox` | Ubuntu 24.04 |

## Parte 2 — Comprobaciones técnicas
- [ ] **Gatekeeper** (`preguntas/0041`): en macOS 14, 15 y actual, texto y botones de la alerta. **Si aparece "está dañada" sin "Abrir igualmente"**: se detiene y se escala (0041 punto 3).
- [ ] Abrir la app directamente desde la ventana del DMG, sin arrastrarla: anotar qué pasa y si el primer arranque funciona (0041 punto 4).
- [ ] Tras "Abrir igualmente", `uv` del paquete y Python descargado se ejecutan sin más avisos.
- [ ] Tras varios arranques y una separación, `codesign --verify --deep --strict` sigue siendo válido: nada escribió dentro del paquete.
- [ ] Mac con chip Apple y macOS 13: se ve B6b. Con macOS 12 o anterior, si hay equipo: anotar el mensaje del sistema (Electron 45 declara mínimo 13.0).
- [ ] Windows: instalador de un clic sin pedir permisos; acceso en escritorio y menú Inicio; se abre al terminar; notificación con la ventana sin foco (`AppUserModelID`).
- [ ] Ubuntu 24.04 o posterior, escritorio real: `.deb` y AppImage arrancan sin cambios en el sistema; ver con `ps` si el AppImage añade `--no-sandbox`.
- [ ] Datos conservados al desinstalar y reinstalar sin volver a descargar (`preguntas/0043`).

## Parte 3 — Primer arranque real, una vez por SO
- [ ] B1 → B2 → B3 → Biblioteca, con Python, componentes y modelo Calidad reales.
- [ ] Importar audio generado o propio, separar y reproducir.
- [ ] Sin red: B2 informa y reanuda.
- [ ] Acerca de muestra `LICENSE` y `THIRD_PARTY_NOTICES.md`; los `OFL.txt` están en `resources/fonts`.

## Parte 4 — Capturas (`ux/09` §7, criterio 13 de `ux/01`)
- [ ] `docs/imagenes/instalar/windows-smartscreen.png` (C-WIN).
- [ ] `docs/imagenes/instalar/macos-privacidad-y-seguridad.png` (C-MAC).
- [ ] `docs/imagenes/instalar/linux-appimage-permisos.png` (C-LIN).
- [ ] Según las reglas de §7: sin datos personales, recuadro de 3 px, 800 px de ancho como máximo.

## Criterios de aceptación
- [ ] Tabla de resultados P1–P16 en las notas, con los no aplicables justificados.
- [ ] Mediciones del plan: bytes de descarga reales y pico de disco (0058), separación con Calidad en Windows y Linux CPU, NVIDIA y otros chips Apple. Las que no se puedan medir se anotan como pendientes y las valora la 0142.
- [ ] Preguntas 0041–0043 actualizadas con los datos reales.
- [ ] Lista de cambios para el diseñador en `ux/09`, sin editar la spec desde esta tarea.

## Notas de implementación
(las rellena quien ejecute la prueba)

La revisión actual empieza en Windows. Lista operativa y registro: [`../pendientes-fase-8.md`](../pendientes-fase-8.md). El resto de plataformas y las comprobaciones de runtime que no se ejecuten quedan anotadas como pendientes; bajar la prioridad de Linux no equivale a aprobarlo para publicación.
