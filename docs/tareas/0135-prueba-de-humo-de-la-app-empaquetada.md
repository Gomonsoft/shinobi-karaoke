# 0135 — Prueba de humo de la app empaquetada (`e2e-paquete`)
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0130 (para ejecutarla); 0127
- ADRs: 0013 §2, §3, §4; 0008; 0009 §6, §8
- ¿Red?: no, una vez hecho el paquete. Sin modelos.

## Objetivo
Probar el artefacto real, con los *fuses*, **sin añadir ninguna línea a producción**.

## Archivos
- `app/playwright.paquete.config.ts` (`testDir: './e2e-paquete'`, sin reintentos);
- `app/e2e-paquete/lanzar.ts`, `app/e2e-paquete/runtimeEnDisco.ts`, `app/e2e-paquete/paquete.spec.ts`;
- `app/scripts/humo-worker.mjs`;
- script `test:paquete` en `app/package.json`.

## Contratos
**`lanzarPaquete({ bin, datos, env, args })`**:
1. `spawn(bin, ['--remote-debugging-port=0', ...args])`;
2. lee `DevTools listening on (ws://…)` de stderr, con límite de 45 s y la salida en el mensaje de error;
3. `chromium.connectOverCDP('http://127.0.0.1:<puerto>')`. Sin `playwright install`: no descarga navegadores;
4. espera la primera página;
5. `cerrar()`: cierra la conexión y mata el árbol (POSIX: `SIGTERM` y `SIGKILL`; Windows: `taskkill /T /F`).

**No se usa** `_electron.launch`: agota el tiempo de espera con `EnableNodeCliInspectArguments` desactivado (ADR 0013).

**Entrada**: `SHINOBI_PAQUETE_BIN` (ruta del ejecutable), leída **solo por las pruebas**. Sin ella, las pruebas fallan con un mensaje claro: nunca se omiten en silencio.

**`prepararRuntimeEnDisco(datos, plataforma, perfil)`**. Prueba de concepto validada en Linux:
- semilla: `sembrar()` de `src/main/biblioteca/semilla.ts`;
- `config.instalacion.perfil_hardware = perfil`, `ultima_comprobacion_ytdlp = ahora`;
- intérprete vacío: `runtime/venv/bin/python` o `runtime\venv\Scripts\python.exe`;
- `runtime/instalado.json`: `manifiesto_version`, `plataforma`, `perfil`, `python` y `sha256_requisitos` leídos del **manifiesto del paquete**;
- modelos: `truncate` al `bytes` exacto del modelo Calidad y sus `extra`. Archivo disperso, sin datos reales.

Perfil: `win32-x64`/`cpu`, `linux-x64`/`cpu`, `darwin-arm64`/`mps`. Si el equipo tiene NVIDIA, `SHINOBI_PAQUETE_PERFIL=cuda` (solo prueba).

**Casos de `paquete.spec.ts`**:
1. **B1 con el entorno envenenado**. Todos a la vez, con valores válidos: `SHINOBI_RUNTIME_FALSO` (escenario que cambiaría las cifras de B1), `SHINOBI_UV`, `SHINOBI_LANZADOR=desarrollo`, `SHINOBI_DIALOGO_PRUEBAS`, `SHINOBI_PAPELERA_PRUEBAS`, `SHINOBI_AVISOS_PRUEBAS`, `SHINOBI_YTDLP_FALSO`, `SHINOBI_SEPARADOR_FALSO`, `SHINOBI_LRCLIB_URL`, `SHINOBI_PANTALLA_COMPLETA_SIMULADA`, `SHINOBI_SILENCIAR_AUDIO`, `ELECTRON_RENDERER_URL`. Esperado:
   - encabezado "Hola. Vamos a preparar tu estudio de karaoke.";
   - `page.url()` = `shinobi-app://app/index.html`;
   - título "Shinobi Karaoke";
   - cifras de B1 de `runtime-manifest.json`, no del escenario;
   - sin `llamadas.jsonl` junto al escenario;
   - `modelos/` sin archivos. Es la comprobación empaquetada de que nada se descarga al abrir.
2. **Textos legales**: `window.shinobi.sistema.textoLegal('gpl')` contiene "GNU GENERAL PUBLIC LICENSE"; `('terceros')` contiene "Avisos de terceros".
3. **Biblioteca**: con el runtime en disco se ve la cabecera y una tarjeta de la semilla, `config.json` sigue `completa`, y `fetch('shinobi-media://<id>/pistas/instrumental.flac')` responde 200. `document.fonts` incluye "Atkinson Hyperlegible Next" cargada.
4. **Reparar**: `completa` sin runtime en disco lleva a B5. No se pulsa nada.
5. **Negativos**, sin CDP:
   - `ELECTRON_RUN_AS_NODE=1` y `-e "<escribe un archivo>"`: no se crea;
   - `NODE_OPTIONS=--require <archivo que escribe una marca>`: no se crea;
   - `--inspect=<puerto>`: no escucha.
6. **Instancia única**: un segundo proceso con los mismos datos termina y el primero sigue conectado.

**`humo-worker.mjs`** (**con red**: `uv` descarga Python): con `resources/bin/uv`, ejecuta `uv run --no-project --isolated --python 3.12 python -m shinobi_worker demo --args '{"segundos":1}'`, con `PYTHONPATH=resources/worker` y `PYTHONDONTWRITEBYTECODE=1`. Debe emitir `resultado` y no crear `__pycache__`. Validado en la prueba de concepto en Linux.

## Criterios de aceptación
- [ ] Ninguna línea nueva en `src/`.
- [ ] `npx playwright test` no ejecuta estas pruebas; `npm run test:e2e` no cambia.
- [ ] Los 6 casos pasan en local contra `release/linux-unpacked` (o el equivalente del SO del programador; en WSL, con `SHINOBI_PAQUETE_PERFIL=cuda` si detecta NVIDIA).
- [ ] Sin audio real ni contenido con copyright: la semilla genera FLAC sintéticos.
- [ ] Directorios temporales con limpieza tolerante a archivos bloqueados en Windows.

## Verificación
```bash
cd app
npm run build && npm run uv:descargar && npm run empaquetar:dir   # CON RED, la primera vez
SHINOBI_PAQUETE_BIN="$PWD/release/linux-unpacked/shinobi-karaoke" \
  xvfb-run --auto-servernum npm run test:paquete                  # sin red
```

## Notas de implementación
(las rellena el programador al terminar)
