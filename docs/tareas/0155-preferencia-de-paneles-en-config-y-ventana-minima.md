# 0155 — Preferencia de paneles en `config.json` y ventana mínima

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: Fase 2 (puede ir en paralelo con [0154](0154-ancho-estable-de-forma-de-onda-y-minimapa.md))
- ADRs: [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--preferencias-de-paneles-del-editor), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles)
- Specs: [Editor, subfase 2.1 · Persistencia](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles), [Sistema visual §4](../ux/sistema-visual.md#4-espaciado-rejilla-y-forma)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor)

## Objetivo

Dejar listo el contrato compartido de la subfase: constantes de paneles, campo `editor.paneles` de `config.json` con lectura tolerante por campo, escritura desde el renderer por `config.actualizar` y ventana con un mínimo de contenido de 1024 × 576. **Es la única tarea de la subfase que modifica `shared/config.ts`, `shared/ipc.ts`, `shared/paneles.ts` y `main/index.ts`.** No toca el renderer salvo los dobles que el tipo `Config` obligue a actualizar.

## Contrato

**`app/src/shared/paneles.ts`** (nuevo, sin dependencias salvo tipos). Es la fuente única de los límites, en px CSS a zoom 100 %:

| Constante | Defecto | Mínimo | Máximo absoluto |
|---|---|---|---|
| `lista.ancho` | 300 | 256 | 480 |
| `panel.ancho` | 360 | 300 | 480 |
| `linea_tiempo.alto` | `null` (216 normal / 204 compacto) | 176 (188 en normal, lo aplica el modelo) | 960 |

Además exporta el resto de medidas que usa el modelo de 0156: `ALTO_MIN_ZONA_SUPERIOR = 136`, `ANCHO_MIN_PREVIA = 320`, `ANCHO_DIVISOR = 12`, `ANCHO_RIEL_LISTA = 72`, `ANCHO_RIEL_PANEL = 120`, `ALTO_TIMELINE_MINIMIZADA = { normal: 44, compacto: 40 }`, `ALTO_COMPACTO_DESDE = 800`, `ANCHO_MINIMO_DISENO = 1024`, `PASO_TECLADO = 16`, `PASO_TECLADO_GRANDE = 64` y `preferenciasPanelesPredeterminadas()`.

**`config.json`** (`shared/config.ts`):

```ts
editor: {
  paneles: {
    lista:        { ancho: number /* int 256–480 */, minimizado: boolean },
    panel:        { ancho: number /* int 300–480 */, minimizado: boolean },
    linea_tiempo: { alto: number | null /* int 176–960 */, minimizado: boolean }
  }
}
```

- Cada hoja usa `.catch(<defecto>)`. Los objetos usan `.prefault({})`. Un valor ausente, de otro tipo, no entero o fuera de rango se sustituye por el defecto **de ese campo**. No invalida el resto de `config.json`, no genera `.danado` y no registra error. Si acaso, un `info` en el registro.
- `esquema` sigue en 1 y no hay migración.

**IPC** (`shared/ipc.ts`): `configParcialRendererSchema` gana `editor: z.strictObject({ paneles: z.strictObject({ lista?, panel?, linea_tiempo? }) })`. Cada subobjeto es estricto y parcial, con los mismos rangos y `int()` y **sin** `.catch`: un valor inválido se rechaza. Sin canales nuevos y sin cambios en el preload (`config.actualizar` ya existe).

**Ventana** (`main/index.ts`, `crearVentana`): `useContentSize: true`, `width: 1280`, `height: 800`, `minWidth: 1024`, `minHeight: 576`. Con `useContentSize`, Electron aplica el mínimo al área de contenido. Comprobar que la ventana del reproductor a pantalla completa (ADR 0011) y la simulación `SHINOBI_PANTALLA_COMPLETA_SIMULADA` siguen funcionando.

## Archivos

- `app/src/shared/paneles.ts` (nuevo) y `app/src/shared/paneles.test.ts`.
- `app/src/shared/config.ts`, `app/src/shared/config.test.ts`, `app/src/shared/migraciones.test.ts` (si comprueba la forma completa).
- `app/src/shared/ipc.ts`.
- `app/src/main/configuracion/servicio.test.ts`, `app/src/main/ipc/handlers.test.ts`.
- `app/src/main/index.ts`.
- Dobles que construyan un `Config` completo y dejen de tipar, si los hay (por ejemplo `vistas/editor/fixturesApi.ts` y el doble del preload de E2E). Basta con usar `configPredeterminada()`.
- `app/e2e/ventana.spec.ts` (nuevo).
- `app/README.md` o la documentación de `config.json`, si describe sus campos.

## Criterios de aceptación

- [ ] `configPredeterminada().editor.paneles` vale `{ lista: { ancho: 300, minimizado: false }, panel: { ancho: 360, minimizado: false }, linea_tiempo: { alto: null, minimizado: false } }`.
- [ ] Un `config.json` sin `editor`, con `editor: 5`, con `lista.ancho: 2000`, con `panel.ancho: 299.5`, con `linea_tiempo.alto: "x"` o con `minimizado: "si"` abre con el defecto de **ese** campo y conserva intactos `instalacion`, `separacion`, `reproductor` y el resto de `editor.paneles`. No se crea `config.json.danado`.
- [ ] `config.actualizar({ editor: { paneles: { lista: { ancho: 320 } } } })` fusiona solo ese campo y lo persiste. `ancho: 255`, `481`, `300.5`, una clave desconocida o `linea_tiempo.alto: 175` se rechazan con `ErrorDatosInvalidos` sin cambiar nada. `alto: null` se acepta.
- [ ] Los límites de `paneles.ts` y los del esquema coinciden (prueba que recorra las constantes).
- [ ] En Electron, `getContentSize()` no baja de `[1024, 576]` al pedir `setContentSize(900, 500)`, y `setContentSize(1024, 576)` da `innerWidth`/`innerHeight` = 1024/576 con DPR 1 (`e2e/ventana.spec.ts`).
- [ ] No cambian los casos existentes de configuración, IPC ni seguridad (`seguridad.spec.ts`, `ipc.spec.ts`).

## Verificación

Desde `app/`: `npm test -- src/shared src/main/configuracion src/main/ipc`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/ventana.spec.ts e2e/ipc.spec.ts e2e/seguridad.spec.ts`.

## Notas de implementación

- `shared/paneles.ts` (nuevo): `LIMITES_PANELES` (defecto/mín/máx) y el resto de medidas del contrato, más `preferenciasPanelesPredeterminadas()`. Exportado también desde `shared/index.ts`.
- `shared/config.ts`: `editor.paneles` con lectura tolerante campo a campo. Los objetos usan un ayudante `objetoTolerante` (un `z.preprocess` que lee como `{}` todo lo que no sea objeto, porque `.prefault({})` no cubre `editor: 5`) y cada hoja lleva `.catch(defecto)`. Nuevo tipo `PreferenciasPaneles`. No se registra nada ni se crea `.danado`.
- `shared/ipc.ts`: `configParcialRendererSchema.editor.paneles` estricto y parcial, con los mismos rangos e `int()`, sin `.catch`. Un valor inválido llega al handler como `ARGUMENTOS_NO_VALIDOS`. Sin canales nuevos ni cambios en el preload.
- `main/index.ts`: `useContentSize: true`, 1280 × 800, mínimo 1024 × 576. **Desviación necesaria**: en Windows, `minHeight` con `useContentSize` no descuenta la barra de menú (`setContentSize(900, 500)` daba 550 de alto). Se llama a `setMinimumSize` con el mínimo más el marco real (`getSize() - getContentSize()`), al crear y en `ready-to-show`. Con ello `getContentSize()` no baja de 1024 × 576. No se recalcula si el marco cambia al mover la ventana entre pantallas con otra escala (deuda menor).
- Tests: `shared/paneles.test.ts`, `shared/config.test.ts` (defecto, `editor: 5`, campos inválidos, límites coincidentes entre `paneles.ts`, `configSchema` y el esquema IPC), `main/configuracion/servicio.test.ts` (sin `.danado`, fusión y persistencia) y `main/ipc/handlers.test.ts` (255, 300.5, alto 175 y clave desconocida rechazados). `e2e/ventana.spec.ts` (nuevo).
- Los dobles de `Config` ya tipaban con `configPredeterminada()`, no hizo falta tocarlos. No hay documentación de campos de `config.json` en el README.
- Verificación: `npx vitest run src/shared src/main/configuracion src/main/ipc` (405 pasan, 5 omitidas); `npm run test:e2e -- e2e/ventana.spec.ts e2e/ipc.spec.ts e2e/seguridad.spec.ts e2e/editor.spec.ts e2e/reproductor.spec.ts` (34 pasan, 1 omitida).
