# 0081 — Main: cliente HTTP de LRCLIB (sin clave, `User-Agent` genérico, presupuesto de tiempo, 429 y errores)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0077
- ADRs: 0005 (Decisión §1, Revisión 2026-11-05), 0008 (seguridad), 0009 §8 (dobles solo sin empaquetar)
- Spec UX: docs/ux/05-letra.md (estados "Sin conexión / servicio caído", criterio 12)
- Cuándo: en paralelo con 0078, 0079 y 0080. Puede empezar en cuanto esté 0077.

## Objetivo
Cliente de bajo nivel en `app/src/main/letras/lrclib.ts` que habla con LRCLIB y devuelve registros validados o errores con código estable. No convierte letras ni ordena candidatos: eso es 0082.

## Criterios de aceptación
- [ ] **Operaciones**:
  - `get({ titulo, artista, album, duracionS }, señal)` → `RegistroLrclib | null`: 404 → `null`; `duration` en segundos enteros, entre 1 y 3600, y sin ella si sale del rango;
  - `buscar({ titulo, artista } | { q }, señal)` → `RegistroLrclib[]`, con hasta 20;
  - `porId(id, señal)` → `RegistroLrclib | null`.
  `RegistroLrclib` valida con Zod los campos que se usan (`id`, `trackName`, `artistName`, `albumName`, `duration`, `instrumental`, `hasWordSync`, `plainLyrics`, `syncedLyrics`, `lyricsfile`) y tolera campos nuevos. Si un registro no es válido, se descarta y se registra; el resto de la respuesta sigue valiendo.
- [ ] **Petición**:
  - `net.fetch` de Electron, inyectable (en los tests, una función `fetch` falsa);
  - `GET` con la cabecera **`User-Agent: ShinobiKaraoke/<app.getVersion()> (https://github.com/Gomonsoft/shinobi-karaoke)`** y `Accept: application/json`;
  - sin cookies ni credenciales (`credentials: 'omit'`), sin `Referer` y sin ninguna otra cabecera identificativa: ni SO, ni usuario, ni id de instalación, ni `Lrclib-App-Id`;
  - parámetros con `URLSearchParams`.
  Un test comprueba **exactamente** las cabeceras que se envían.
- [ ] **URL base**: `https://lrclib.net`. Solo sin empaquetar, `SHINOBI_LRCLIB_URL` la sustituye (0077), solo por `http(s)://127.0.0.1:<puerto>` o `http://lrclib.invalid`; cualquier otro valor se ignora y se registra. Empaquetada nunca se lee. Al crearse, el cliente registra en `app.log` la URL base que usa (0088 lo comprueba).
- [ ] **Ritmo**:
  - peticiones **en serie** (una cola) con al menos 250 ms entre ellas;
  - 429 → se lee `Retry-After` (segundos o fecha HTTP) y se le suma hasta un 30 % de margen aleatorio, inyectable.
    - Si cabe en el presupuesto que le queda a la búsqueda, se espera y se reintenta **una vez**.
    - Si no, `SERVICIO_NO_DISPONIBLE`, y el cliente guarda un "no antes de" durante el cual cualquier llamada falla al momento con ese código, sin tocar la red.
- [ ] **Tiempos**: cada operación recibe una `AbortSignal` (cancelación del usuario y presupuesto total de 10 s, que lleva 0082). Cada petición tiene además un tiempo máximo propio de 10 s.
- [ ] **Errores**:
  - `net::ERR_INTERNET_DISCONNECTED`, `ERR_NAME_NOT_RESOLVED`, `ERR_NETWORK_CHANGED`, `ERR_ADDRESS_UNREACHABLE` o `net.isOnline() === false` → `SIN_CONEXION`;
  - tiempo agotado, `ERR_CONNECTION_REFUSED`/`RESET`, TLS, 5xx, 429 sin espera posible, 400, JSON no válido o cuerpo de más de 2 MB (se lee en streaming y se corta) → `SERVICIO_NO_DISPONIBLE`;
  - abortado por el usuario → `CANCELADO`.
  El detalle técnico va a `registros/app.log` (sin títulos completos: basta el id de la canción) y nunca al renderer.
- [ ] Tests (Vitest, `fetch` falso y reloj falso):
  - 200, 404, 429 con espera que cabe y que no cabe, "no antes de", 500, tiempo agotado, DNS, JSON roto;
  - cuerpo enorme;
  - registro parcial no válido;
  - separación mínima entre peticiones;
  - cabeceras exactas;
  - `SHINOBI_LRCLIB_URL` ignorada si está empaquetada o si apunta a otro host.
  Además, un test de integración con un servidor HTTP local de Node (`http.createServer` en `127.0.0.1:0`) que use el `fetch` de Node con la misma interfaz.

## Notas de implementación
- **Qué se hizo**: `app/src/main/letras/lrclib.ts` con `crearClienteLrclib({ fetch, version, registro, env, empaquetada, enLinea?, ahora?, dormir?, aleatorio? })` → `{ urlBase, get, buscar, porId }`. Sin dependencias de Electron (en 0082 se inyecta `net.fetch`, `app.getVersion()`, `net.isOnline()`, `process.env` y `app.isPackaged`). Errores: `ErrorLrclib` con `codigo` (`SIN_CONEXION`, `SERVICIO_NO_DISPONIBLE`, `CANCELADO`, `ARGUMENTOS_NO_VALIDOS`). Cola en serie, 250 ms entre peticiones, tiempo de 10 s por petición, cuerpo máximo de 2 MB en streaming, 429 con `Retry-After` (+hasta 30 %), un reintento si cabe y "no antes de" si no. Registros inválidos se descartan y se registran solo con el id.
- **Presupuesto de la búsqueda**: cada operación admite un tercer parámetro `{ vencimiento }` (instante en la escala de `ahora()`, `Date.now()` por defecto); 0082 lo calcula al empezar la búsqueda. Sin él, se asume 10 s desde la llamada.
- **Decisiones**: un 429 sin `Retry-After` interpretable se trata como 1 s. Los códigos de red de Node (`ENOTFOUND`, `EAI_AGAIN`, `ENETUNREACH`, `EHOSTUNREACH`) también dan `SIN_CONEXION`. El cliente no está aún conectado en `index.ts` (lo hace 0082).
- **Cómo probarlo**: `npx vitest run src/main/letras/lrclib.test.ts` (fetch falso, reloj falso y servidor local en `127.0.0.1:0`); la prueba con red real se activa con `SHINOBI_TESTS_RED=1`.
- **Deuda**: ninguna.
