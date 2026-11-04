# 0012 — Protocolo `shinobi-media://` para audio y miniaturas
- Estado: Hecha
- Paso del pipeline: 0 (lo usarán editor y reproductor)
- Depende de: 0009
- ADRs: 0001, 0006
- Spec UX: —

## Objetivo
Servir al renderer los archivos de una canción (audio y miniatura) sin habilitar `file://`.

## Criterios de aceptación
- [x] Esquema `shinobi-media` registrado como privilegiado (`standard`, `secure`, `supportFetchAPI`, `stream`) antes de `app.ready`, y manejado con `protocol.handle`.
- [x] URL `shinobi-media://<id>/<ruta-relativa>`; solo sirve archivos dentro de `biblioteca/<id>/` y solo rutas de una lista blanca (`fuente/mezcla.flac`, `fuente/miniatura.jpg`, `pistas/voz.flac`, `pistas/instrumental.flac`). Cualquier intento de salir de la carpeta (`..`, rutas absolutas, enlaces simbólicos, id inexistente) → 404.
- [x] Soporta peticiones `Range` (206 con `Content-Range`) y `Content-Type` correcto (`audio/flac`, `image/jpeg`).
- [x] Tests: rango parcial, archivo completo, traversal rechazado, id inexistente.
- [x] Prueba E2E: el renderer puede hacer `fetch('shinobi-media://<id>/pistas/instrumental.flac')` de una canción de la semilla y recibe audio.

## Notas de implementación
- **Qué se hizo**: `app/src/main/medios.ts` (lógica pura sobre `fs`, sin Electron): `servirMedio(dirBiblioteca, url, metodo, range)` devuelve un `Response` web; `interpretarUrlMedios`, `interpretarRango`. `main/index.ts` registra el esquema (`registerSchemesAsPrivileged` antes de `ready`) y lo maneja con `protocol.handle`.
- **Seguridad**: solo GET/HEAD; id con `^[a-z0-9][a-z0-9-]{0,63}$` (el host llega en minúsculas); ruta comparada sin decodificar contra la lista blanca de 4 archivos (`%2e%2e`, `..`, `\`, rutas absolutas, query/hash/puerto/credenciales -> 404); además `realpath` de la carpeta de la canción (debe ser hija directa de `biblioteca/`) y del archivo (debe quedar dentro de ella) y comprobación de que es fichero, de modo que los enlaces simbólicos que escapan dan 404. Todos los fallos devuelven 404 sin detalle. `Range` de un solo intervalo (`a-b`, `a-`, `-n`) -> 206 con `Content-Range`; fuera de rango -> 416; sintaxis rara o múltiple -> 200 completo. Cabeceras: `Content-Type` por lista blanca, `Accept-Ranges`, `nosniff`, `no-store`.
- **Desviaciones necesarias**: (1) el esquema lleva además `corsEnabled: true` y las respuestas `Access-Control-Allow-Origin: *`, porque en producción el renderer tiene origen `file://` y el `fetch` entre orígenes se bloqueaba (comprobado); (2) la CSP de `renderer/index.html` pasa a `connect-src 'self' shinobi-media:` (sin ello `fetch` a este esquema lo bloquea la CSP de 0002; `media-src` e `img-src` ya lo admitían). El contenido sigue limitado a la lista blanca, así que no se abre nada más.
- **Para la IPC (0011)**: `ResumenCancion.miniatura` es ruta absoluta; el renderer debe usar `shinobi-media://<id>/fuente/miniatura.jpg` (y `pistas/instrumental.flac`, etc.), no esa ruta.
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/medios` (13 tests: completo, rangos parcial/abierto/sufijo/416, HEAD, traversal y variantes codificadas, id inexistente, symlinks, método); `npm run build && npx playwright test e2e/medios.spec.ts` (fetch real desde el renderer con semilla: 200 `audio/flac` con cabecera `fLaC`, 206 con Range, `cancion.json` -> 404).
- **Deuda técnica**: el handler de `main/index.ts` no tiene test unitario (lo cubre el E2E); no se cachea ni se implementa `If-Range`/ETag; la miniatura `.jpg` es la única admitida (si 0014/0015 guardan otro formato habrá que ampliar la lista blanca).
