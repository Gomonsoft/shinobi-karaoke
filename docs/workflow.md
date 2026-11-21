# Flujo de Git

`develop` integra las fases de la versión en curso. `main` es la rama de publicación protegida y recibe cambios por PR.

1. Abre cada fase desde `develop` en una rama `fase/0.2.0-N-<nombre>`.
2. Al cerrar la fase, incluye su informe y abre un PR hacia `develop`. La revisión comprueba los criterios de aceptación y las verificaciones de la fase.
3. Al cerrar la versión, abre un PR de `develop` hacia `main`. Tras fusionarlo, etiqueta el commit de publicación con su versión (`v0.2.0-alpha.N`) según [Versiones y publicación](#versiones-y-publicación).

## Versiones y publicación

Cada versión publicada tiene su *Release* en GitHub, creada por el workflow `empaquetado.yml` al subir una etiqueta `v*` ([ADR 0020](adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md)).

**Número de versión** (provisional mientras [0036](preguntas/0036-numero-de-version-y-politica-de-versiones.md) siga abierta): uno solo para app y worker, en SemVer. Las versiones preliminares llevan sufijo numerado: `0.2.0-alpha.1`, `0.2.0-alpha.2`, `0.2.0-beta.1`, `0.2.0-rc.1`. Con sufijo, la *Release* es *pre-release* y no pasa a "Latest". Un número publicado no se reutiliza: un error se corrige con el siguiente.

### Publicar una versión
1. En la rama de trabajo, sube el número y revisa el cambio:
   ```sh
   cd app
   npm run version:subir -- 0.2.0-alpha.1
   npm run version:comprobar
   ```
   Cambia `app/package.json`, `app/package-lock.json`, `worker/pyproject.toml`, `worker/shinobi_worker/__init__.py` y `worker/uv.lock` (en el worker con la forma PEP 440: `0.2.0a1`).
2. Escribe las novedades en `docs/versiones/<X.Y.Z>/notas/<versión>.md`, con una sección "Sin probar en esta versión". Si no existe, la *Release* usa las notas que genera GitHub.
3. Opcional, recomendado: ensaya sin publicar con `gh workflow run empaquetado.yml --ref <rama>`. El resumen de la ejecución muestra los instaladores, `SHA256SUMS.txt` y las notas tal como saldrán; el artefacto `publicacion-<versión>` los contiene.
4. Fusiona en `main` por PR. La etiqueta tiene que apuntar a un commit contenido en `main`; si no, el workflow falla sin construir.
5. Crea y sube la etiqueta anotada sobre ese commit:
   ```sh
   git switch main && git pull
   git tag -a v0.2.0-alpha.1 -m "Shinobi Karaoke 0.2.0-alpha.1"
   git push origin v0.2.0-alpha.1
   ```
6. Sigue la ejecución (`gh run watch`). Si todo pasa, aparece la *Release* con los 4 instaladores, `SHA256SUMS.txt`, las notas y los archivos de código fuente. Si falla antes de `publicar`, no se ha publicado nada: corrige, sube la siguiente versión y etiqueta de nuevo (no muevas la etiqueta si ya hay *Release*).

### Ajustes del repositorio (los hace el usuario)
- Variable `PUBLICACION_BORRADOR` (Settings → Secrets and variables → Actions → Variables): con `true`, la *Release* se queda en borrador hasta publicarla a mano. Sin la variable, se publica sola ([0140](preguntas/0140-publicar-las-alfas-como-pre-release-publica.md)).
- Recomendado: *immutable releases* (Settings → General → Releases) y una regla de etiquetas `v*` que solo permita a administradores crearlas, moverlas o borrarlas (Settings → Rules → Rulesets).

### Sin firma de código
Los instaladores no llevan firma comercial ([0001](preguntas/0001-firma-de-codigo-instaladores.md), ADR 0012): Windows muestra SmartScreen y no permite instalar con el Control inteligente de aplicaciones activo ([0044](preguntas/0044-control-inteligente-de-aplicaciones-en-windows.md)); macOS muestra el aviso de Gatekeeper para el DMG con firma *ad hoc*; el AppImage puede arrancar sin el sandbox del sistema en Ubuntu ≥ 24.04 ([0045](preguntas/0045-appimage-sin-sandbox-en-ubuntu.md)). La cabecera de las notas remite a `INSTALAR.md` ([spec 09](ux/09-descarga-e-instalacion.md)).
