# 0134 — Comprobar que ninguna ruta descarga Rápido sin `rapido_aceptado`
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0004 (Revisiones), 0009 (Revisión 2026-11-05)
- Preguntas: 0012, 0018
- ¿Red?: no. Sin modelos: descargador falso.

## Objetivo
Dar evidencia del criterio de la 0025: "antes de publicar, comprobar que ninguna ruta descarga Rápido sin `rapido_aceptado`".

## Archivos
`app/src/main/runtime/consentimientoRapido.test.ts` (nuevo). Solo se toca código de producción si aparece un fallo, y entonces se anota.

## Rutas que hay que cubrir
Lectura previa, a confirmar por la tarea:

| # | Ruta | Defensa vista |
|---|---|---|
| 1 | `gestor.descargarModelo('rapido')` | `exigirConsentimiento` |
| 2 | `gestor.instalar({ modelo: 'rapido' })` (fase de modelo con `forzado`) | **A comprobar**: `forzado` entra en `instalar` sin pasar visiblemente por `exigirConsentimiento` |
| 3 | `gestor.instalar()` sin argumento y comprobación al arrancar, con `modo: 'rapido'` en `config.json` y `rapido_aceptado: null` | `modoSeparacionVigente` devuelve `calidad` |
| 4 | `runtime.aceptarRapido` (IPC) sin oferta vigente | `puedeAceptarRapido`; guarda el consentimiento antes de descargar |
| 5 | Separación: `asegurarModelo` y `repararModelo` con `modo: 'rapido'` sin consentimiento | Modo vigente |
| 6 | "Rápido pendiente" al arrancar (`esRapidoPendiente`) | Exige `rapido_aceptado !== null` |
| 7 | Worker: audio-separator con un modelo que falta | Lo debe impedir el main. **Comprobar** que el worker no puede disparar su descarga propia de `Inst_HQ_4` si `asegurarModelo` no actuó (`deps.modelos` opcional) y que en la app empaquetada `deps.modelos` siempre existe |
| 8 | `scripts/instalar-runtime.mjs --modelo rapido` | Escribe el consentimiento. No entra en el paquete: lo comprueba 0131 con `scripts` |

## Criterios de aceptación
- [ ] Una prueba por ruta. Con `rapido_aceptado: null`, el descargador falso no recibe ninguna URL del modelo Rápido; las rutas 1 y 2 lanzan `ARGUMENTOS_NO_VALIDOS` u otro rechazo.
- [ ] Contraprueba: con consentimiento y oferta vigente, la ruta sí descarga Rápido.
- [ ] Si la ruta 2 o la 7 no están defendidas: se corrige en esta tarea con el cambio mínimo y una prueba, y se anota. Si requiere otra decisión, pregunta al arquitecto y tarea `Bloqueada`.
- [ ] Tabla final de rutas en las notas de implementación: es la evidencia que pide la 0142.

## Verificación
```bash
cd app
npx vitest run consentimientoRapido
npm run lint && npm run typecheck
```

## Notas de implementación
No apareció ninguna ruta que descargue Rápido sin consentimiento; no se modificó código de producción. Se añadió `app/src/main/runtime/consentimientoRapido.test.ts` para cubrir los dos puntos de entrada del gestor y la contraprueba de descarga después de guardar la fecha de consentimiento.

| # | Ruta comprobada | Evidencia |
|---|---|---|
| 1 | `gestor.descargarModelo('rapido')` | `consentimientoRapido.test.ts`: sin fecha rechaza con `ARGUMENTOS_NO_VALIDOS` y no llama al descargador; con fecha lo llama y registra el modelo. Refuerzo en `gestor.test.ts`. |
| 2 | `gestor.instalar({ modelo: 'rapido' })` | `consentimientoRapido.test.ts`: rechaza antes de iniciar el runtime. `gestor.test.ts` añade la contraprueba tras aceptar. |
| 3 | Instalación normal y comprobación de configuración con `modo: rapido` pero sin consentimiento | `gestor.test.ts`: instalación normal descarga Calidad; `configuracion/servicio.test.ts` valida que el modo vigente vuelve a Calidad. |
| 4 | `runtime.aceptarYUsarRapido` sin oferta vigente y con oferta | `runtime/servicio.test.ts`: sin oferta rechaza y no guarda consentimiento; con oferta válida guarda el consentimiento antes de iniciar la descarga, tanto en primer arranque como tras fallo de separación. |
| 5 | Separación: modelo que falta o hay que reparar | `separacion/servicio.test.ts` verifica que el modo sin consentimiento usa Calidad; `servicio.reintentos.test.ts` cubre el fallback si falta Rápido y la descarga de reparación del modelo seleccionado. El modo que llega a `asegurarModelo`/`repararModelo` se calcula con `modoSeparacionVigente`. |
| 6 | Rápido pendiente al iniciar | `runtime/servicio.test.ts`: el estado solo indica pendiente si existe fecha de consentimiento, modo Calidad y modelo Rápido no descargado. |
| 7 | Modelo ausente en el worker | `worker/tests/test_separacion_contrato.py::test_modelo_ausente_no_descarga`: devuelve `MODELO_NO_DISPONIBLE` sin cargar audio-separator. `app/src/main/index.ts` siempre crea e inyecta `crearPuertoModelos` en la app. |
| 8 | `scripts/instalar-runtime.mjs --modelo rapido` | La opción expresa la petición explícita del usuario; el script escribe primero `modo: rapido` y `rapido_aceptado`. La comprobación del script empaquetado corresponde a 0131, tal como indica esta tarea. |

Archivos: `app/src/main/runtime/consentimientoRapido.test.ts`; sin cambios en producción.

Verificación: `npx vitest run consentimientoRapido gestor.test.ts runtime/servicio.test.ts separacion/servicio.test.ts separacion/servicio.reintentos.test.ts` (139 aprobadas), `uv run pytest tests/test_separacion_contrato.py -k modelo_ausente_no_descarga` (1 aprobada), lint, typecheck y format:check pasan.
