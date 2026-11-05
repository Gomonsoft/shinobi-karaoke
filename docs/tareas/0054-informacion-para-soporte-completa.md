# 0054 — "Copiar información para soporte" completa: versión del SO, arquitectura real, yt-dlp y `sin instalar`
- Estado: Hecha
- Paso del pipeline: —
- Depende de: 0038 (Hecha), 0031, 0050
- ADRs: 0003 (actualización de yt-dlp), 0009 (Revisiones: plataforma real)
- Spec UX: docs/ux/08-ajustes-y-acerca.md ("Copiar información para soporte", criterio 9); respuesta a `preguntas/0013` ("Además")

## Objetivo
Completar el texto que copia "Copiar información para soporte" del componente `AcercaDe` (0038). Faltan la arquitectura real, la versión de yt-dlp y la fecha de su última comprobación (útiles ante `YOUTUBE_BLOQUEADO`, ya que yt-dlp se actualiza solo). Además debe funcionar igual sin motor instalado, cuando se abre desde B0, B1, B6 o B6b. La línea del SO incluye su versión (`ux/08`, tras `preguntas/0017` §4).

## Criterios de aceptación
- [ ] `sistema.info()` añade `versionSo` (la misma de 0031: `process.getSystemVersion()`, p. ej. `14.5` en macOS, no la del núcleo Darwin), `arquitectura` (la **real** de 0031: `arm64` bajo Rosetta/emulación, más `emulada: boolean`) e `ytdlp: { version: string | null, ultimaComprobacion: string | null }` (contrato de 0029/0011 ampliado con Zod; campos opcionales para no romper llamadas existentes).
- [ ] `versionYtDlp()` en `main/runtime/ytdlp.ts` (0050) lee la versión del venv **sin lanzar Python**: el nombre del directorio `yt_dlp-<versión>.dist-info` en el `site-packages` del venv, o su archivo `METADATA`. Sin empaquetar se lee `worker/.venv`. Si no hay venv o no está el paquete, devuelve `null`. `ultimaComprobacion` = `config.ultima_comprobacion_ytdlp`.
- [ ] `infoSoporte()` (`vistas/acerca/AcercaDe.tsx`) copia, siempre en este orden y sin omitir líneas:
  - versión de la app;
  - SO **con su versión** y arquitectura real, con "(emulada)" si procede (p. ej. `macOS 14.5 · arm64`, `Windows 10.0.22631 · arm64 (emulada)`; `ux/08`, actualizado tras `preguntas/0017` §4);
  - perfil de hardware;
  - modo de separación;
  - `yt-dlp: <versión>`;
  - `Última comprobación de yt-dlp: <fecha ISO o legible>`.
  Cualquier dato que no exista todavía (sin motor, perfil sin detectar, yt-dlp sin instalar, nunca comprobado) se copia como **`sin instalar`**. Se mantiene el toast "Información copiada".
- [ ] Funciona desde el `DialogoAcercaDe` del primer arranque (B0/B1/B6/B6b) sin errores aunque no exista `runtime/`.
- [ ] Tests: `infoSoporte` con todo instalado (línea del SO con versión, p. ej. `macOS 14.5`), sin motor (todas las líneas presentes con `sin instalar`) y con arquitectura emulada; `versionYtDlp` con un `site-packages` falso (con y sin `dist-info`) en un directorio temporal; handler de `sistema.info` con los campos nuevos.

## Notas de implementación
- `InfoSistema` (`shared/ipc.ts`) gana, opcionales, `versionSo`, `arquitectura` (real), `emulada` y `ytdlp: { version, ultimaComprobacion }`. El handler `sistema.info` admite ahora `infoSistema()` asíncrono; `main/index.ts` lo rellena con `versionSistema()` y `plataformaReal(...)` (de `runtime/deteccion.ts`, ahora exportada), `app.runningUnderARM64Translation` y `versionYtDlp` (de 0050, sin lanzar Python). Venv: `<datos>/runtime/venv` en modo producción; sin él (desarrollo), `worker/.venv`. Si no existe, `version: null`.
- `infoSoporte()` (`vistas/acerca/AcercaDe.tsx`) copia siempre seis líneas en orden fijo; lo que falta va como `sin instalar` (perfil, yt-dlp, última comprobación; la fecha cae a `config.ultima_comprobacion_ytdlp`). La línea del SO es `macOS 14.5 · arm64` / `Windows 10.0.22631 · arm64 (emulada)`; si `info` no trae `versionSo` usa `info.so`. La fecha se copia en ISO.
- Tests: `AcercaDe.test.tsx` (todo instalado, sin motor, emulada), `ytdlp.test.ts` (site-packages sin dist-info de yt-dlp), `handlers.test.ts` (campos nuevos).
- Para 0037 (B6b): no hace falta IPC nuevo. Llamar a `window.shinobi.sistema.info()` y pasar el resultado y `config.obtener()` a `infoSoporte` si se quiere el mismo texto; `DialogoAcercaDe` ya lo usa vía `AcercaDe`. `info.versionSo` y `info.arquitectura` están ahí para "Copiar detalles".
- Verificación: lint, typecheck, format:check y vitest OK salvo fallos ajenos por trabajo concurrente de 0037 (`App.test.tsx` "Primer arranque", `PrimerArranque.test.tsx` mock sin `config`) y e2e `humo.spec.ts` (espera el heading "Primer arranque"). 18 e2e pasan.
- Deuda: no se lee `METADATA` como alternativa al nombre del `dist-info`.
