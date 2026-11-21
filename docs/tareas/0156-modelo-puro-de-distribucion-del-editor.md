# 0156 — Modelo puro de distribución del editor

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0155](0155-preferencia-de-paneles-en-config-y-ventana-minima.md) (constantes de `shared/paneles.ts`)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles)
- Specs: [Editor, subfase 2.1](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) («Qué cede primero», «Divisores», «Modos minimizados», «Persistencia»)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor)

## Objetivo

Calcular en funciones puras, sin DOM, los tamaños **efectivos** del editor a partir de los tamaños **preferidos** y de las medidas reales. También el efecto de cada tecla y de cada arrastre sobre un divisor. Las tareas 0157–0161 solo consumen este modelo. Se puede programar en paralelo con 0154 y 0158, porque solo crea archivos nuevos.

## Contrato

`app/src/renderer/src/vistas/editor/distribucion.ts`:

```ts
interface MedidasEditor {
  ancho: number            // contenedor raíz del editor, px CSS (sin márgenes laterales)
  alto: number             // alto disponible bajo la barra de la app
  altoCabecera: number     // medido (≈ 80 normal, 48 compacta)
  altoTransporte: number   // medido (dos filas: ≈ 96 normal, 80 compacto)
  altoBannerSync?: number  // medido, solo en el modo sincronizar
}
interface EntradaDistribucion {
  medidas: MedidasEditor
  preferencias: PreferenciasPaneles   // tipo de shared/config.ts
  pestana: 'sincronia' | 'estilo'
  sincronizando: boolean
}
interface Distribucion {
  compacto: boolean
  bajoMinimo: null | 'ancho' | 'alto'     // disposición B / scroll vertical de página
  lista:  { ancho: number; minimizado: boolean; min: number; max: number }
  panel:  { ancho: number; minimizado: boolean; min: number; max: number }
  lineaTiempo: {
    visible: boolean                       // false en Estilo
    alto: number; altoPistaVoz: number
    minimizado: boolean
    minimizadoPorEspacio: boolean
    min: number; max: number
  }
  altoZonaSuperior: number
}
function calcularDistribucion(e: EntradaDistribucion): Distribucion
function aplicarTecla(d: Distribucion, divisor: 'lista' | 'panel' | 'dock', tecla: string, mayus: boolean):
  { tipo: 'tamano'; valor: number } | { tipo: 'alternar' } | null
function aplicarArrastre(d: Distribucion, divisor: …, inicio: number, deltaPx: number): number
function preferenciaTrasAccion(pref: PreferenciasPaneles, divisor: …, valorVisible: number): PreferenciasPaneles
```

Reglas, todas de la spec:

- `compacto = alto_viewport < 800`. `min`/`max` son los **efectivos**: el máximo de la lista y del panel es `min(480, lo que deje 320 a la vista previa)`. El del dock es lo que deje 136 a la zona superior. En compacto, el mínimo y el defecto del dock son 176/204. En normal son 188/216.
- Orden de cesión en alto: zona superior hasta 136 → pista de voz hasta 48 → (compacto ya aplicado) → línea de tiempo `minimizadoPorEspacio` → `bajoMinimo = 'alto'`. En ancho: previa hasta 320 → lista hasta 256 → panel hasta 300. Con ancho < 1024, `bajoMinimo = 'ancho'`, sin divisores de columnas ni rieles.
- Alto de la línea de tiempo = filas fijas (controles, regla 32, vista general 32) + pista de voz. Solo la pista de voz crece (defecto 76, mínimo 48).
- Un panel minimizado aporta su riel (72/120 px) y libera su ancho para la previa. La línea de tiempo minimizada mide 44 px (40 en compacto).
- En la pestaña Estilo no hay línea de tiempo ni divisor del dock, y la zona superior se queda el alto. La preferencia del dock no cambia.
- En el modo sincronizar, el dock se reserva para `altoBannerSync` + la línea de tiempo minimizada y crece sin bajar la zona superior de 136. Nunca cambia preferencias.
- `aplicarTecla`: flechas del eje ±16 (±64 con Mayús), en el sentido de la tabla de la spec. Inicio = mínimo, Fin = máximo efectivo, Intro = alternar. Las flechas del otro eje devuelven `null`. Desde minimizado, una flecha que agranda expande partiendo del mínimo.
- `aplicarArrastre` acota a `[min, max]` y nunca minimiza. Desde minimizado, parte del mínimo.
- `preferenciaTrasAccion` guarda el valor **visible** redondeado a entero. Nunca escribe a partir de un recorte por falta de espacio.

