# Estrategia de pruebas

> Decisión del usuario (2026-11-20): en las sesiones de trabajo, las pruebas existen **para dar feedback a los agentes de IA**. Los tokens se invierten en features; la regresión completa la ejecuta el CI y lo demás se verifica a mano con las guías de [`Test-manuales/`](Test-manuales/README.md).

## Niveles

| Nivel                      | Qué cubre                                                                                                                                                            | Quién lo ejecuta                          | Cuándo                                                                                         | Comando (en `app/`)                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **1 · Críticos**           | El flujo principal de punta a punta: Inicio → Biblioteca → Añadir canción → Letra → Editor → Reproductor. Pocas pruebas, estables y rápidas, etiquetadas `@critico`. | Agentes                                   | Al terminar una tarea que toque `main/`, `preload/`, `shared/` o una vista del flujo principal | `npm run test:e2e:criticos`                          |
| **2 · De la feature**      | Tests unitarios relacionados con los archivos cambiados y specs E2E creadas o modificadas en la tarea.                                                               | Agentes                                   | Durante y al terminar cada tarea                                                               | `npm run test:cambios` · `npm run test:e2e:cambios`  |
| **3 · Regresión completa** | Toda la suite Vitest y todos los E2E (secundarios incluidos) en Windows, macOS y Linux.                                                                              | CI de GitHub (`.github/workflows/ci.yml`) | En cada push y PR a `develop`/`main`, y en el PR borrador de la fase                           | — (CI)                                               |
| **4 · Manual**             | Lo que no conviene automatizar o necesita hardware real: dos pantallas, audio por HDMI, Wayland, sensaciones de uso, capturas.                                       | Usuario                                   | Al cerrar la fase o la feature                                                                 | Guías en [`Test-manuales/`](Test-manuales/README.md) |

Siempre, antes de dar una tarea por terminada: `npm run typecheck`, `npm run lint` y `npm run format:check` (baratos y sin ejecutar la app).

### Pruebas críticas y secundarias

- **Críticas** (`@critico`): solo las del flujo principal. Viven en `app/e2e/criticos/` y las mantiene el agente `qa`. Si un crítico falla, la tarea no está terminada.
- **Secundarias**: el resto de los E2E (`app/e2e/*.spec.ts`), que prueban features que usan esas pantallas (temas, separación con errores, YouTube, layout del editor, etc.). Los agentes no las ejecutan en bloque: solo las que su tarea crea o modifica (nivel 2). El CI las ejecuta todas (nivel 3).

### Comandos de feedback

