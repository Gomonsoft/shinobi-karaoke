# 0060 — Worker: comando `separar`, interfaz `Separador` y separador falso
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0059
- ADRs: 0004 (Ejecución en segundo plano; Revisiones), 0009 §8
- Spec UX: — (fases y textos: docs/ux/04-progreso-pipeline.md, solo como referencia)
- Cuándo: en paralelo con 0063, 0064 y 0067

## Objetivo
Comando `python -m shinobi_worker separar --args '<json>'` que valida la entrada, emite las fases de 0059 y escribe `voz.flac` e `instrumental.flac` en `salida_dir`, delegando la separación en una interfaz `Separador`. En esta tarea solo existe el **separador falso** (sin PyTorch ni modelos); el adaptador real es 0061.

## Criterios de aceptación
- [x] `worker/shinobi_worker/separacion.py`:
  - `Separador` (Protocol): `separar(entrada: Path, salida_dir: Path, modelo, dispositivo, bloques, al_progreso) -> None`, que deja en `salida_dir` exactamente `voz.flac` e `instrumental.flac`.
  - `al_progreso(fase, valor, detalle)` reenvía a `protocolo.progreso`.
  - Fábrica `crear_separador(entorno)`: falso si llega `SHINOBI_SEPARADOR_FALSO`; si no, el real de 0061 (importación **perezosa**: `separar` con el doble no importa `audio_separator`, `torch` ni `onnxruntime`; test que lo comprueba con `sys.modules`).
- [x] Comando `separar` (en `comandos.py`, importación perezosa como `importar_archivo`):
  - valida los argumentos (0059) y que la entrada es FLAC PCM 16, 44,1 kHz, estéreo, leyéndola con soundfile (`preguntas/0009` punto 5); si no → `FORMATO_NO_SOPORTADO`;
  - emite `preparando` → `cargando_modelo` → `separando` (valores crecientes con `detalle {paso,total}`) → `guardando` → `resultado` (0059);
  - comprueba antes de cargar que existe `modelo.dir/modelo.archivo` (y el yaml de Calidad); si no → `MODELO_NO_DISPONIBLE`;
  - errores: `OSError` ENOSPC → `SIN_ESPACIO`; `MemoryError` → `MEMORIA_INSUFICIENTE` (reintentable); el resto → `ERROR_INTERNO` con el detalle en `log`.
  - Si falla, borra lo que haya escrito en `salida_dir` (el main también lo hace; doble seguro). Nunca escribe fuera de `salida_dir`.
- [x] **Separador falso** (`separacion_falso.py`), según el escenario de 0059:
  - genera las dos pistas con soundfile a partir de la entrada (p. ej. `instrumental` = mezcla con −6 dB, `voz` = diferencia de canales), FLAC PCM 16 / 44,1 kHz / estéreo, con la duración de la entrada;
  - emite `pasos` eventos de `separando` repartidos en `segundos`;
  - aplica `fallos`: el primero cuya condición `cuando` coincida con los argumentos (bloques, dispositivo) o con `intento` (variable `SHINOBI_INTENTO` que pasa el main) lanza el error indicado;
  - `morir_con_sigkill: true` → el proceso se mata a sí mismo con SIGKILL a mitad (en Windows, `os._exit(137)`), para probar la detección de 0063.
- [x] Tests (pytest, sin marcador, en la CI normal): separación falsa de 3 s de audio generado (formato y duración de las salidas), fases en orden y valores crecientes, entrada WAV float → `FORMATO_NO_SOPORTADO`, modelo ausente → `MODELO_NO_DISPONIBLE`, fallo configurado por bloques, `salida_dir` vacía tras un fallo, argumentos inválidos.
- [x] README del worker: comando `separar`, argumentos y variable del doble.

## Notas de implementación
- **Archivos**: `worker/shinobi_worker/separacion.py` (Protocol `Separador`, `crear_separador`, comando `separar`), `separacion_falso.py` (doble), registro perezoso en `comandos.py`, `worker/tests/test_separar.py` (16 tests, sin PyTorch), README del worker.
- **Reparto de fases**: el comando emite `preparando`; el `Separador` emite `cargando_modelo`, `separando` y `guardando` por `al_progreso`. `segundos_separando` se mide entre el primer `separando` y `guardando`. `version_audio_separator` es un atributo del `Separador` (`"falso"` en el doble).
- **Decisiones**: el doble falla justo tras `cargando_modelo`, antes de `separando`; con SIGKILL muere a mitad de `separando` (`os._exit(137)` en Windows). Entrada inexistente -> `ARGUMENTOS_NO_VALIDOS`. El yaml de Calidad se busca como `<archivo sin extensión>.yaml`. Sin doble, `crear_separador` importa `separacion_real.SeparadorReal` (0061); mientras no exista responde `ERROR_INTERNO`.
- **Probar**: `cd worker && uv run pytest tests/test_separar.py`; a mano: `SHINOBI_SEPARADOR_FALSO=escenario.json python -m shinobi_worker separar --args '...'`.
- **Deuda**: ninguna; el manejo de SIGTERM/`*.partial` es del main (0065).