## Archivos

- `app/src/renderer/src/vistas/editor/distribucion.ts` (nuevo).
- `app/src/renderer/src/vistas/editor/distribucion.test.ts` (nuevo).

## Criterios de aceptación

- [ ] Con preferencias por defecto y las medidas reales de cabecera y transporte (80/96 en normal, 48/80 en compacto), los seis viewports de la matriz dan `bajoMinimo = null`, línea de tiempo completa y zona superior ≥ 136. Con márgenes de 12/8 px, hueco de 8 px bajo la cabecera y divisor del dock de 12 px: 1024 × 576 → 160, 1280 × 720 → 304 y 1536 × 864 → 384 (±8 px). Las cifras aproximadas de la spec (≈ 150/300/356) suponen una cabecera normal de 96 px. La real mide 80 px (ver 0157).
- [ ] 1024 × 500 (zoom de interfaz): `minimizadoPorEspacio = true` sin cambiar `preferencias`. A 853 × 480 (zoom 150 % en 1280 × 720): `bajoMinimo = 'ancho'`.
- [ ] Lista 480 y panel 480 a 1024 de ancho: los efectivos se recortan respetando previa ≥ 320, lista ≥ 256 y panel ≥ 300, y las preferencias de entrada no cambian. Con alto 600 a 1280 × 720, la línea de tiempo se recorta y la zona superior queda en 136.
- [ ] Estilo: `lineaTiempo.visible = false` y la zona superior absorbe el alto. Modo sincronizar: el banner y la fila minimizada caben y la zona superior sigue ≥ 136.
- [ ] `aplicarTecla` cubre las 4 flechas en cada divisor, Mayús, Inicio, Fin, Intro y las teclas ajenas. `aplicarArrastre` se detiene en ambos límites.
- [ ] Sin DOM ni React: el test corre en `node` sin jsdom.

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas/editor/distribucion`, `npm run lint`, `npm run typecheck`.

## Notas de implementación

- `distribucion.ts` y `distribucion.test.ts` (36 pruebas, entorno `node` con `// @vitest-environment node`). Exporta además los tipos `DivisorEditor` y `AccionTecla`.
- Convenciones que el contrato no fijaba: `compacto = medidas.alto + 56 < 800` (`alto` ya descuenta la barra); `bajoMinimo = 'ancho'` si `medidas.ancho + 32 < 1024` (`ancho` excluye los márgenes laterales); margen superior 12/8, hueco de 8 bajo la cabecera y divisor del dock de 12. `altoTransporte` y `altoCabecera` incluyen su relleno. Con esas cifras: 1024 × 576 → 160, 1280 × 720 → 304 y 1536 × 864 → 384.
- A 1024 de viewport las preferencias por defecto (300 + 360) no dejan 320 a la previa, así que la lista cede a 288 (la preferencia no cambia). Un mínimo de 932 sí cabe.
- `lineaTiempo.alto` es el alto que ocupa en el dock (44/40 minimizada; banner + fila minimizada en sincronizar; 0 en Estilo). `altoPistaVoz` es el de la línea de tiempo expandida. En sincronizar y en Estilo `min === max`, y el divisor del dock no responde (`null`).
- Desde minimizado, una flecha que agranda da `min ± paso` (mín + 16 o 64) y una que reduce da `null`. Intro en el dock con `minimizadoPorEspacio` da `null`. `preferenciaTrasAccion` además expande (`minimizado: false`) y acota a los límites absolutos. `aplicarArrastre`: `deltaPx` es el desplazamiento de pantalla (+ derecha/abajo); crece con + en la lista y con − en el panel y el dock.
- Se añadió `export * from './paneles'` a `shared/index.ts`.
- Verificación: `npx vitest run src/renderer/src/vistas/editor/distribucion` (36 pasan), lint, typecheck y format:check limpios.
