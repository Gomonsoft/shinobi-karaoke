# 0025 — Empaquetado: electron-builder, *fuses* e instaladores sin firma
- Estado: **Desglosada** (2026-11-06) en las tareas 0127–0142; se cierra cuando se cierren. No se implementa como unidad.
- Paso del pipeline: 0 (distribución)
- Depende de: 0022, 0024 (y el gestor de runtime de la Fase 2 para probar el primer arranque empaquetado: 0035, 0038)
- ADRs: 0001, 0002, 0008, 0012, 0013
- Spec UX: docs/ux/09-descarga-e-instalacion.md (sustituye al detalle de la Parte A de docs/ux/01-primer-arranque.md; criterios 13 y 17 de esa spec)

## Objetivo
Generar instaladores de la app para Windows, macOS y Linux según el ADR 0001 (no estaba planificado en ninguna fase: deuda de 0002), con la configuración de seguridad del ADR 0008.

## Desglose: a qué tarea va cada criterio
Mezclaba configuración, licencias, CI, documentación y una prueba manual con requisitos y dependencias de red distintos. Ningún criterio se pierde:

| Criterio original | Tarea |
|---|---|
| `electron-builder.yml`: NSIS por usuario, DMG arm64, firma *ad hoc*, AppImage y deb, campos de firma desactivados | 0130 |
| Sin subir `LSMinimumSystemVersion` | 0130 (configuración), 0131 (comprobación) |
| `appId`, nombre de producto y `AppUserModelID` coherentes | 0130 (test), 0139 (notificación real) |
| App en asar; `resources/fonts` | 0130, 0131 |
| `uv` por plataforma con SHA-256 verificado | 0129 (descarga), 0130 y 0131 (paquete) |
| Código del worker, `pyproject.toml` y `uv.lock` fuera del asar | 0130, 0131 |
| Nada de `spikes/`, tests ni `.datos-dev` | 0131 |
| *Fuses* del ADR 0008 aplicados | 0130 (con `electronFuses`, no en `afterPack`: ADR 0012 §3), 0131 (lectura) |
| La app arranca con los *fuses* | 0135 |
| `LICENSE`, `THIRD_PARTY_NOTICES.md` y `OFL.txt` en el paquete | 0130, 0131, 0135 (lectura real) |
| Dependencias JS en los avisos, con herramienta de licencias | 0132 |
| Dependencias Python transitivas ("se revisarán al empaquetar") | 0133 |
| CI manual o por etiqueta, artefactos del workflow | 0136 (solo manual: ADR 0013) |
| Prueba de humo E2E contra la app empaquetada en Linux | 0135, 0136 y 0137, ampliada a los 3 SO según lo que permita cada runner |
| Tamaño de cada instalador anotado | 0136 |
| Worker en `resources/worker`, requisitos y `runtime-manifest.json` | 0130, 0131 |
| `LICENSE` y `THIRD_PARTY_NOTICES.md` en `process.resourcesPath` | 0130, 0131 |
| Ninguna ruta descarga Rápido sin `rapido_aceptado` | 0134 |
| README "Descargar" e `INSTALAR.md` | 0138 (sin versión, E0), 0142 (con versión, E1) |
| Línea de requisitos, botón de macOS, "¿Qué Mac tengo?", Gatekeeper y "¿Sigue sin abrirse?" | 0138, 0142 (texto de `ux/09`) |
| **`ux/09` criterio 14**: corregir "~1–2 GB" en la tabla de requisitos del README | 0138 |
| **`ux/09` §5**: prueba manual P1–P16 | 0139 |
| Una captura por SO antes de la primera versión pública (criterio 13) | 0139 (`ux/09` §7), 0142 (la exige) |
| Enlaces a la última *Release* | 0142, bloqueada por `preguntas/0035` |

Trabajo añadido por el desglose: 0127 (dependencias y metadatos), 0128 (worker sin *bytecode*, necesario para no romper la firma), 0140 (icono), 0141 (texto de B6b).

Los criterios siguientes se conservan como referencia. **Mandan las tareas y los ADR 0012 y 0013.** Por ejemplo: la "página de descarga" y la Parte A de `ux/01` están ahora en `ux/09`, sin botones con detección de SO.

## Criterios de aceptación (originales)
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