| Comando                                     | Qué hace                                                                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:cambios`                      | `vitest run --changed`: tests unitarios afectados por los cambios sin commit (incluye los que importan archivos cambiados). Con otra base: `npx vitest run --changed <ref>`. |
| `npm run test:e2e:criticos`                 | Compila y ejecuta solo los E2E con la etiqueta `@critico`.                                                                                                                   |
| `npm run test:e2e:cambios`                  | Compila y ejecuta solo las specs E2E cambiadas sin commit (`playwright test --only-changed`). Con otra base: `npx playwright test --only-changed=<ref>`.                     |
| `npx playwright test e2e/<archivo>.spec.ts` | Una spec concreta, tras `npm run build`.                                                                                                                                     |

## Reglas para los agentes

1. **Feedback, no cobertura.** Escribe el test más pequeño que te diga si lo que implementas funciona. Prefiere Vitest (lógica pura, `main/`, componentes con dobles) a E2E.
2. **E2E solo si aporta feedback que Vitest no da**: integración real entre procesos o ventanas, protocolo, IPC por rol, arranque. Una spec por feature como máximo, con los escenarios imprescindibles.
3. **No ejecutes la suite E2E completa ni `npm test` completo** salvo que el usuario o la sesión principal lo pidan. La regresión es del CI.
4. Si un test ajeno falla en `test:cambios`, comprueba si lo rompe tu cambio. Si no es tuyo (entorno, inestabilidad), anótalo en las notas de la tarea y sigue.
5. Lo que solo se puede comprobar a mano (hardware, varios monitores, sensación visual) **no es una tarea de agente**: se añade a la guía manual de la fase en `Test-manuales/`.
6. Las capturas de revisión visual solo se toman cuando la spec UX las pide para una revisión del diseñador.
7. **Reintentos de foco con `requestAnimationFrame`**: los que viven a nivel de módulo (p. ej. `enfocarCuando`) sobreviven al test que los lanzó y pueden robar el foco al siguiente. Mantén un solo enfoque pendiente a la vez y no dependas en una prueba de reintentos de otra.
8. **Specs con sesión de reproducción abierta**: no cierres la app con `app.close()` (main pide confirmación de salida, 0189, y la prueba agota el tiempo en el `finally`, también en macOS). Usa `salirSinConfirmar(app)` de `e2e/salir.ts`.
9. **Texto solo para lectores de pantalla**: usa siempre la clase compartida `soloLector` de `componentes/componentes.module.css` (en otro módulo, `composes: soloLector from '…/componentes.module.css'`). No copies `position:absolute; width:1px; height:1px` sin `top:0; left:0`: su posición estática cae al final del flujo y añade 1 px de scroll de página (regresión de las fases 4 y 6, vista en el CI de `alpha-2`). La suite crítica comprueba `scrollHeight ≤ innerHeight` en la Biblioteca y en el Editor; si falla, busca el último elemento oculto del documento.
10. **Captura 4K en Linux sin GPU**: `exportacion-captura.spec.ts` omite 3840×2160 solo en Linux y solo si la captura sale a lo sumo 2 px menor (Xvfb con GPU por software da 3839×2159). Se comprueba a mano en Linux real con GPU (guía manual de la fase 6).
11. **Efectos pasivos de React en pruebas de componente**: el foco inicial y los efectos de montaje (p. ej. `Escucha` pausa lo que no es la pista activa) se vuelcan en diferido y, bajo carga, caen después de que aparezca el texto o incluso después de un clic. Antes de interactuar con algo cuyo montaje tenga efectos, vacíalos con `await act(async () => {})`; y comprueba el foco con `await waitFor(() => expect(…).toHaveFocus())`, no en síncrono (fallos intermitentes de `Progreso.test.tsx` en alpha-2).

## Regresión en el CI

- Cada fase abre pronto un **PR borrador** de `fase/0.2.0-N-…` a `develop`; cada push ejecuta `ci.yml` completo.
- La sesión principal lee los fallos (`gh run list`, `gh run view --log-failed`) y el agente `qa` los clasifica: regresión de la fase (vuelve a la tarea responsable), inestable (se marca y se corrige aparte) o de entorno.
- Los criterios de cierre de la fase exigen el CI en verde, no ejecuciones locales completas.

## Responsables

- **`qa`**: mantiene los críticos y esta estrategia, clasifica fallos del CI, escribe las guías manuales y propone qué pruebas de feedback necesita cada tarea. Ver `.claude/agents/qa.md`.
- **`arquitecto`**: en cada tarea indica en «Pruebas de feedback» los tests mínimos y qué va a la guía manual.
- **`programador`**: escribe y ejecuta las pruebas de feedback de su tarea (niveles 1 y 2).

## Inventario

Clasificación de las specs de `app/e2e/` (actualizada el 2026-11-20). Las secundarias solo las ejecuta un agente si su tarea las crea o modifica; el CI las ejecuta todas. Las marcadas _opt-in_ se saltan salvo con la variable indicada.

| Spec                                  | Nivel                                         | Feature que cubre                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `criticos/flujo-principal.spec.ts`    | **Crítica** (`@critico`)                      | Flujo principal completo sin red: Biblioteca vacía → importar WAV → separación falsa → pegar letra → sincronizar y marcar como lista → reproductor hasta la pantalla final → salir                                |
| `humo.spec.ts`                        | Secundaria                                    | Arranque de la app y título de la ventana                                                                                                                                                                         |
| `ventana.spec.ts`                     | Secundaria                                    | Tamaño mínimo de la ventana y viewport (DPR 1)                                                                                                                                                                    |
| `ipc.spec.ts`                         | Secundaria                                    | Puente `window.shinobi` y aislamiento del renderer respecto a Node                                                                                                                                                |
| `seguridad.spec.ts`                   | Secundaria                                    | Navegación bloqueada, lista blanca de enlaces, instancia única y aislamiento de la ventana secundaria (`window.shinobiReproductor`)                                                                               |
| `medios.spec.ts`                      | Secundaria                                    | Protocolos `shinobi-media://` y `shinobi-app://`, lista blanca y miniaturas                                                                                                                                       |
| `navegacion.spec.ts`                  | Secundaria                                    | Atajos globales (Ctrl/Cmd + ,), Esc y zoom del menú                                                                                                                                                               |
| `primer-arranque.spec.ts`             | Secundaria                                    | Primer arranque (B1–B5): espacio, errores de red, pausa, CUDA → CPU, reparación y modelo Rápido                                                                                                                   |
| `biblioteca.spec.ts`                  | Secundaria                                    | Biblioteca con la semilla (insignias y líneas de estado) y estado vacío                                                                                                                                           |
| `biblioteca-acciones.spec.ts`         | Secundaria                                    | Filtros, búsqueda, volver a borrador, eliminar, papelera con fallo y editar datos                                                                                                                                 |
| `menu-contextual.spec.ts`             | Secundaria                                    | El menú ⋯ de la tarjeta cabe entero a 1024 × 640                                                                                                                                                                  |
| `importar-archivo.spec.ts`            | Secundaria                                    | Importar archivo local: formulario, cancelar, archivo no válido, arrastrar y cerrar a medias                                                                                                                      |
| `importar-youtube.spec.ts`            | Secundaria                                    | Importar desde YouTube con el doble de yt-dlp: aviso legal, errores, bloqueos, interrupción y cancelación                                                                                                         |
| `youtube-red.spec.ts`                 | Secundaria, _opt-in_ (`SHINOBI_TESTS_RED=1`)  | Descarga real de un vídeo CC BY                                                                                                                                                                                   |
| `separacion.spec.ts`                  | Secundaria                                    | Separación con el separador falso: fases, cola de trabajos, cancelar, panel de actividad, cierre con trabajos y avisos                                                                                            |
| `separacion-errores.spec.ts`          | Secundaria                                    | Errores de separación: memoria, SIGKILL, oferta y descarga del modelo Rápido, modelo que falta y Re-separar                                                                                                       |
| `separacion-motor-incompleto.spec.ts` | Secundaria                                    | Motor incompleto a mitad de sesión y reparación desde B5                                                                                                                                                          |
| `letras.spec.ts`                      | Secundaria                                    | Letras con el doble de LRCLIB: búsqueda, banners de error, pegar, importar .lrc/.txt, sustituir y edición                                                                                                         |
| `letras-red.spec.ts`                  | Secundaria, _opt-in_ (`SHINOBI_TESTS_RED=1`)  | Búsqueda real en LRCLIB                                                                                                                                                                                           |
| `editor.spec.ts`                      | Secundaria                                    | Editor: sincronizar al ritmo, ajuste fino, deshacer, estilo, marcar como lista, autoguardado, marcadores, bucle, línea de tiempo y perfil opt-in                                                                  |
| `editor-layout.spec.ts`               | Secundaria                                    | Layout del editor: alto completo, divisores accesibles, modos minimizados, zoom y anchos                                                                                                                          |
| `reproductor.spec.ts`                 | Secundaria                                    | Reproductor local: barrido por renglón, controles y atajos, pantalla final, pistas ausentes, toast y prueba desde el editor                                                                                       |
| `temas-editor.spec.ts`                | Secundaria                                    | Sección Tema del editor (T1–T23): asignar, editar, guardar como, eliminar con fallo y tema no disponible                                                                                                          |
| `temas-biblioteca.spec.ts`            | Secundaria                                    | Biblioteca de la fase 3: agrupación, búsqueda por álbum, temas de artista y álbum, plegado y foco                                                                                                                 |
| `temas-ajustes.spec.ts`               | Secundaria                                    | Ajustes › Temas: predeterminado, borrado pendiente, `temas.json` ilegible y solo lectura                                                                                                                          |
| `temas-migracion.spec.ts`             | Secundaria                                    | Migración de una biblioteca de esquema 1 al catálogo de temas                                                                                                                                                     |
| `temas-capturas.spec.ts`              | Secundaria, _opt-in_ (`SHINOBI_CAPTURAS_3=1`) | Capturas de revisión de la fase 3 (solo para el diseñador)                                                                                                                                                        |
| `fase5.spec.ts`                       | Secundaria                                    | Fase 5 de 0.2.0 ([0219](tareas/0219-integracion-guia-manual-e-informe-de-la-fase-5.md)): Letra lista de punta a punta y en la sesión, misma fase del fondo en editor y reproductor a 12,3 s y movimiento reducido |
| `fase5-capturas.spec.ts`              | Secundaria, _opt-in_ (`SHINOBI_CAPTURAS_5=1`) | Capturas de revisión de la fase 5 de 0.2.0 ([0218](tareas/0218-capturas-de-revision-de-la-fase-5.md), solo para el diseñador)                                                                                     |

Las specs `e2e/sesion-*.spec.ts` de la fase 4 ([0190](tareas/0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md)) serán secundarias.
