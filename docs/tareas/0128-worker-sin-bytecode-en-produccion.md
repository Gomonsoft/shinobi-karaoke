# 0128 — Worker sin *bytecode* en producción
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0012 §4, §5; 0009 §5
- ¿Red?: no.

## Objetivo
Que Python no escriba `__pycache__` dentro de `resources/worker`. En macOS rompería el sello de la firma *ad hoc*; en Windows ensuciaría la instalación.

## Archivos
- `app/src/main/trabajos/worker.ts` (`resolverLanzador`, modo `produccion`) y su test;
- `app/src/main/runtime/gestor.ts` (`diagnosticadorReal`) y su test.

## Contratos
- Ambos lanzadores añaden `PYTHONDONTWRITEBYTECODE: '1'` a su entorno.
- Modo `desarrollo` sin cambios: sigue con `uv run`.
- No se añade ninguna variable `SHINOBI_*`.

## Criterios de aceptación
- [ ] Test: `resolverLanzador({ modo: 'produccion', … }).env.PYTHONDONTWRITEBYTECODE === '1'`, en Windows y POSIX.
- [ ] Test: el lanzador de `diagnosticadorReal` lleva la misma variable.
- [ ] Revisar con `grep` cualquier otro proceso que ejecute el intérprete del venv con `PYTHONPATH` a `resources/worker` y anotar el resultado.
- [ ] El modo desarrollo no cambia.

## Verificación
```bash
cd app
npx vitest run worker lanzador gestor
npm run lint && npm run typecheck
```

## Notas de implementación
(las rellena el programador al terminar)
