# 0002 — ¿El MVP debe permitir sincronizar la letra palabra a palabra o basta por línea?
- De: arquitecto
- Para: usuario
- Estado: Respondida
- Bloquea: no (bloqueará el desglose de tareas del editor, fase 5)

## Contexto
ADR 0005 define un formato interno que admite tiempos por **línea** y, opcionalmente, por **palabra**. LRCLIB a veces devuelve letras ya sincronizadas por palabra; muchas otras solo por línea, y las letras pegadas a mano no traen tiempos.

- **Solo por línea** en las herramientas del editor: el usuario marca el inicio de cada línea ("toque al ritmo"); el resaltado hace un barrido progresivo de la línea a velocidad constante. Simple y rápido de usar (≈ una pasada de la canción).
- **También por palabra**: resaltado exacto palabra a palabra (estilo karaoke clásico), pero sincronizar a mano palabra a palabra multiplica el esfuerzo del usuario (una pulsación por palabra, varias pasadas) y el trabajo de implementación del editor. La alternativa automática (alineación con IA) quedó fuera del MVP por peso y complejidad.

En ambos casos, si la letra ya viene con tiempos por palabra (LRCLIB o un `.lrc` mejorado importado), se mostrará el resaltado por palabra.

## Pregunta
¿El editor del MVP debe incluir herramientas para sincronizar **por palabra**, o es suficiente **por línea** (con resaltado por palabra solo cuando la letra ya lo traiga)?

## Opción provisional tomada (si no bloquea)
Herramientas de sincronía solo por línea; el modelo de datos y el reproductor soportan palabras desde el principio para poder añadirlo después sin migraciones.

## Respuesta
Decisión del usuario (2026-11-03): **solo por línea** en las herramientas del editor del MVP. El resaltado por palabra se muestra solo cuando la letra ya trae tiempos por palabra (LRCLIB o .lrc mejorado). Modelo de datos y reproductor siguen soportando palabras para ampliarlo después.
