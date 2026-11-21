# 0247 — Icono de las ventanas, AppUserModelId de desarrollo y verificación del icono del exe
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: [0012](../adr/0012-empaquetado-con-electron-builder-fuses-uv-y-licencias.md), «Revisión para 0.2.0 — alpha.2 (icono en las ventanas)»; [0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md) (verificación del paquete)
- Spec UX: — (el diseño del icono definitivo es la tarea [0140](0140-icono-de-la-app-en-los-instaladores.md) y **no entra**)
- Versión: 0.2.0-alpha.2 · Bloque B4 (correcciones de alpha.1)

## Objetivo
En la barra de tareas se vio el icono de Electron ([feedback](../versiones/0.2.0/feedback-alpha-1.md) §1.2). La causa probable es una ventana de desarrollo: ninguna `BrowserWindow` pasa `icon` y en desarrollo se usa el mismo AppUserModelId que en la app instalada. Además, nada comprueba en el paquete que el `.exe` no lleve el icono de Electron.

## Contrato
Líneas comprobadas en `app/src/main/index.ts`: ventana principal en 250 (`new BrowserWindow({...})` dentro de `crearVentana`), secundaria en 313 (`new BrowserWindow(opciones)` en `crearVentanaSecundaria`) y AppUserModelId en 344.
1. **Ruta del icono.** Una función pura (por ejemplo en `main/ventana/icono.ts`): `rutaIcono({ empaquetada, plataforma, dirApp, dirRecursos }) → string | undefined`.
   - Sin empaquetar: `<dirApp>/build/icon.png`.
   - Linux empaquetado: `<dirRecursos>/icon.png`. Añadir a `extraResources` de `app/electron-builder.yml` `from: build/icon.png, to: icon.png`, y ajustar la lista de contenido esperado de `verificar-paquete.mjs` si la tiene.
   - Windows y macOS empaquetados: `undefined`, porque se usa el icono del ejecutable o del bundle.
2. Pasar `icon` (si no es `undefined`) a la principal (línea 250) y a la secundaria. En la secundaria se añade en `crearVentanaSecundaria` sobre `opciones`, sin tocar `OpcionesVentanaSecundaria`, que pertenece a la sesión. La ventana offscreen de exportación no lo lleva.
3. **AppUserModelId** (línea 344): `app.isPackaged ? ID_APP_WINDOWS : ID_APP_WINDOWS_DESARROLLO`, con `ID_APP_WINDOWS_DESARROLLO = 'com.shinobikaraoke.app.desarrollo'` en `app/src/shared/titulo.ts`. `ID_APP_WINDOWS` y `appId` no cambian, y el test que los compara tampoco.
4. **Verificación del icono del exe** en `app/scripts/verificar-paquete.mjs`, solo cuando la carpeta es de Windows: leer los grupos de iconos (`RT_GROUP_ICON` y sus `RT_ICON`) de `Shinobi Karaoke.exe` con `resedit` y fallar si no hay ninguno o si alguna imagen es idéntica byte a byte a una de `node_modules/electron/dist/electron.exe`. Si no se encuentra el `electron.exe` de referencia, falla con un mensaje claro: en `construir` siempre está. Añadir `resedit` a `devDependencies` con la **versión fija 1.7.2** (MIT; ya llega con electron-builder 26.18.0) y comprobar que `npm run licencias:comprobar` sigue en verde.

## Criterios de aceptación
- [ ] `rutaIcono` devuelve lo esperado en los 6 casos (3 SO, empaquetada o no).
- [ ] La principal y la secundaria se crean con `icon` en desarrollo.
- [ ] El AppUserModelId depende de `app.isPackaged`.
- [ ] `verificar-paquete.mjs` falla con un exe que lleva los iconos de Electron y pasa con el paquete de la app. En el CI lo demuestra `construir (windows-2025)`; en local, `npm run empaquetar:dir` seguido de `node scripts/verificar-paquete.mjs release/win-unpacked`.
- [ ] Manual (guía): con `npm run dev` en Windows, la barra de tareas muestra el icono de la app (el provisional de 0140), no el de Electron. Con la app instalada, el icono de la barra coincide con el del acceso directo.

## Pruebas de feedback
- Unitarias: test de `rutaIcono`; en `app/scripts/verificar-paquete.test.ts`, la función de comparación de iconos con búferes falsos y, si existe `node_modules/electron/dist/electron.exe`, comprobar que ese exe se detecta como «icono de Electron».
- E2E: ninguna.
- Críticos: sí (toca `main/` y `shared/`).
- Manual: el punto de la barra de tareas en Windows, en la guía de la versión (`qa`).

## Notas de implementación

- Hecho: `src/main/ventana/icono.ts` (`rutaIcono`, 6 casos en `icono.test.ts`); `icon` en la ventana principal y en la secundaria (`crearVentanaSecundaria` lo añade sobre `opciones`; la offscreen de exportación no lo lleva). `ID_APP_WINDOWS_DESARROLLO` en `shared/titulo.ts` y `setAppUserModelId(app.isPackaged ? … : …)`. `electron-builder.yml`: `extraResources` con `build/icon.png` -> `icon.png` (test de `electron-builder.test.ts` actualizado) y `verificar-paquete.mjs` exige `resources/icon.png` en Linux. Verificación del exe de Windows en `verificar-paquete.mjs`: `iconosDelExe`/`comprobarIconoExe` con `resedit` (1.7.2 fijo en `devDependencies` y en el lock; `licencias:comprobar` en verde); falla si no hay iconos, si alguna imagen coincide con `node_modules/electron/dist/electron.exe` o si ese exe no existe. `leerIconos` es inyectable (los tests de `verificarPaquete` son todos `linux`).
- Pruebas: `icono.test.ts` y el bloque «icono del .exe» de `verificar-paquete.test.ts` (búferes falsos y detección real de `electron.exe`, omitida si no existe).
- No ejecutado: `empaquetar:dir` + `verificar-paquete.mjs release/win-unpacked` (lo demuestra `construir (windows-2025)` del CI).
- Manual (guía): con `npm run dev` en Windows, la barra de tareas muestra el icono de la app (provisional de 0140) y no el de Electron; instalada, coincide con el del acceso directo.
