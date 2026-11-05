# 0025 — Empaquetado: electron-builder, *fuses* e instaladores sin firma
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0022, 0024 (y el gestor de runtime de la Fase 2 para probar el primer arranque empaquetado: 0035, 0038)
- ADRs: 0001, 0002, 0008
- Spec UX: docs/ux/01-primer-arranque.md (Parte A: instalación sin firma; criterios 13 y 17)

## Objetivo
Generar instaladores de la app para Windows, macOS y Linux según el ADR 0001 (no estaba planificado en ninguna fase: deuda de 0002), con la configuración de seguridad del ADR 0008.

## Criterios de aceptación
- [ ] `app/electron-builder.yml`: NSIS por usuario x64 (Windows), **solo DMG arm64** (Mac Intel no compatible en el MVP, decisión del usuario en `preguntas/0016`, opción C; sin subir `LSMinimumSystemVersion`: la app comprueba macOS ≥ 14 y muestra B6b, `preguntas/0015`) con firma *ad hoc* (macOS), AppImage + deb x64 (Linux). Campos de firma presentes y desactivados. `appId`, nombre de producto "Shinobi Karaoke" y `AppUserModelID` coherentes (necesario para notificaciones en Windows, `arquitectura.md` §6).
- [ ] Contenido: app en asar; `resources/fonts`; binario `uv` por plataforma en `resources/bin/` (descargado en el build, con SHA-256 verificado); código fuente de `worker/shinobi_worker` + `pyproject.toml` + `uv.lock` como recurso fuera del asar. Nada de `spikes/`, tests ni `.datos-dev`.
- [ ] *Fuses* (ADR 0008 punto 9) aplicados con `@electron/fuses` en `afterPack`, y prueba de que la app empaquetada arranca con ellos.
- [ ] `LICENSE`, `THIRD_PARTY_NOTICES.md` (completado con las dependencias JS de producción y sus licencias, generado o revisado con una herramienta de licencias) y los `OFL.txt` incluidos en el paquete.
- [ ] Trabajo de CI (manual o por etiqueta) que genera los artefactos de los 3 SO y los publica como artefactos del workflow; prueba de humo E2E contra la app empaquetada en Linux.
- [ ] Tamaño de cada instalador anotado (objetivo ~100–150 MB, `arquitectura.md` "Restricciones" §1).

- [ ] (Añadido en el desglose de la Fase 2, ADR 0009) El código del worker se copia a `process.resourcesPath/worker` (lo usa `resolverLanzador` en producción, 0035) junto con `worker/requisitos/*.txt` y `app/resources/runtime-manifest.json`; `LICENSE` y `THIRD_PARTY_NOTICES.md` en `process.resourcesPath` (los lee 0038). ~~Ninguna versión **pública** con el modelo Rápido sin respuesta de UVR (`preguntas/0012`, Seguimiento).~~ Sustituido (2026-11-05, `preguntas/0018`): se puede publicar porque Rápido solo se descarga con el consentimiento del usuario (tarea 0057); antes de publicar, comprobar que ninguna ruta descarga Rápido sin `rapido_aceptado`.

- [ ] (Añadido 2026-11-04, `preguntas/0017` §3 y §6) **Página de descarga y guía de instalación** (`ux/01` Parte A completa, criterios 13 y 17). Esta tarea es la responsable de publicarlas. Decisión del arquitecto: sin web propia en el MVP (nada de infraestructura que no haga falta). La página de descarga es la sección "Descargar" del `README.md` raíz, que enlaza la última *Release* de GitHub, y la guía "Instalar Shinobi Karaoke" vive en `INSTALAR.md` en la raíz, enlazada desde el README y desde las notas de cada *Release*:
  - Línea de requisitos de la Parte A §2: "Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · …" y debajo "Los Mac con procesador Intel no son compatibles por ahora."
  - Botón o enlace de macOS con el texto "Descargar para Mac con chip Apple", con el requisito siempre visible debajo y "¿Qué Mac tengo?" (menú Apple → Acerca de este Mac: "Chip" sí, "Procesador Intel" todavía no). No se intenta detectar Intel desde el navegador.
  - Gatekeeper: "Alternativa solo en macOS 14 Sonoma: clic derecho → Abrir → Abrir. En macOS 15 o posterior no existe; usa el paso 3."
  - "¿Sigue sin abrirse?" con las dos entradas de macOS ("no es compatible con este Mac" → es un Mac Intel; "dice «Necesitas actualizar macOS»" → actualizar gratis, enlazando la página oficial de Apple `https://support.apple.com/es-es/108382`, "Actualizar macOS en el Mac", comprobada el 2026-11-04; es la misma URL que abre B6b, 0036/0037).
  - Una captura por SO antes de la primera versión pública (criterio 13). Los enlaces del README y de `INSTALAR.md` no pasan por la app, así que no afectan a `ENLACES_PERMITIDOS`.

## Notas de implementación
(las rellena el programador al terminar)
