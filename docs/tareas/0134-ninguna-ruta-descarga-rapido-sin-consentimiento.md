# 0134 — Comprobar que ninguna ruta descarga Rápido sin `rapido_aceptado`
- Estado: Pendiente
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
(las rellena el programador al terminar)
