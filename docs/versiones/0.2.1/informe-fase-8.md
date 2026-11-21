# Informe de la fase 8 de 0.2.1 · Sincronía y editor más simples

Tareas: [0261](../../tareas/0261-origen-de-las-palabras-y-regla-de-descarte.md) a [0270](../../tareas/0270-dock-pestana-funciones-y-menu-de-la-cabecera.md) y [0271](../../tareas/0271-verificacion-capturas-e-informe-de-la-fase-8.md). Decisiones: [ADR 0021](../../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §1 a §8 y spec [06 · Fase 8](../../ux/06-editor.md#fase-8-de-021--sincronía-y-editor-más-simples).

## Qué cambia para quien usa la app

- Los tiempos por palabra que traía la letra (LRCLIB, LRC mejorado) ya no se usan: la línea se barre de forma progresiva entre su inicio y su fin. Siguen en el archivo hasta que se edita esa línea.
- Mover el inicio o el fin de una línea (tirador, campos, I/O, flechas, ritmo, silencios) descarta sus palabras en el mismo paso del historial; Ctrl/Cmd + Z las devuelve. Solo avisa si eran hechas a mano (`edi.toast.palabras`).
- Sin atajo S, sin `,`/`.` y sin «Desplazamiento de toda la letra»; `offset_ms` se sigue respetando.
- Doble clic en una región o Mayús + L: escuchar la línea de 0,5 s antes a 0,5 s después.
- Dock con «Marcar como letra lista»/«Marcar como lista» + «Hecho» según el estado; pestaña «Funciones» (exportar, silencios, modo y estado); menú ⋯ con solo «Atajos» y «Restablecer distribución».

## Resultados de las tareas

| Tarea | Resultado |
|---|---|
| 0261–0267 | Lotes B, C: modelo de palabras, importación, render, biblioteca (informes de sus tareas). |
| 0268 | S, `,`/`.`, desplazamiento y marcas de palabras importadas retirados; textos nuevos. |
| 0269 | `shared/escucha.ts`, doble clic y Mayús + L. Límite: con «Bloquear enunciado» en la misma línea el margen se suena con una reproducción previa y se vuelve a armar el bucle (posible corte de decenas de ms). |
| 0270 | Dock, «Funciones», riel y menú ⋯ reducido. Pestañas como `radiogroup` (pregunta [0152](../../preguntas/0152-cambio-de-modalidad-en-lista-incompleta-y-pestanas-del-panel.md)). |
| 0271 | `fase8.spec.ts` (2 pruebas), capturas E8-19 en [`revision-0.2.1-fase-8/`](../../ux/revision-0.2.1-fase-8/), borrado de `desplazar`/`fijarDesplazamiento`/`formatearDesplazamiento`/`interpretarDesplazamiento` y de `Limite` `desplazamiento` en `shared/letras/tiempos.ts`. |

Además: `main/biblioteca/servicio.ts` `marcarLista` ya no exige `LINEAS_SIN_INICIO` si la canción ya está lista (cambio de modalidad de una Lista incompleta, spec 8.6).

## Pruebas

Verificación final en Windows, rama `version-0.2.1` (el informe de la fase 9 comparte la ejecución):

- `typecheck`, `lint` y `format:check`: limpios.
- Vitest completo: 3410 pasan, 8 fallan por `EPERM` de enlaces simbólicos en Windows (`appProtocolo.test.ts` y `medios.test.ts`, entorno).
- `npm run build` y toda la suite Playwright con `--workers=1` y `SHINOBI_UV` apuntando al `uv.exe` del repositorio (sin él las pruebas que esperan la forma de onda fallan): 202 pasan, 1 falla y el resto son capturas *opt-in*. Tras los últimos cambios se repitieron el crítico, `editor.spec.ts`, `fase5.spec.ts` y `reproductor.spec.ts`: 39 pasan y 1 falla. El fallo es siempre `editor.spec.ts › el bucle nativo mantiene la fase audible…` (error de fase ≈ 30 ms frente al límite de 20 ms): pasa si es la primera prueba que lanza la app y falla en cuanto se ha lanzado otra antes (reproducido con tres combinaciones), así que parece una medición del reloj de audio dependiente del estado de la máquina, no de la fase 8. Queda para el CI y para `qa`.
- E2E de la fase: `fase8.spec.ts` cubre E8-1 (sin ◆, sin «por palabra», sin desplazamiento, S sin efecto, abrir no escribe el archivo) y E8-2/E8-4 (corregir el fin con el campo deja la línea sin palabras y las demás intactas, sin toast con palabras importadas, un Ctrl+Z las devuelve). R8-6 (misma fracción de la barra) queda cubierta por la prueba compartida del modelo de render de la tarea 0265.

## Capturas

`docs/ux/revision-0.2.1-fase-8/`: `editor-1280x720-{100,125}-{final-ruin-sin-palabras, panel-sin-desplazamiento, dock-borrador, dock-lista, dock-letra-lista, funciones-borrador, funciones-lista, funciones-no-disponible, riel-funciones, menu-cabecera}.png` (con letras inventadas de la semilla). B8-7 y R8-7 (biblioteca por fecha y barra de carga) son de las tareas 0266 y 0265 y no se han regenerado aquí.

## Para la guía manual de `qa`

- Final Ruin y Valiente reales: corregir el fin de una línea y comparar el barrido; Ctrl+Z.
- Assassins Creed Unity en Letra lista: los fines automáticos cambian una vez al abrir.
- Barra de carga a 5 m en una TV de 55".
- S, `,` y `.` no hacen nada; la nota Bluetooth tras salir del modo al ritmo.
- Se encuentran exportar, silencios, modo y volver a borrador sin abrir ⋯; foco tras cada acción.
- El dock de las tres modalidades no se parte en los seis viewports de la subfase 2.1.
- Doble clic en una región con ratón y con *touchpad*.
