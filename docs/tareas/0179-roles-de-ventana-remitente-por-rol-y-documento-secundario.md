# 0179 — Roles de ventana, remitente por rol y documento de la secundaria

- Estado: Hecha
- Paso del pipeline: 0 (transversal) y 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §1, §2 (entradas propias) y §11 (comprobación del remitente y eventos dirigidos), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4)
- Spec UX: — (sin interfaz)

## Objetivo

Preparar la app para tener dos ventanas con permisos distintos. Esto incluye el registro de roles, la comprobación del remitente por canal, los eventos dirigidos, las entradas de build de la secundaria y la retirada de los supuestos de «una sola ventana». Al terminar, la app sigue funcionando igual con una ventana.

## Contrato

- **`main/ventana/registro.ts`**: `RegistroVentanas` con `registrar(ventana, rol)`, `principal()`, `secundaria()`, `rolDe(webContents)` y baja automática en `closed`.
- **`main/seguridad.ts`**: `remitenteIpcValido(evento, canal, registro, origen)` comprueba:
  1. el `webContents` registrado;
  2. `ROLES_POR_CANAL[canal]`;
  3. que el _frame_ sea el principal;
  4. el origen;
  5. la ruta del documento del rol: `/index.html` o `/` para la principal, `/reproductor.html` para la secundaria.

  Además, `bloquearNavegacionTotal(wc)` para la secundaria.

- **`main/ipc/handlers.ts`** (solo `registrarIpc` y `OpcionesRegistro`): pasa el canal a `remitenteValido` y sustituye `difundir` por `enviarA(rol, canal, carga)`. Todos los eventos actuales van a la principal. La sesión de la secundaria (paso 5 del remitente) la añade [0181](0181-servicio-de-sesion-e-ipc-en-main.md).
- **`main/index.ts`**:
  - registra la ventana principal;
  - sustituye cada `BrowserWindow.getAllWindows()[0]` (cierre, `second-instance`, avisos, `activate` y `browser-window-created`) por `registro.principal()`;
  - `activate` crea la principal si falta, aunque haya otra ventana;
  - el menú envía `evento:menu` solo a la principal.
- **Build**:
  - `electron.vite.config.ts` con dos entradas de renderer (`index.html` y `reproductor.html`) y dos de preload (`index` y `secundaria`);
  - `renderer/reproductor.html` con la misma CSP y el mismo `<meta name="referrer">` que `index.html`;
  - `renderer/src/secundaria/main.tsx` provisional, que solo pinta un fondo negro con el título accesible. Lo sustituye [0182](0182-reproductor-en-la-ventana-secundaria.md).

  Comprobar que `appProtocolo` sirve `reproductor.html` en producción.

- **Solo pruebas**: `SHINOBI_VENTANA_SECUNDARIA_PRUEBA=1`, solo sin empaquetar, permite abrir desde el menú de desarrollo una secundaria vacía con el rol `secundaria`, para el E2E de seguridad. Lo retira o lo reutiliza [0181](0181-servicio-de-sesion-e-ipc-en-main.md).

## Archivos

`app/src/main/ventana/registro.ts` (y su prueba), `app/src/main/seguridad.ts` (y `seguridad.test.ts`), `app/src/main/ipc/handlers.ts` (solo el registro) y `handlers.test.ts`, `app/src/main/index.ts`, `app/electron.vite.config.ts`, `app/src/renderer/reproductor.html`, `app/src/renderer/src/secundaria/main.tsx`, y `app/e2e/seguridad.spec.ts` (casos nuevos).

## Criterios de aceptación

- [x] Pruebas unitarias del remitente:
  - la secundaria no puede llamar a `biblioteca.listar` ni a `temas.catalogo`;
  - la principal no puede llamar a `sesion.informar`;
  - se rechazan un _frame_ que no es el principal, una ruta `/reproductor.html` en el `webContents` principal y un `webContents` sin registrar;
  - todas devuelven el error genérico «Origen no permitido.».
