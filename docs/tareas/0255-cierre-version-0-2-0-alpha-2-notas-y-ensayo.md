# 0255 — Cierre: versión 0.2.0-alpha.2, notas y ensayo del workflow
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0244–0254 y 0256
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) (§2–§4 y «Revisión para 0.2.0 — fase 10»), [0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md)
- Spec UX: [09 §3](../ux/09-descarga-e-instalacion.md#3-notas-de-cada-release) (plantilla de notas a mano y criterios 24 y 25)
- ¿Red?: sí. Lanza el workflow en GitHub contra `alpha-2`. **No crea etiquetas `v*` ni *Releases*.** Etiquetar y publicar lo ordena el usuario.

## Objetivo
Dejar `alpha-2` con el número `0.2.0-alpha.2`, sus notas y un ensayo en verde, listo para el PR a `develop` (y después a `main`) y para la primera etiqueta publicada.

## Criterios de aceptación
- [ ] `npm run version:subir -- 0.2.0-alpha.2` en `app/`, y `npm run version:comprobar` pasa. El commit cambia los 5 sitios del ADR 0020 §2 y los enlaces del README e `INSTALAR.md` (sexto sitio, 0254), y nada más.
- [ ] `docs/versiones/0.2.0/notas/0.2.0-alpha.2.md` con la **plantilla de la spec 09 §3**: resumen; «Novedades» (lo de las fases 1–6 que ya resumía `0.2.0-alpha.1.md`, que nunca se publicó, más el número de compilación en Acerca de); «Correcciones» (exportación a resoluciones mayores que la pantalla en Windows, fallos de exportación en el registro, Esc en la ayuda de Formato e icono en las ventanas); «Sin probar en esta versión» (desde las guías manuales y la [ejecución en Windows](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) §8). El archivo lleva arriba la línea `> Borrador: …` hasta que el usuario lo revise: con esa línea el ensayo avisa, y la etiqueta fallaría a propósito (0252).
- [ ] **Paquete local**: `npm run empaquetar:dir` desde cero y `npm run test:paquete` con el `release/win-unpacked` nuevo. Las 6 pruebas pasan (QA I-9: dos fallaban sobre un paquete posiblemente anterior a los últimos cambios). `node scripts/verificar-paquete.mjs release/win-unpacked` pasa, con la comprobación del icono (0247). Si alguna falla con el paquete nuevo, se abre una tarea con el detalle y no se cierra esta.
- [ ] Con todo en `alpha-2` y en el remoto (lo sube la sesión principal): `gh workflow run empaquetado.yml --ref alpha-2`. Debe terminar en verde:
  - `comprobar-version` con `desarrollo = ensayo`;
  - `construir` con el número `0.2.0-alpha.2-<N>` en el resumen y la comprobación de icono en Windows;
  - `probar-instalador`, `preparar-publicacion` (tipo previa, etiqueta prevista `v0.2.0-alpha.2`, parte 1 de las notas y «Compilación» con el enlace a esa ejecución) y `preparar-desarrollo` (artefacto `compilacion-0.2.0-alpha.2-<N>` con los nombres de §3b);
  - `publicar` y `publicar-desarrollo`, omitidos.
- [ ] Descargados los artefactos: `sha256sum -c SHA256SUMS.txt` pasa en los dos, y ni `notas.md` ni `pie.md` tienen `⟦`, `{ENLACE_` ni `{MAYÚSCULAS}`.
- [ ] Instalado el NSIS del artefacto en este equipo, «Acerca de» muestra `0.2.0-alpha.2-<N>` con el canal `desarrollo` (es un ensayo) y el commit de `alpha-2`. `git rev-list --count <hash>` da N (AC7).
- [ ] `gh release list` sigue vacío y `git ls-remote --tags origin 'v*'` no devuelve nada.
- [ ] Backlog actualizado: estados de 0244–0256, y 0242 cerrada o con el resultado de Linux (0246).

## Pruebas de feedback
- Unitarias: ninguna nueva.
- E2E: ninguna nueva.
- Críticos: `npm run test:e2e:criticos` una vez, con todo integrado.
- Manual: `qa` añade a la guía de la versión (`docs/Test-manuales/0.2.0/`) los casos de alpha.2:
  - exportar 1440p, 4K y 2880 × 2160 en Windows con un monitor menor, y la línea de `app.log` de un fallo;
  - Esc en la ayuda de Formato;
  - el icono en la barra de tareas (desarrollo e instalada);
  - «Acerca de» y «Copiar detalles» con la *Release* instalada (AC1, AC6 y AC7);
  - «Primera publicación»: el usuario etiqueta `v0.2.0-alpha.2` sobre el commit fusionado en `main` y comprueba sin sesión los 4 instaladores, `SHA256SUMS.txt`, *pre-release*, las notas en dos partes con la frase de primera versión y los enlaces del README (criterios 17, 24, 25 y 30 de la spec 09);
  - canal de desarrollo, cuando el usuario lo configure (0143).

## Después de publicar (lo hace la sesión principal cuando el usuario lo ordene)
1. El usuario fusiona `develop` → `main`, crea y sube la etiqueta anotada `v0.2.0-alpha.2` (`docs/workflow.md`, «Publicar una versión») y sigue la ejecución.
2. Un PR a `develop` con `npm run version:subir -- 0.2.0-alpha.3` (ADR 0020, revisión de la fase 10, §2).

## Notas de implementación
