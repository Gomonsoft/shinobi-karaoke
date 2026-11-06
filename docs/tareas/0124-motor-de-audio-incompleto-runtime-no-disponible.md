# 0124 — Motor de audio incompleto al separar: `RUNTIME_NO_DISPONIBLE`, instalación `dañada` y reinstalación de componentes
- Estado: Hecha
- Paso del pipeline: 3 (separación; deuda detectada en desarrollo el 2026-11-06, se salda en la Fase 6)
- Depende de: — (empieza ya). Si 0112 está en curso, coordinad `shared/config.ts` (bloques distintos: `instalacion` aquí, `reproductor` allí).
- ADRs: 0009 (Revisión 2026-11-06), 0004
- Spec UX: docs/ux/01-primer-arranque.md (B5 "Hay que reparar el motor de audio")
- Archivos:
  - worker: `worker/shinobi_worker/separacion.py`, `worker/shinobi_worker/separacion_falso.py` y sus tests (`worker/tests/`);
  - main: `app/src/main/runtime/gestor.ts`, `app/src/main/runtime/servicio.ts` (+ tests), `app/src/main/separacion/servicio.ts` (+ test);
  - **compartidos**: `app/src/shared/config.ts` (campo nuevo en `instalacion`), `app/src/main/index.ts` (una línea de cableado).
- Paralelizable con: toda la fase. Antes de 0125.

## Contexto para quien implementa
- Síntoma: si al venv le falta un paquete (visto: `No module named 'audio_separator'`), `crear_separador` (`separacion.py`) convierte el `ImportError` en `ERROR_INTERNO` y la interfaz dice "Algo salió mal al separar". La comprobación barata de cada arranque (`comprobarAlArrancar` en `runtime/gestor.ts`: venv, marcador `runtime/instalado.json`, modelo) no lo detecta.
- B5 "Reparar" (estado `dañada`) reinstala la fase `componentes` solo si el marcador no es válido. Además `uv pip install` da por instalado un paquete cuya metadata sigue en el venv: hace falta `--reinstall` para repararlo de verdad.
- La gestión de un fallo de `separar` está en `ServicioSeparacion` (suscripción a `gestor.suscribir` en el constructor; `politicaReintento` y `traducirError` en la petición).
- `RUNTIME_NO_DISPONIBLE` ya está en el catálogo (`shared/errores.ts` y `worker/shinobi_worker/errores.py`).

## Objetivo
Que un motor incompleto se diagnostique como tal, que la instalación quede marcada para reparar y que "Reparar" lo arregle de verdad.

## Criterios de aceptación
- [ ] **Worker**:
  - `crear_separador`: `except ImportError as e` → `ErrorWorker("RUNTIME_NO_DISPONIBLE", f"Falta un componente del motor de audio: {e.name or e}")`, no reintentable;
  - test: con `monkeypatch.setitem(sys.modules, "audio_separator", None)` y quitando `shinobi_worker.separacion_real` de `sys.modules`, `separar` emite `error` con ese código;
  - `separacion_falso.CODIGOS` admite `RUNTIME_NO_DISPONIBLE` (para el E2E de 0125), con su test.
- [ ] **Config**: `instalacion.reinstalar_componentes: z.boolean().default(false)` (lectura tolerante, sin cambiar la versión del esquema; un `config.json` antiguo lo lee como `false`).
- [ ] **Runtime**:
  - `marcarDanada(motivo: 'componentes'): Promise<void>` en el gestor y en `ServicioRuntime`;
  - solo actúa si `instalacion.estado === 'completa'` (si no, no hace nada);
  - pone `estado: 'dañada'`, `fases.componentes: 'pendiente'`, `error: null` y `reinstalar_componentes: true`, borra `runtime/instalado.json` y emite el cambio de estado (`alCambiar`), como `comprobarAlArrancar` con el motivo `marcador`;
  - en la instalación, con `reinstalar_componentes`, el `uv pip install` de la fase `componentes` añade `--reinstall`; al terminar bien la fase, el campo vuelve a `false`;
  - tests con el uv falso: el argumento aparece solo en ese caso.
- [ ] **Separación**:
  - `DependenciasServicioSeparacion` gana `alMotorIncompleto?(): void`;
  - cuando un trabajo `separar` termina en error con código `RUNTIME_NO_DISPONIBLE`, se llama una vez por trabajo;
  - el error no se reintenta (`politicaReintento` → `null`) y no ofrece Rápido;
  - en `main/index.ts`: `alMotorIncompleto: () => void runtime?.servicio.marcarDanada('componentes')`;
  - test del servicio.
- [ ] La puerta que ya existe en `separar()` (estado distinto de `completa` → `RUNTIME_NO_DISPONIBLE` sin encolar) no llama a `alMotorIncompleto`.

## Verificación
```bash
cd worker && uv run ruff check . && uv run pytest
cd ../app && npm run lint && npm run typecheck && npm run format:check && npm test
```

## Notas de implementación

- El worker traduce el `ImportError` del separador a `RUNTIME_NO_DISPONIBLE`. El separador falso y el esquema de escenarios aceptan el mismo código. El test del motor incompleto bloquea la importación de `audio_separator` para que el resultado no dependa de los paquetes instalados.
- `ServicioSeparacion` notifica el error terminal al runtime. El gestor guarda el diagnóstico, invalida el marcador y su respaldo, y usa `--reinstall` en la fase de componentes. Si falla o se interrumpe esa fase, el diagnóstico se conserva hasta completarla. El servicio difunde el cambio mediante su suscripción a la configuración.
- Verificados lint, tipos y formato de la app, y 118 tests de Vitest en los módulos afectados. Ruff, formato y pytest del worker en verde (313 aprobados, 7 excluidos por marcas). Pendiente la verificación completa de la app.
