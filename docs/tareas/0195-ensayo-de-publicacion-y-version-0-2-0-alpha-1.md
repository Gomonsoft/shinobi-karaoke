# 0195 — Versión 0.2.0-alpha.1 y ensayo de publicación con `workflow_dispatch`

- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0191, 0192, 0193, 0194
- ADRs: 0020, 0013
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§3)
- ¿Red?: sí: lanza el workflow en GitHub contra `alpha-2`. **No crea etiquetas `v*` ni _Releases_.**

## Objetivo

Dejar `alpha-2` con el número de la primera alfa y demostrar en GitHub, sin publicar, que el workflow construye, prueba y prepara una _Release_ previa completa.

## Criterios de aceptación

- [ ] `npm run version:subir -- 0.2.0-alpha.1` en `app/`; `npm run version:comprobar` pasa; el commit solo cambia los 5 sitios de versión del ADR 0020 §2 (y las expectativas de tests que dependan del número real, si las hubiera; los dobles con `'0.1.0'` se dejan).
- [ ] Borrador de `docs/versiones/0.2.0/notas/0.2.0-alpha.1.md`: novedades de las fases cerradas de 0.2.0 (desde los informes de fase) y una sección "Sin probar en esta versión" con lo que sigue pendiente de las guías manuales y de la puerta de la tarea 0142. Lo revisa el usuario antes de la etiqueta.
- [ ] Con todo en `alpha-2` y en el remoto (lo sube la sesión principal), `gh workflow run empaquetado.yml --ref alpha-2`. La ejecución termina en verde hasta `preparar-publicacion`; `publicar` aparece como omitido.
- [ ] El resumen muestra tipo **previa**, etiqueta prevista `v0.2.0-alpha.1`, los 4 instaladores con tamaño y SHA-256, y la línea "Ensayo: no se ha publicado nada".
- [ ] Se descarga el artefacto `publicacion-0.2.0-alpha.1` y se comprueba en local: `sha256sum -c SHA256SUMS.txt` pasa; `notas.md` empieza por la cabecera, lleva el aviso de previa y las notas de la versión, sin ⟦…⟧ ni `{…}`.
- [ ] Anotado qué devolvió `needs.probar-instalador.result` con la entrada informativa (criterio de 0193), con el enlace a la ejecución.
- [ ] `gh release list` sigue vacío y `git ls-remote --tags origin 'v*'` no devuelve nada tras el ensayo.

## Pruebas de feedback

- Unitarias: ninguna nueva (las de 0191–0194).
- E2E: ninguna.
- Críticos: no.
- Manual: `qa` añade a la guía manual de la versión (`docs/Test-manuales/0.2.0/`) el caso "Primera publicación": el usuario crea y sube la etiqueta `v0.2.0-alpha.1` sobre el commit fusionado en `main`, sigue la ejecución, y comprueba sin sesión iniciada que la _Release_ es _pre-release_, no es "Latest", tiene los 5 recursos, las notas de §3 y los archivos de código; descarga un instalador y comprueba su suma. Incluye lo que la guía ya cubre de SmartScreen, Gatekeeper y AppImage.

## Notas de implementación

(las rellena el programador al terminar)
