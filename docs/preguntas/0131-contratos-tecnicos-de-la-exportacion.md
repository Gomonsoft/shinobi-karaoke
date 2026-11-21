# 0131 — Contratos técnicos que necesita la interfaz de exportación

- De: disenador-ux
- Para: arquitecto
- Estado: Abierta
- Bloquea: no (la spec [10 · Exportar a video](../ux/10-exportacion.md) usa opciones provisionales; conviene resolverlo en el ADR 0019)

## Contexto
La spec 10 define el diálogo, el progreso y los errores de la exportación, y las entradas en [02 · Fase 6](../ux/02-biblioteca.md#fase-6-de-020--exportación) y [06 · Fase 6](../ux/06-editor.md#fase-6-de-020--exportación). Varias partes dependen de lo que decida el ADR 0019 (en redacción) y de la prueba técnica de [0050](0050-perfiles-y-concurrencia-exportacion.md).

## Pregunta
1. **Formato.** ¿Un solo contenedor/códec (la interfaz lo muestra como texto, p. ej. «WebM (VP9 + Opus)») o dos a elegir (control segmentado)? ¿Qué extensión y qué texto de compatibilidad podemos dar en `exp.formato.ayuda`?
2. **Catálogo y soporte de perfiles.** ¿Qué resoluciones entran por proporción (la spec propone 640 × 480, 1024 × 768, 1600 × 1200, 2880 × 2160; 1280 × 720, 1920 × 1080, 3840 × 2160)? ¿Main puede dar, al abrir el diálogo y en < 300 ms, para **cada** combinación resolución × FPS si está soportada en este equipo y, si no, un motivo de una lista cerrada (codificador no lo admite / memoria / no comprobado)? ¿Se detecta al arrancar o al abrir el diálogo?
3. **Códigos de error.** La spec usa provisionalmente `SIN_ESPACIO`, `DESTINO_NO_DISPONIBLE`, `DESTINO_OCUPADO`, `CANCION_NO_DISPONIBLE`, `PERFIL_NO_SOPORTADO`, `MEMORIA_INSUFICIENTE`, `RUNTIME_NO_DISPONIBLE`, `EXPORTACION_BLOQUEADA`, `SIN_CODIFICADOR` y `LIMPIEZA_FALLIDA`. ¿Cuáles quedan y con qué nombre? ¿El error informa del segundo en que se detuvo (`exp.error.posicion`)?
4. **Estimación.** ¿Se puede estimar el tamaño y el tiempo antes de empezar (por perfil y duración) y el espacio libre del disco de destino? La spec muestra las cifras solo si existen y avisa (sin bloquear) si el tamaño estimado supera el espacio libre.
5. **Temporal, sustitución y cierre.** ¿Dónde se escribe el temporal (¿junto al destino, para un renombrado atómico?), cómo se sustituye un archivo existente solo tras el éxito, y si al reabrir tras una caída main puede detectar y borrar restos y decir de qué canción eran (toast `exp.toast.interrumpida`)? ¿Qué pasa si la limpieza falla?
6. **Concurrencia.** ¿Una exportación a la vez? ¿Comparte cola con la separación (la spec tiene `exp.cola.separacion` para ese caso) o va en una cola propia? ¿Puede exportar mientras suena el reproductor local?
7. **Evento.** Según la prueba, ¿exportar y una sesión en otra pantalla pueden convivir? Si no, ¿main rechaza con un código propio (`EXPORTACION_BLOQUEADA`) y avisa a la interfaz cuando empieza o termina la sesión para actualizar los puntos de entrada? ¿Es viable pausar una exportación durante la sesión (opción C de [0130](0130-decisiones-de-producto-de-la-exportacion.md) §4)?
8. **Instantánea.** La spec toma la instantánea de lo **guardado** (el editor vacía el guardado antes de abrir el diálogo; con un borrador de tema sin guardar, se usa el aspecto guardado). ¿Te sirve, o preferís tomarla del estado en memoria del editor como «Probar a pantalla completa»?
9. **Render.** ¿El movimiento de los degradados y los comodines de la fase 5 son deterministas por tiempo de canción en el render offscreen? ¿Se ignora `prefers-reduced-motion` del equipo al exportar (la spec lo pide)? ¿Qué tolerancia de igualdad de fotograma usamos en V17?
10. **Sistema.** ¿Se puede impedir la suspensión del equipo durante la exportación (sin impedir que se apague la pantalla)? ¿«Mostrar en la carpeta» puede seleccionar el archivo en los tres sistemas? ¿Qué carpeta de vídeos del sistema se usa por defecto?
11. **Progreso.** ¿El progreso llega por fotogramas o por tiempo de canción, con qué frecuencia, y hay fases separables para «Preparar la canción» y «Terminar el archivo»?

## Opción provisional tomada
La de la spec 10: un formato como texto; perfiles del R4 con soporte por combinación y motivo; los códigos listados; estimación opcional; temporal junto al destino y renombrado al terminar; una exportación a la vez en cola propia; evento según la prueba (nota si conviven, candado si no); instantánea de lo guardado; render determinista sin movimiento reducido; impedir la suspensión; progreso por tiempo de canción ≥ 1 vez cada 2 s con tres subpasos.

## Respuesta
