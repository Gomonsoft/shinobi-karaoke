# 0025 — Empaquetado: electron-builder, *fuses* e instaladores sin firma
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0022, 0024 (y el gestor de runtime de la Fase 2 para probar el primer arranque empaquetado)
- ADRs: 0001, 0002, 0008
- Spec UX: docs/ux/01-primer-arranque.md (Parte A: instalación sin firma)

## Objetivo
Generar instaladores de la app para Windows, macOS y Linux según el ADR 0001 (no estaba planificado en ninguna fase: deuda de 0002), con la configuración de seguridad del ADR 0008.

## Criterios de aceptación
- [ ] `app/electron-builder.yml`: NSIS por usuario x64 (Windows), DMG arm64 (y x64 si es viable) con firma *ad hoc* (macOS), AppImage + deb x64 (Linux). Campos de firma presentes y desactivados. `appId`, nombre de producto "Shinobi Karaoke" y `AppUserModelID` coherentes (necesario para notificaciones en Windows, `arquitectura.md` §6).
- [ ] Contenido: app en asar; `resources/fonts`; binario `uv` por plataforma en `resources/bin/` (descargado en el build, con SHA-256 verificado); código fuente de `worker/shinobi_worker` + `pyproject.toml` + `uv.lock` como recurso fuera del asar. Nada de `spikes/`, tests ni `.datos-dev`.
- [ ] *Fuses* (ADR 0008 punto 9) aplicados con `@electron/fuses` en `afterPack`, y prueba de que la app empaquetada arranca con ellos.
- [ ] `LICENSE`, `THIRD_PARTY_NOTICES.md` (completado con las dependencias JS de producción y sus licencias, generado o revisado con una herramienta de licencias) y los `OFL.txt` incluidos en el paquete.
- [ ] Trabajo de CI (manual o por etiqueta) que genera los artefactos de los 3 SO y los publica como artefactos del workflow; prueba de humo E2E contra la app empaquetada en Linux.
- [ ] Tamaño de cada instalador anotado (objetivo ~100–150 MB, `arquitectura.md` "Restricciones" §1).

## Notas de implementación
(las rellena el programador al terminar)
