# 0010 — En un M1 de 8 GB la CPU separa más rápido que MPS/CoreML: revisar el perfil "Calidad" en Apple Silicon
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no

## Contexto
El spike 0005 midió en un MacBook Air M1 de 8 GB (única máquina disponible) con una canción de 3:27 (factor = min de proceso / min de audio):

| Modelo | CPU | MPS / CoreML (selección automática de audio-separator) |
|--------|-----|-----------------------------------|
| Calidad (MelBand RoFormer Kim) | 1,08–1,13 | **1,71–1,72** (RAM de proceso 0,8–1,3 GB + 1,2 GB en MPS) |
| Rápido (UVR-MDX-Net Inst HQ 4) | 0,70–0,79 | **1,74** (usa `CoreMLExecutionProvider`; pico de RAM 3,3 GB) |

Es decir, en este equipo **MPS no acelera: es ~1,6× más lento que la CPU** y, para el modelo Rápido (ONNX), la selección automática de audio-separator en Apple Silicon es peor que forzar la CPU. ADR 0004 asigna "Apple Silicon (MPS) → Calidad (~2–6 min por canción de 4 min)": en CPU el M1 hace Calidad en ~4,5 min (factor 1,1) y Rápido en ~3 min, dentro del rango, pero la elección MPS cuesta ~6–7 min.

## Pregunta
1. ¿Se fuerza CPU para ambos modelos en Apple Silicon (ocultando MPS a torch y usando solo `CPUExecutionProvider` en ONNX)? Un M2/M3/M4 Pro/Max podría comportarse distinto: no se ha podido medir.
2. ¿Se añade al comando `diagnostico` del worker un micro-benchmark (p. ej. 30 s de audio en CPU y en MPS) para elegir dispositivo, en lugar de asumir que la GPU es más rápida?
3. ¿Sigue siendo "Calidad" el modo automático en Apple Silicon (CPU, factor ~1,1–1,3) o pasa a "Rápido" (~0,7–0,8)? Depende de cuánta espera acepta la UX (spec 04).

## Opción provisional tomada (si no bloquea)
Manifiesto con los factores medidos tal cual (CPU y MPS separados) y sin cambiar la lógica de perfiles hasta tu respuesta.

## Respuesta
(arquitecto, 2026-11-04)

1. **Sí: en Apple Silicon se fuerza CPU para ambos modelos** (PyTorch en `cpu` para Calidad; ONNX Runtime solo con `CPUExecutionProvider` para Rápido). El mecanismo concreto (equivalente al `--cpu` del spike) queda dentro de `Separador`. Motivo: es la única medición real que tenemos y CPU fue ~1,6× más rápida que MPS y ~2,3× más rápida que CoreML, con un pico de RAM aceptable (≤ 3,3 GB con 8 GB). MPS sigue soportado en el código como opción interna (no visible en la UI), por si mediciones futuras en M2–M4 Pro/Max lo justifican.
2. **No hay micro-benchmark en `diagnostico` en el MVP.** Costaría 1–2 min extra en el primer arranque, exigiría el modelo ya descargado y su resultado en 30 s de audio es ruidoso (±8 % entre ejecuciones medido). El mecanismo que ya existe basta para la estimación: tras cada separación se guarda el factor medido en `config.json` y sustituye al de referencia (ADR 0004). Si en una máquina Apple Silicon más potente se mide MPS claramente más rápido (> 1,3×), se reabrirá con una regla por chip (detectable sin Python) antes que con un benchmark.
3. **"Automático" en Apple Silicon sigue siendo Calidad, ejecutado en CPU.** Factor medido 1,08–1,27 → ≈ 4,5–5 min para 4 min de audio, dentro del rango "2–6 min" que ya asumían ADR 0004 y la spec UX 04, así que **no cambia la UX**. Rápido queda disponible en Ajustes (≈ 3 min). Es una decisión técnica (no altera el alcance ni lo que ve el usuario), por eso no se eleva al usuario.

El manifiesto guarda los factores por dispositivo como en la opción provisional, pero el perfil `apple_silicon` apunta a los de CPU. Recogido en ADR 0004 (tabla de perfiles y tiempos) y `arquitectura.md`.
