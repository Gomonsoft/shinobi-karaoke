# 0180 — Pantallas, ventana secundaria, pantalla completa por ventana y reposo

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §2, §3 y §4, [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4) §1–§2
- Spec UX: [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) («Apertura y foco», «Recuperación») y [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (diálogo de pantallas, Wayland)

## Objetivo

Implementar las piezas nativas que gestionan las pantallas, la ventana secundaria y el reposo, con dobles para probarlas sin hardware. No implementan la sesión: exponen una fachada que conecta [0181](0181-servicio-de-sesion-e-ipc-en-main.md).

## Contrato

- **`main/ventana/pantallaCompleta.ts`**: `ControlPantallaCompleta` extraído de `ControlModoReproductor` (estado deseado, transiciones de macOS y suscripción a los cambios reales). `ControlModoReproductor` lo envuelve sin cambiar su comportamiento ni su API pública.
- **`main/ventana/reposo.ts`**: `GestorReposo` con `retener(titular)`, `liberar(titular)` y `liberarTodo()`, sobre `powerSaveBlocker`. El reproductor local pasa a usar el titular `local`.
- **`main/sesion/pantallas.ts`**:
  - `listarPantallas(screen, ventanaPrincipal)` devuelve `ListaPantallasIpc` (§2: etiqueta de respaldo, orden, `principal` y `conVentanaPrincipal`);
  - `colocacion` vale `'sistema'` si `process.platform === 'linux'` y `XDG_SESSION_TYPE === 'wayland'`, y `'libre'` en los demás casos;
  - `preseleccion(preferencia, lista)` busca por id, luego por etiqueta y tamaño, y si no, toma la primera que no sea la de la principal;
  - un observador de `display-added`, `display-removed` y `display-metrics-changed`.
- **`main/sesion/ventanaSecundaria.ts`**: `abrirSecundaria({ pantalla, pantallaCompleta, colocacion })` crea la `BrowserWindow` con las opciones de §2:
  - preload `secundaria`, `backgroundThrottling: false`, `autoplayPolicy`, `setMenu(null)`, zoom fijo y título `rep.cola.ventana`;
  - límites al 80 % del `workArea`, `setBounds` en `ready-to-show`, `showInactive()`, o `show()` si cubre la pantalla de la principal en pantalla completa;
  - pantalla completa con `ControlPantallaCompleta`.
  
  Devuelve un manejador con:
  - `moverA(pantalla)`, que restaura la pantalla completa si la tenía;
  - `fijarPantallaCompleta`, `mostrar` (restaura si estaba minimizada, sin foco), `cerrar`, `destruir` y `alCerrarSolicitado(cb)` (intercepta `close`);
  - los avisos `alCaer`, `alNoResponder` y `alResponder`, y `alPantallaPerdida` y `alPantallaReconectada`. La pantalla perdida recoloca en ventana al 80 % de la pantalla primaria, sin foco ni pausa.
  
  Con `colocacion: 'sistema'` no se pasan coordenadas y no se emiten avisos de pantalla.
- **Dobles**, solo sin empaquetar:
  - `SHINOBI_PANTALLAS_SIMULADAS` (JSON con las pantallas) sustituye a `screen`;
  - un puerto de pruebas en `globalThis.__shinobiPruebas.pantallas` con `quitar(id)` y `añadir(p)`, accesible con `electronApp.evaluate`;
  - `SHINOBI_PANTALLA_COMPLETA_SIMULADA` se aplica también a la secundaria.

## Archivos

`app/src/main/ventana/{pantallaCompleta,reposo,modoReproductor}.ts`, `app/src/main/sesion/{pantallas,ventanaSecundaria,pantallasPrueba}.ts` y sus pruebas, y `app/src/main/index.ts`, solo para inyectar `GestorReposo` en `ControlModoReproductor`. No toca `main/sesion/{cola,maquina}.ts` ([0178](0178-modelo-puro-de-cola-y-maquina-de-sesion.md)) ni `handlers.ts`.

## Criterios de aceptación

- [ ] Las pruebas de `modoReproductor.test.ts` siguen en verde sin cambios de expectativa (reproductor local, ADR 0011).
- [ ] `GestorReposo`: con `local` y `sesion` retenidos, liberar `local` mantiene el bloqueo, y liberar `sesion` lo suelta. `liberarTodo` lo suelta siempre (doble de `powerSaveBlocker`).
- [ ] `listarPantallas` con 3 pantallas dobles (una sin `label`) da «Pantalla {n}» para la que no tiene nombre, marca bien `principal` y `conVentanaPrincipal`, y respeta el orden por `x` e `y`. `preseleccion` cubre los tres casos.
- [ ] `abrirSecundaria` en la pantalla 2 simulada crea la ventana dentro de su `workArea` y no le da el foco. En la pantalla de la principal y en pantalla completa, sí.
- [ ] `quitar(2)` con la secundaria en pantalla completa sale de pantalla completa, la coloca al 80 % de la primaria y emite `alPantallaPerdida`. `añadir` de la misma pantalla emite `alPantallaReconectada` sin moverla. `moverA` vuelve a ponerla en pantalla completa.
- [ ] Con `colocacion: 'sistema'` no se llama a `setBounds` ni a `setPosition` y no hay avisos de pantalla.
- [ ] `render-process-gone`, `unresponsive` y `responsive` llegan a sus avisos (doble de `webContents`).

## Notas de implementación
