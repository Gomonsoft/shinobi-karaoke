# 0133 — Avisos de terceros: dependencias Python transitivas
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: — (orden en `THIRD_PARTY_NOTICES.md`: después de 0132)
- ADRs: 0012 §7; 0002; 0009 §1
- ¿Red?: **el script, sí** (API JSON de PyPI, con el índice de PyTorch si hace falta), por eso **no** entra en `pytest` por defecto. Sus tests, no: usan respuestas fijas.

## Objetivo
Cumplir lo que `THIRD_PARTY_NOTICES.md` promete desde la Fase 2: "El resto de dependencias transitivas se revisarán al empaquetar". No se redistribuyen, pero el usuario debe ver qué instala y hay que confirmar que nada viola el ADR 0002.

## Archivos
- `worker/scripts/licencias_requisitos.py` y `worker/tests/test_licencias_requisitos.py`;
- `THIRD_PARTY_NOTICES.md`.

## Contratos
- Sin dependencias nuevas: patrón de `worker/scripts/medir_descarga.py`.
- Lee los 5 archivos de `worker/requisitos/`, une los paquetes y consulta `license_expression`, `license` y clasificadores de PyPI.
- Salida ordenada entre `<!-- inicio:dependencias-python -->` y `<!-- fin:dependencias-python -->`: paquete, versión, licencia, en qué perfiles.
- `--comprobar`: compara con el archivo.
- Una licencia que no se pueda clasificar o contenga términos no comerciales, "research only" o similares falla, salvo una entrada revisada a mano en una lista con su motivo. Los `nvidia-*` se listan como licencia de NVIDIA, no redistribuida.
- Si aparece una licencia incompatible, **no se decide en la tarea**: se abre pregunta para el arquitecto.

## Criterios de aceptación
- [ ] Tests sin red, con respuestas de PyPI grabadas e inventadas: expresión SPDX, clasificador, licencia desconocida, no comercial, lista revisada.
- [ ] `uv run pytest` sigue sin usar la red.
- [ ] Ejecutado una vez con red; resultado en `THIRD_PARTY_NOTICES.md`.
- [ ] Se quita la frase "se revisarán al empaquetar".

## Verificación
```bash
cd worker
uv run ruff check . && uv run ruff format --check scripts/licencias_requisitos.py tests/test_licencias_requisitos.py
uv run pytest tests/test_licencias_requisitos.py     # sin red
uv run python scripts/licencias_requisitos.py        # CON RED
```

## Notas de implementación
(las rellena el programador al terminar)
