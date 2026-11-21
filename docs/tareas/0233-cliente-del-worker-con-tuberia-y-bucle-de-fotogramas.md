# 0233 — Cliente del worker con tubería y bucle de fotogramas con contrapresión

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §1, §7 y §9
- Spec UX: —

## Objetivo

Poder lanzar el worker con stdin en tubería y mover fotogramas de una fuente (la ventana offscreen) a esa tubería sin superar 2 fotogramas pendientes.

## Contrato

- `main/trabajos/worker.ts`: opción `entrada: 'tuberia'` que lanza con `stdio: ['pipe', 'pipe', 'pipe']` y expone el `Writable`. El resto del comportamiento (JSON Lines, cancelación del árbol, `PROCESO_TERMINADO`) no cambia. Opción `prioridad: 'baja'` que aplica `os.setPriority(pid, PRIORITY_BELOW_NORMAL)` tras lanzar (ignora el error si el SO lo rechaza).
- `main/exportacion/bucle.ts` (puro, con puertos): `ejecutarBucle({ total, pintar(n), capturar(n) → Buffer, escribir, señal })`:
  - pide `n` en orden, captura y escribe;
  - antes de pedir `n + 1` espera `drain` si `writableLength > 2 × tamañoFotograma`;
  - comprueba el tamaño de cada `Buffer` (`ancho × alto × 4`) y falla con `PERFIL_NO_SOPORTADO` si no coincide;
  - se detiene con la señal de cancelación sin escribir más.

## Criterios de aceptación

- [x] Con un `Writable` falso lento, nunca hay más de 2 fotogramas pendientes y los `n` llegan en orden sin huecos.
- [x] Cancelar a mitad deja de pedir fotogramas en ≤ 1 fotograma.
- [x] Un `Buffer` de tamaño incorrecto termina con `PERFIL_NO_SOPORTADO`.
- [x] El worker lanzado con `entrada: 'tuberia'` recibe los bytes (prueba de integración con un script Python mínimo que cuenta bytes, como `lanzador.integracion.test.ts`).

## Pruebas de feedback

- Unitarias: `bucle.test.ts` y la prueba de integración del cliente.
- E2E: ninguna.
- Críticos: sí (toca `main/`).
- Manual: nada.

## Notas de implementación

Qué se hizo:
- `main/trabajos/worker.ts`: `OpcionesEjecucion` gana `entrada: 'tuberia'` (stdin en tubería; `alEntrada(stdin)` entrega el `Writable`, con el error `EPIPE` absorbido) y `prioridad: 'baja'` (`os.setPriority(pid, PRIORITY_BELOW_NORMAL)`, error ignorado). El resto no cambia.
- `main/exportacion/bucle.ts`: `ejecutarBucle({ total, ancho, alto, pintar, capturar, destino, señal, alFotograma })`. Espera `drain` si `writableLength > 2 × ancho × alto × 4`; la espera también se libera al cancelar. Tamaño incorrecto: rechaza con `{ codigo: 'PERFIL_NO_SOPORTADO' }`. Devuelve `{ estado: 'completo' | 'cancelado', escritos }`.
- Pruebas: `main/exportacion/bucle.test.ts` y `main/trabajos/tuberia.integracion.test.ts` (script Python que cuenta bytes; se omite sin python).

Notas: con ≤ 2 fotogramas pendientes se pide otro, así que justo tras escribir puede haber 3 en cola; el «máximo 2» se interpreta como umbral de espera. Cancelar tras `pintar` descarta el fotograma ya capturado. Deuda: ninguna. Manual: nada.
