# 0249 — «Acerca de» con número de compilación, canal y «Copiar versión»
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0248
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §2
- Spec UX: [08 · Fase 10](../ux/08-ajustes-y-acerca.md#fase-10-de-020--número-de-compilación) (wireframes, componentes, estados, accesibilidad, microcopy `aj.acerca.*`, AC1–AC5 y AC8)
- Versión: 0.2.0-alpha.2 · Fase 10, punto 3

## Objetivo
Mostrar en «Acerca de» (Ajustes y el diálogo del primer arranque, que comparten bloque) el número de compilación, la línea de canal con el commit y el botón [Copiar versión]. La primera línea de «Copiar información para soporte» pasa a ser `Shinobi Karaoke {identificador}`.

## Contrato
- `app/src/renderer/src/vistas/acerca/AcercaDe.tsx` (comprobado: la versión se pinta en la línea 101 con `T.version(info.version)` e `infoSoporte` empieza en la 46 con `Shinobi Karaoke ${info.version}`), `DialogoAcercaDe.tsx` y `textos.ts`.
- Todo el texto sale de `shared/compilacion.ts` (0248): `numeroVisible`, `hashCorto` e `identificador`. No se forman cadenas a mano.
- Línea de canal según el canal y si es previa (sufijo de la versión), con estos colores e iconos de la spec: `aviso` + ⚠ en `desarrollo`, `texto-3` en `local`. Hash en monoespaciada y sin enlace.
- [Copiar versión]: botón fantasma pequeño; copia `Shinobi Karaoke {identificador}`; toasts `aj.acerca.toast.version` y `aj.acerca.toast.versionError`; nombre accesible `aj.acerca.copiarVersion.aria`; el foco se queda en el botón.
- `infoSoporte` cambia solo su primera línea. El resto del bloque y su orden no cambian (criterio 9 de la spec 08).
- Mientras `sistema.info()` no responde: ni líneas ni botón (como hoy).

## Criterios de aceptación
- [ ] AC1–AC5 de la spec 08 · Fase 10, con `InfoSistema` falsos para `publicada` previa, `publicada` estable, `desarrollo` y `local` con y sin commit.
- [ ] Nunca aparecen `undefined`, `null`, `NaN` ni `-` final (AC3).
- [ ] AC8: capturas `docs/ux/revision-fase-10/ajustes-1280x800-100-acerca-{previa|desarrollo|local}.png` para la revisión del diseñador. Son las únicas capturas de la tarea: se generan con una spec E2E *opt-in*, como las de fases anteriores.

## Pruebas de feedback
- Unitarias: `AcercaDe.test.tsx`, con los 4 estados, [Copiar versión] con el portapapeles bien y mal, y la primera línea de `infoSoporte`.
- E2E: solo la *opt-in* de capturas (AC8).
- Críticos: no (no es el flujo principal); sí si se toca `shared/`, cosa que no debería hacer falta.
- Manual: AC1 con la app de la *Release* `v0.2.0-alpha.2` instalada (guía de la versión).

## Notas de implementación
