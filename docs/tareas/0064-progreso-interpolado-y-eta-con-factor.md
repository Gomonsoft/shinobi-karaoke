# 0064 — Progreso interpolado y tiempo restante de la separación con el factor del manifiesto o el medido
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0059; 0014 (Hecha)
- ADRs: 0004 (Ejecución en segundo plano → Progreso; Tiempos medidos)
- Spec UX: docs/ux/04-progreso-pipeline.md (Tiempo restante; barra que nunca retrocede; criterio 3)
- Cuándo: en paralelo con 0060 y 0063 (esta toca `main/trabajos/progreso.ts`)

## Objetivo
Calidad emite un evento de `tqdm` cada 11–18 s (≈ 19 pasos por 3,5 min, tarea 0005 §7). Sin interpolar, la barra salta a trompicones y la ETA "por velocidad observada" de 0014 no es fiable hasta pasados varios pasos. El main **interpola** entre eventos con el ritmo esperado y calcula la ETA combinando la estimación y lo observado.

## Criterios de aceptación
- [x] `EstimadorProgreso` (o una variante para la separación) admite `ritmoEsperado: { segundosFase: number }`, la duración esperada de la fase `separando` = minutos de audio × factor × 60. El factor lo pasa el llamador (0065):
  - el medido en este equipo (`config.separacion.factores_medidos[modo]`) si existe;
  - si no, el punto medio de `[min, max]` del manifiesto o de `estimacion`;
  - si no hay ningún factor, sin interpolación (comportamiento de 0014).
- [x] **Interpolación**: un temporizador del main (1 s) avanza el valor publicado de forma lineal según el tiempo transcurrido desde el último evento real y el ritmo por paso (`segundosFase / total`).
  - Nunca supera el siguiente límite de paso menos un margen (`(paso + 1) / total − 0,005`).
  - Nunca retrocede: al llegar un evento real menor que lo interpolado, se mantiene el valor hasta alcanzarlo.
  - Se sigue respetando el máximo de ~4 eventos/s.
- [x] **ETA en `separando`**:
  - antes de 15 s → `null` ("Calculando tiempo…", igual que 0014);
  - después, media ponderada entre la estimación por factor (peso decreciente) y la velocidad observada de los pasos reales (peso creciente con el número de pasos; con ≥ 5 pasos, solo la observada). Se añaden ~1 s de `guardando`.
  - Las fases indeterminadas (`preparando`, `cargando_modelo`, `guardando`, `reintentando`) no tienen ETA.
- [x] `descargando_modelo` usa la ETA por bytes de 0014, sin interpolación.
- [x] La persistencia de `progreso` en `cancion.json` (cada ≥ 5 %) usa solo valores reales, no interpolados.
- [x] Tests con reloj falso: eventos cada 12 s con 19 pasos → valores publicados crecientes cada segundo y nunca por encima del siguiente límite; evento real atrasado → no retrocede; ETA `null` < 15 s, y converge a la observada; sin factor → comportamiento de 0014 sin cambios (los tests existentes pasan).

## Notas de implementación
- `app/src/main/trabajos/progreso.ts`: `EstimadorProgreso(segundosMinimos?, ritmoEsperado?: { segundosFase })`. `registrar(fase, valor, ahoraMs, pasos?: { paso, total })`; nuevos `interpolar(ahoraMs)`, `valorReal` e `interpolando`. Solo `separando` con ritmo y pasos conocidos se interpola; sin ritmo o sin pasos el comportamiento de 0014 no cambia.
- `app/src/main/trabajos/gestor.ts`: `PeticionTrabajo.ritmoEsperado` (lo pasará 0065 con el factor medido o el punto medio del manifiesto/estimación); un `setInterval` de 1 s por trabajo (`INTERVALO_INTERPOLACION_MS`) publica el valor interpolado por `enviarProgreso` (máx. 4 eventos/s); se detiene en `limpiarProgreso`. La persistencia cada 5 % usa `estimador.valorReal` (nunca el interpolado). `detalle` de `separando` (`{ paso, total }`) ahora se reenvía al renderer.
- Interpolación: `valor_real + transcurrido / segundosFase`, tope `(paso + 1) / total − 0,005`, sin retroceso. ETA: `null` < 15 s; luego media ponderada estimada/observada (peso observado = pasos/5, solo observada con ≥ 5 pasos) + 1 s de `guardando`; entre eventos la ETA baja con el reloj.
- Tests: `progreso.test.ts` (19 pasos cada 12 s, retraso, ETA, sin ritmo) y `gestor.test.ts` (temporizadores falsos, persistencia real, parada al terminar).
- Probar: `npx vitest run src/main/trabajos`.
- Deuda: cuando 0065 conecte el factor hay que pasar `ritmoEsperado`; la ETA de `descargando_modelo` no cambia (0014).
