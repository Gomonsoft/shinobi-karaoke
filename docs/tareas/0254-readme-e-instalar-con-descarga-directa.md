# 0254 — README e `INSTALAR.md` con descarga directa, y enlaces como sexto sitio de la versión
- Estado: Hecha (README en E0 a la espera de 0140/0144; E½ preparado)
- Paso del pipeline: 0 (distribución)
- Depende de: — (puede ir en paralelo con todo; la versión real de los enlaces la pone 0255 con `version:subir`)
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §5
- Spec UX: [09](../ux/09-descarga-e-instalacion.md) §1.1b (E½), §1.4 (botones SVG), §1.5 (canal en «Desarrollo»), §2 («Si el navegador bloquea la descarga» y aviso E½), §4 y criterios 17, 18 y 21–23, 27 y 28
- Versión: 0.2.0-alpha.2 · Fase 10, punto 5

## Objetivo
Pasar el README de E0 («Todavía no hay ninguna versión publicada») a E½: un botón de descarga directa por sistema que apunta a la etiqueta concreta, pasos numerados y el aviso de bajar solo desde la página del proyecto. `INSTALAR.md` gana el aviso E½ y el apartado del navegador. `version.mjs` mantiene la versión de esos enlaces.

## Contrato
- **Botones**: los 4 SVG de §1.4 en `docs/imagenes/descarga/`, escritos a mano según la spec (sin scripts, `<foreignObject>` ni recursos externos; con `role="img"` y `<title>`).
- **`README.md`**:
  - sección «Descargar» con el texto de §1.1b y los enlaces `https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v<versión>/<archivo>` y `…/releases/tag/v<versión>`, escritos con la versión **actual** del repositorio (la de `app/package.json`);
  - §1.5 en «Desarrollo» **solo si** `Gomonsoft/shinobi-karaoke-builds` ya existe y responde sin sesión. Si no, se deja anotado en las notas de la tarea y en 0255, para añadirlo cuando el usuario lo cree (0143). Un enlace a un repositorio inexistente no se publica.
- **`INSTALAR.md`**: el aviso E½ en lugar del E0, «Si el navegador bloquea la descarga» (Chrome y Edge), enlazada desde el índice y desde el paso 1 de Windows (§2).
- **`app/scripts/version.mjs`** (sexto sitio):
  - `subir` reescribe en `README.md` y en `INSTALAR.md` todas las apariciones de `github.com/Gomonsoft/shinobi-karaoke/releases/(download|tag)/v<semver>`, y el texto «Última versión: {VERSION}» de §1.1b (con un patrón acotado o con marcadores HTML invisibles, que se documentan);
  - `comprobar` falla nombrando el archivo si alguna no coincide; si no hay ninguna, no comprueba nada;
  - `--salida-github` no cambia.
- **`app/scripts/guia-instalacion.test.ts`**: pasa de comprobar E0 a comprobar E½ según el criterio 17 revisado:
  - enlaces `/releases/download/v<versión de package.json>/` a los 4 nombres exactos de §4;
  - ningún `releases/latest`;
  - los textos alternativos exactos de §1.4;
  - el aviso de «solo desde aquí»;
  - los enlaces internos de `INSTALAR.md`, que siguen funcionando.

## Criterios de aceptación
- [ ] Criterios 17, 18, 21–23, 27 y 28 (este último, si el repositorio de compilaciones existe) de la spec 09.
- [ ] `version.mjs`: en un repositorio temporal con un README de ejemplo, `subir` cambia los 5 enlaces y la línea de versión sin tocar nada más, y `comprobar` falla con un enlace desfasado.
- [ ] `npm run version:comprobar` pasa en el repositorio.

## Pruebas de feedback
- Unitarias: `app/scripts/version.test.ts` y `app/scripts/guia-instalacion.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual (guía, P17–P19 de la spec 09, criterio 30): tras publicar, abrir el README sin sesión en tema claro y oscuro, pulsar cada botón y anotar el aviso literal de Chrome y de Edge.

## Notas de implementación

- **Decisión (pregunta [0144](../preguntas/0144-readme-en-e0-o-e-medio-antes-de-publicar.md), provisional):** no existe ninguna etiqueta ni *Release* y 0140 sigue abierta; la spec 09 y 0141 fijan que E½ empieza con la primera *pre-release* pública. El `README.md` **se queda en E0** (sin enlaces que den 404) y los textos de E½ quedan listos en `docs/versiones/0.2.0/plantillas/estado-e-medio.md` (bloques «README» e «INSTALAR.md», con `{VERSION}`). Para pasar a E½: aplicar la plantilla con la versión de la *Release* (pasos en la propia plantilla), tras comprobar sin sesión que los 4 enlaces descargan.
- **Botones:** `docs/imagenes/descarga/descargar-{windows,mac,deb,appimage}.svg` (360×64, `#C8303B`, `role="img"`, `<title>` con el texto alternativo, sin scripts ni recursos externos). La segunda línea del botón de Mac lleva `textLength="280"` para que quepa con DejaVu Sans (margen ≥ 16 px); sin medirlo en render real: queda para P19.
- **`INSTALAR.md`:** nueva sección «Si el navegador bloquea la descarga» (Chrome y Edge, sin marcadores), enlazada desde el índice y desde el paso 1 de Windows. Mantiene el aviso E0; el aviso E½ está en la plantilla.
- **`app/scripts/version.mjs` (sexto sitio):** `subir` reescribe en `README.md` e `INSTALAR.md` los patrones `github.com/Gomonsoft/shinobi-karaoke/releases/(download|tag)/v<semver>`, `**Última versión: <semver>, versión preliminar` y `[Novedades de <semver>]` (patrones acotados, `PATRONES_ENLACES`); `comprobar` falla nombrando el archivo si alguna cita no coincide con `app/package.json`; sin citas (E0) o sin archivo no hace nada. `--salida-github` sin cambios. Tipos en `version.d.mts`.
- **Pruebas:** `version.test.ts` (3 casos nuevos: subir sobre un README de ejemplo, comprobar con enlace desfasado, E0) y `guia-instalacion.test.ts` (acepta README en E0 o en E½ idéntico a la plantilla; valida la plantilla: 4 enlaces con nombres de §4, sin `latest`, textos alternativos exactos, pasos, aviso «solo desde aquí», SVG válidos, enlaces internos y sección del navegador).
- **Condicionado:** a 0140/0144 (pasar el README a E½), y a que exista `Gomonsoft/shinobi-karaoke-builds` público (§1.5, criterio 28): la mención en «Desarrollo» **no se ha añadido**; el texto está en la spec y se añade cuando el usuario cree el repositorio (0143). 0255 debe, al subir a `0.2.0-alpha.2`, ejecutar `version:subir` (que ya mantiene los enlaces si el README está en E½) y decidir con la sesión principal cuándo aplicar la plantilla.
- **Manual (P17–P19, criterio 30):** tras publicar, abrir el README sin sesión en tema claro y oscuro, pulsar cada botón y anotar el aviso literal de Chrome y Edge.
- **Deuda:** `npm run test:cambios` no es fiable ahora mismo (23 errores de otros programadores a medias); `prettier --check .` solo falla por `app/electron-builder.yml` (ajeno).
