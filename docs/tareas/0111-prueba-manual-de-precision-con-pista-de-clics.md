# 0111 — Prueba manual de precisión de la marca con la pista de clics (3 SO)
- Estado: Hecha (cerrada por decisión del usuario el 2026-11-06; resultado no concluyente, ver Notas)
- Paso del pipeline: 4
- Depende de: 0095 (pista de clics en la semilla), 0107
- ADRs: 0010 (§1), 0005 (≤ 20 ms con cable o altavoces)
- Spec UX: docs/ux/06-editor.md (criterio 12: "prueba manual con una pista de clics"; criterio 19, Bluetooth)
- Archivos: solo las notas de esta tarea (tabla de resultados). Si hace falta un script de análisis, en `docs/poc/0111-precision/`. **No toca código de producción.**
- Paralelizable con: 0110. **La hace una persona** (o un agente con acceso a un equipo con salida de audio y teclado reales); no bloquea el cierre del código de la fase, pero sí la publicación.

## Contexto
La precisión del sistema (≤ 20 ms) ya está probada con marcas simuladas (0094). Falta comprobar que el equipo real (Chromium, controlador de audio y teclado) no añade un desfase sistemático. La canción «Editor: pista de clics» (0095) tiene un clic cada 2 s a partir de 2 s; la línea *k* debería quedar en `2000·k` ms.

## Criterios de aceptación
- [ ] En macOS (Apple Silicon), Windows y Linux, con **altavoces del equipo o auriculares con cable**:
  1. `npm run semilla && npm run dev` (o el build sin empaquetar);
  2. abrir «Editor: pista de clics», pista Original y 1×;
  3. sincronizar al ritmo pulsando Intro **al oír** cada clic (12 líneas), dos pasadas;
  4. anotar los 12 `inicio_ms` de `cancion.json` y calcular el desfase medio y la desviación frente a `2000·k`;
  5. repetir a 0,5×.
- [ ] Criterio: el **desfase medio** (sistemático, no la dispersión humana) está dentro de ±20 ms a 1× y a 0,5× en los 3 SO. La dispersión humana típica (±30–50 ms) se anota pero no cuenta.
- [ ] Con auriculares **Bluetooth** (si hay): se anota el desfase medio, que se espera de 100–300 ms. Se comprueba que se corrige con el desplazamiento global (`,`/`.`) y que sale `edi.ayuda.bluetooth` al salir del modo.
- [ ] Si algún SO supera ±20 ms de forma sistemática: abrir una pregunta para el arquitecto con los datos (`outputLatency`, `baseLatency` y la marca `getOutputTimestamp` registrados en la consola de desarrollo).

## Verificación
Tabla en las notas: SO, equipo, salida, velocidad, desfase medio (ms), desviación (ms) y observaciones.

## Notas de implementación
Prueba hecha por el usuario el 2026-11-06. Cerrada sin completar el protocolo por falta de tiempo; el usuario da el editor por bueno para el MVP.

| SO | Equipo | Salida | Velocidad | Desfase medio (ms de canción) | Desviación (ms) | Observaciones |
|---|---|---|---|---|---|---|
| macOS | Mac (Apple Silicon) | Altavoces del Mac | 0,5× | +172 (líneas 2–12); +148 con la línea 1 | 37 (89 con la línea 1) | Una pasada. Línea 1 adelantada (−125). +172 ms de canción a 0,5× ≈ 340 ms reales: compatible con tiempo de reacción humano (clics cada 4 s reales, difícil anticiparse). |

**Conclusión**: no concluyente. El desfase es estable (desviación baja), lo que apunta a reacción humana más que a un fallo del reloj, pero no se puede descartar un error de conversión tiempo real → tiempo de canción con la velocidad.

**Pendiente antes de publicar (Fase 7)**:
- Repetir a **1×** con altavoces o cable, anticipando el clic: si el desfase en ms de canción se duplica respecto a 0,5× (≈ +340) o baja a ~0 al anticipar, la app está bien; si sale igual (+172), revisar la conversión con `playbackRate` (ADR 0010 §1) y abrir pregunta al arquitecto con `outputLatency`, `baseLatency` y `getOutputTimestamp`.
- Windows y Linux sin medir; Bluetooth sin medir.