- [x] `enviarA('principal', …)` no llega a la secundaria: prueba con dos `webContents` dobles y el evento `evento:cancion`.
- [x] E2E de seguridad con la secundaria de prueba:
  - `window.shinobi` es `undefined` y `window.shinobiReproductor` existe;
  - un `location.href = '/index.html'` desde la secundaria no navega.
- [x] `npm run build` genera `out/renderer/reproductor.html` y `out/preload/secundaria.js`.
- [x] La prueba de humo y los E2E existentes en verde.
- [x] Con la secundaria de prueba abierta, en macOS el clic en el Dock y `second-instance` enfocan la principal. Si se cierra la principal, `activate` la vuelve a crear.

## Notas de implementación

### Qué se hizo

- `main/ventana/registro.ts`: `RegistroVentanas<V>` con `registrar`, `principal`, `secundaria`, `rolDe` y baja en `closed`. Añade `enviarA(rol, canal, carga)` (ignora el rol sin ventana o con `webContents` destruido), que es lo que usa main para los eventos dirigidos. No admite dos ventanas con el mismo rol.
- `main/seguridad.ts`: `remitenteIpcValido(evento, canal, registro, origen)` (rol registrado, `ROLES_POR_CANAL`, _frame_ principal, origen y ruta `/index.html` o `/` para la principal y `/reproductor.html` para la secundaria; canales desconocidos o heredados como `toString` se rechazan) y `bloquearNavegacionTotal(wc)`.
- `main/ipc/handlers.ts`: `OpcionesRegistro.remitenteValido(evento, canal)` y `enviarA(rol, canal, carga)` en lugar de `difundir`; todos los eventos actuales van a la principal.
- `main/index.ts`: registro de la principal; `principal()` en cierre, `second-instance`, avisos y `activate` (que recrea la principal si falta y, si existe, la enfoca); `aPrincipal` sustituye a los envíos a `getAllWindows()` (temas, estado de información, avisos, abrir canción, solicitud de cierre y menú). Secundaria de prueba (`SHINOBI_VENTANA_SECUNDARIA_PRUEBA=1`, solo sin empaquetar) desde el menú de desarrollo, elemento `dev-secundaria-prueba`.
- Build: `electron.vite.config.ts` con dos entradas de renderer y dos de preload. `reproductor.html` (misma CSP y `referrer`) y `secundaria/main.tsx` provisional.
- Pruebas: `registro.test.ts`, `seguridad.test.ts` (remitente por rol, ruta, _frame_, canales desconocidos y navegación) y `handlers.test.ts` adaptado; E2E nuevo en `e2e/seguridad.spec.ts`.

### Cómo probarlo

`npm run typecheck && npm run lint && npm run format:check && npm test`; `npm run build` y `npx playwright test e2e/seguridad.spec.ts`.

### Decisiones y deuda técnica

- **Preloads sin chunks compartidos**: con dos entradas el bundler (rolldown) extraía `shared/canales` a `out/preload/chunks/…` y los preloads con `sandbox` no pueden hacer `require` de archivos locales. `output.codeSplitting: false` no admite varias entradas, así que `electron.vite.config.ts` incluye un pequeño plugin (`preloadsAutocontenidos`) que da a cada entrada su propia copia de los módulos propios (`?e=<entrada>`). Comprobado: `out/preload/index.js` y `secundaria.js` solo hacen `require("electron")`. Si se añade otro preload, se aplica solo.
- `bloquearNavegacionTotal` se suma a la política común de `web-contents-created`, que en `will-navigate` aún abriría en el navegador un enlace permitido; ya no es alcanzable porque la secundaria no tiene enlaces. Lo sustituirá o ajustará 0180/0181 si hace falta.
- La secundaria de prueba (`crearVentanaSecundariaPrueba` en `index.ts`) la sustituye 0180 (`abrirSecundaria`) o la reutiliza 0181.
- El clic en el Dock y `activate` (incluida la recreación de la principal cerrada) no tienen E2E: Playwright no puede simular el evento del Dock. Están revisados por código; `second-instance` sí está cubierto por E2E.
- Un test unitario no relacionado (jsdom) falló una vez bajo carga y pasó en las dos repeticiones siguientes.
