# Guía manual · Fase 5 · Calibración de «Ajustar los silencios»

- Versión: 0.2.0 · Fase: 5
- ADR: [0018 §6.4](../../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) · Tarea: [0210](../../tareas/0210-herramienta-de-calibracion-del-ajuste-de-silencios.md)
- Duración estimada: 10 min
- Requisitos: un equipo con Node 24 y `npm install` hecho en `app/`; la biblioteca real con las 6 canciones sincronizadas a mano (fines fijados a mano) y con los picos de voz ya generados, es decir, **abiertas al menos una vez en el editor**. La herramienta es de solo lectura: no escribe nada en la biblioteca ni en el repositorio.

## Casos

### 1. Calibrar con las canciones reales

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 1.1 | En `app/`, ejecuta `npm run calibrar:silencios -- <carpeta-de-la-biblioteca>` (la que contiene una carpeta por canción). Con `--ids a,b,c` se limita a esas canciones. | Una línea «Canciones: N (…)» y una tabla con 144 filas, ordenada por error medio. Una `*` marca los valores actuales. Cualquier canción sin caché de picos sale como «AVISO … se omite». | ☐ |
| 1.2 | Mira la fila `*` y las primeras de la tabla: error medio, error máximo, «sin silencio» y «cortes» (propuesta más de 150 ms antes de la verdad). | Las filas con pocos cortes y error medio bajo son las candidatas. Un corte falso es peor que un fin tardío. | ☐ |
| 1.3 | Copia la tabla (al menos las 10 primeras filas y la fila `*`) en la respuesta al arquitecto. **No subas audio, letras ni la tabla al repositorio.** | El arquitecto actualiza `PARAMETROS_SILENCIOS` y la revisión del ADR 0018. | ☐ |

## Ejecuciones

| Fecha | Quién | Equipo | Resultado | Incidencias |
|---|---|---|---|---|
| | | | | |
