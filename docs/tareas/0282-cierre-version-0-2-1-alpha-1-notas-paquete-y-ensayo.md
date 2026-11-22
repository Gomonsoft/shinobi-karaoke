# 0282 — Cierre de la versión 0.2.1-alpha.1: notas, icono, paquete y ensayo

- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Fase: cierre de 0.2.1 (después de todos los lotes)
- Depende de: 0271, 0280, 0281 (y, por ellas, todas las de 0.2.1)
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) §2–§4 y revisión de la fase 10; [0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md); [0012](../adr/0012-empaquetado-con-electron-builder-fuses-uv-y-licencias.md) (icono)
- Spec UX: [09 §3](../ux/09-descarga-e-instalacion.md#3-notas-de-cada-release) (plantilla de notas) y §1.1b (README E½); [sistema visual §1.1](../ux/sistema-visual.md) (icono definitivo)
- Tamaño: M
- ¿Red?: sí. Lanza el workflow en GitHub contra la rama de la versión. **No crea etiquetas `v*` ni *Releases***: etiquetar y publicar lo ordena el usuario.

## Objetivo

Dejar `version-0.2.1` con su número, sus notas, el icono cerrado y un ensayo en verde, listo para el PR.

## Criterios de aceptación

- [ ] **Número**: la rama ya está en `0.2.1-alpha.1`; `npm run version:comprobar` pasa. Si el usuario responde a [0150](../preguntas/0150-publicar-0-2-1-sin-sufijo.md) con `0.2.1`, `npm run version:subir -- 0.2.1` y comprobar de nuevo (README pasaría a E1: avisar a la sesión principal, no lo decide esta tarea).
- [ ] **README** ([0144](../preguntas/0144-readme-en-e0-o-e-medio-antes-de-publicar.md)): preguntar a la sesión principal si `v0.2.0-alpha.2` está publicada y descargable. Con un sí, aplicar `docs/versiones/0.2.0/plantillas/estado-e-medio.md` con la versión de `package.json`, y pasar `version:comprobar` y `app/scripts/guia-instalacion.test.ts`. Con un no, sigue en E0.
- [ ] **Notas** `docs/versiones/0.2.1/notas/0.2.1-alpha.1.md` con la plantilla de la spec 09 §3: resumen; «Novedades» (editor preciso de línea, pestaña «Funciones», «Editar» en las tarjetas, agrupar por fecha de añadido, barra de carga, doble clic para escuchar la línea, icono definitivo); «Cambios» (palabras importadas que ya no se usan y fin automático que puede cambiar, sin S ni desplazamiento, velocidad con tono conservado solo en el editor preciso); «Correcciones» (perfiles de exportación que el equipo no captura, estimación de tamaño, carpeta sin permiso, canción ya exportándose); «Sin probar en esta versión» (de los informes de las fases 7–9). Con la línea `> Borrador: …` arriba hasta que el usuario la revise.
- [ ] **Icono (tarea [0140](0140-icono-de-la-app-en-los-instaladores.md))**: `node scripts/icono.mjs` no cambia `build/icon.png` ni `build/icon.ico` (están al día); `empaquetar:dir` sin el aviso del icono de Electron; `node scripts/verificar-paquete.mjs release/win-unpacked` pasa. Se anotan en 0140 los criterios que quedan para la guía manual (barra de tareas, DMG/Dock, menú de Linux) y los tamaños de los instaladores del ensayo, y la 0140 pasa a `Hecha` (la spec §1.1 ya describe el icono definitivo).
- [ ] **Paquete local**: `npm run empaquetar:dir` desde cero y `npm run test:paquete` (con `SHINOBI_PAQUETE_PERFIL=cuda` en este equipo, notas de 0255) pasan.
- [ ] **Ensayo**: con la rama en el remoto (lo sube la sesión principal), `gh workflow run empaquetado.yml --ref version-0.2.1` en verde: `comprobar-version` (`desarrollo = ensayo`), `construir` con `0.2.1-alpha.1-<N>` y la comprobación de icono, `probar-instalador`, `preparar-publicacion` (previa, etiqueta prevista `v0.2.1-alpha.1`) y `preparar-desarrollo`; `publicar` y `publicar-desarrollo` omitidos. `sha256sum -c SHA256SUMS.txt` pasa y las notas no tienen `⟦`, `{ENLACE_` ni `{MAYÚSCULAS}`.
- [ ] `docs/versiones/0.2.1/backlog.md` con los estados finales y `git ls-remote --tags origin 'v0.2.1*'` vacío.

## Pruebas de feedback

- Unitarias: ninguna nueva.
- E2E: ninguna nueva.
- Críticos: `npm run test:e2e:criticos` una vez con todo integrado.
- Manual: `qa` reúne en `docs/Test-manuales/0.2.1/` las guías de las fases 7–9 (de los informes 0281, 0271 y 0280) y los casos del icono y de «Acerca de» con el número de compilación.

## Después de publicar (lo ordena el usuario)

1. Fusión a `develop` y `main`, etiqueta anotada `v0.2.1-alpha.1` ([flujo de Git](../workflow.md), «Publicar una versión»).
2. PR a `develop` con `npm run version:subir -- 0.2.1-alpha.2` (ADR 0020, revisión de la fase 10, §2).

## Notas de implementación
