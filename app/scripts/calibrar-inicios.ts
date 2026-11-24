/**
 * Medida de una señal de encaje por INICIOS de línea (tarea 0385, pregunta 0295). Solo medida: no cambia
 * `shared/encaje.ts` ni ningún veredicto. Funciones puras (sin lectura de archivos); las usa
 * `calibrar-encaje.ts` con la opción `--inicios`.
 *
 * Señal (provisional):
 *  - Arranque de voz: inicio de un intervalo de `detectarVoz` precedido por ≥ `pausaMinimaMs` sin voz.
 *  - Acierto de una línea en el desfase d: hay un arranque en [inicio + d − antesMs, inicio + d + despuesMs].
 *  - O(d): fracción de líneas con acierto. Azar(d) = 1 − exp(−λ·(antesMs + despuesMs)), con λ la densidad de
 *    arranques (por ms) en el tramo [primer inicio + d, último inicio + d]. O*(d) = (O − Azar) / (1 − Azar).
 *  - Contraste de inicios: O*(d) − máx(O*(d ± 800)). d*: el d de la rejilla (±5 s, paso 20 ms) que maximiza O*.
 *    Decisión de implementación: si el máximo es una meseta (varios d seguidos), d* es su punto medio y, si hay
 *    varias mesetas, la más cercana a 0. Un máximo que toca el borde de la rejilla no propone corrección.
 */

export const PARAMETROS_INICIOS = {
  pausasMs: [150, 250, 400],
  /** [antesMs, despuesMs]. */
  ventanas: [
    [300, 150],
    [200, 200]
  ],
  arranquesMinimos: [8, 12, 20],
  oMin: [0.5, 0.6, 0.7],
  cMin: [0.2, 0.3, 0.4],
  desfaseSensibilidadMs: 800,
  desfaseMaxMs: 5000,
  pasoMs: 20,
  /** Mínimo de líneas con inicio (el mismo que el encaje). */
  minLineas: 5
} as const

export const LADOS_MS = [400, 800, 1500] as const
export const DESFASE_PROPONER_MS = 500
export const TOLERANCIA_INICIOS_MS = 200
export const DESPLAZADAS_SENSIBLES_MS = 800
/** Mínimo de propias plausibles aceptadas (criterio de adopción, punto 4). */
export const PLAUSIBLES_MINIMAS = 6

export interface VentanaInicios {
  pausaMinimaMs: number
  antesMs: number
  despuesMs: number
}

/** Inicios de intervalo de voz precedidos por una pausa de al menos `pausaMinimaMs` (el primero siempre). */
export function arranquesDe(intervalos: [number, number][], pausaMinimaMs: number): number[] {
  const salida: number[] = []
  let finAnterior = -Infinity
  for (const [a, b] of intervalos) {
    if (a - finAnterior >= pausaMinimaMs) salida.push(a)
    finAnterior = b
  }
  return salida
}

/** Primer índice con `v[i] >= x` (v ordenado). */
function primeroDesde(v: number[], x: number): number {
  let lo = 0
  let hi = v.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (v[m]! < x) lo = m + 1
    else hi = m
  }
  return lo
}

export interface MedidaInicios {
  /** Arranques de la voz entera. */
  arranques: number
  /** Arranques por segundo en el tramo de la letra (desfase 0). */
  densidad: number
  o0: number
  azar0: number
  ostar0: number
  /** O* al mover la letra −d y +d (como se calcula d*: O*(−d), O*(+d)); `null` si sale de la rejilla. */
  lados: Record<number, [number | null, number | null]>
  /** O*(0) − máx(O*(±800)); 0 si ninguno cae en la rejilla. */
  contraste: number
  /** Solo con rejilla completa. */
  dStar: number | null
  ostarDStar: number
  contrasteDStar: number
  /** El máximo toca el borde de la rejilla: no propone corrección. */
  borde: boolean
}

const redondear = (x: number): number => Math.round(x * 1e4) / 1e4

/**
 * Mide la señal de una letra (inicios en ms, con su `offset_ms` ya sumado) contra la voz de una canción.
 * Con `rejilla` busca también d*; sin ella solo calcula d = 0 y ±800 (las ajenas).
 */
export function medirInicios(
  inicios: number[],
  arranques: number[],
  duracionMs: number,
  v: VentanaInicios,
  rejilla: boolean
): MedidaInicios | null {
  const t = [...inicios].sort((a, b) => a - b)
  if (t.length < PARAMETROS_INICIOS.minLineas) return null
  const primero = t[0]!
  const ultimo = t[t.length - 1]!
  const tramo = Math.max(1, ultimo - primero)
  const ancho = v.antesMs + v.despuesMs

  const cuenta = (a: number, b: number): number =>
    Math.max(0, primeroDesde(arranques, b + 1e-9) - primeroDesde(arranques, a))
  const oEn = (d: number): number => {
    let n = 0
    for (const u of t) {
      const i = primeroDesde(arranques, u + d - v.antesMs)
      if (i < arranques.length && arranques[i]! <= u + d + v.despuesMs) n++
    }
    return n / t.length
  }
  const azarEn = (d: number): number =>
    1 - Math.exp(-(cuenta(primero + d, ultimo + d) / tramo) * ancho)
  const ostarEn = (d: number): number => {
    const az = azarEn(d)
    return az >= 1 ? 0 : (oEn(d) - az) / (1 - az)
  }

  const minimo = Math.max(-PARAMETROS_INICIOS.desfaseMaxMs, -primero)
  const maximo = Math.min(PARAMETROS_INICIOS.desfaseMaxMs, duracionMs - 1 - ultimo)
  const paso = PARAMETROS_INICIOS.pasoMs
  const dMin = Math.ceil(minimo / paso) * paso
  const dMax = Math.floor(maximo / paso) * paso
  const enRejilla = (d: number): boolean => d >= dMin && d <= dMax
  const sens = PARAMETROS_INICIOS.desfaseSensibilidadMs
  const contrasteEn = (d: number): number => {
    const lados = [d - sens, d + sens].filter(enRejilla).map(ostarEn)
    return lados.length === 0 ? 0 : ostarEn(d) - Math.max(...lados)
  }

  const o0 = oEn(0)
  const azar0 = azarEn(0)
  const ostar0 = ostarEn(0)
  const lados: Record<number, [number | null, number | null]> = {}
  for (const m of LADOS_MS) {
    lados[m] = [
      enRejilla(-m) ? redondear(ostarEn(-m)) : null,
      enRejilla(m) ? redondear(ostarEn(m)) : null
    ]
  }
  const medida: MedidaInicios = {
    arranques: arranques.length,
    densidad: redondear((cuenta(primero, ultimo) / tramo) * 1000),
    o0: redondear(o0),
    azar0: redondear(azar0),
    ostar0: redondear(ostar0),
    lados,
    contraste: redondear(contrasteEn(0)),
    dStar: null,
    ostarDStar: 0,
    contrasteDStar: 0,
    borde: false
  }
  if (!rejilla || dMax < dMin) return medida

  const valores: number[] = []
  for (let d = dMin; d <= dMax; d += paso) valores.push(ostarEn(d))
  const maxO = Math.max(...valores)
  // Mesetas del máximo; se elige la más cercana a 0 y su punto medio.
  let mejor: { a: number; b: number; cerca: number } | null = null
  let i = 0
  while (i < valores.length) {
    if (valores[i]! < maxO - 1e-9) {
      i++
      continue
    }
    let j = i
    while (j + 1 < valores.length && valores[j + 1]! >= maxO - 1e-9) j++
    const dA = dMin + i * paso
    const dB = dMin + j * paso
    const cerca = dA <= 0 && dB >= 0 ? 0 : Math.min(Math.abs(dA), Math.abs(dB))
    if (!mejor || cerca < mejor.cerca) mejor = { a: i, b: j, cerca }
    i = j + 1
  }
  const run = mejor!
  const dStar = Math.round((dMin + ((run.a + run.b) / 2) * paso) / paso) * paso
  medida.dStar = dStar
  medida.ostarDStar = redondear(maxO)
  medida.contrasteDStar = redondear(contrasteEn(dStar))
  medida.borde = run.a === 0 || run.b === valores.length - 1
  return medida
}

// --- Barrido de reglas ---------------------------------------------------------------------------

export type Gate = 'talCual' | 'sinFines'
export const GATES: Gate[] = ['talCual', 'sinFines']

/** Lo que el encaje actual dice de cada letra (veredicto), por variante de la letra. */
export interface VeredictosEncaje {
  propia: string
  /** Por desplazamiento en ms. */
  desplazadas: Record<number, string>
  /** Por id de la canción cuya voz se usa. */
  ajenas: Record<string, string>
}

export interface EntradaInicios {
  id: string
  /** Inicios con tiempo (offset 0) en ms. */
  inicios: number[]
  intervalos: [number, number][]
  duracionMs: number
  /** Veredicto del encaje sin guardas (talCual): las plausibles son las que daba `coincide`. */
  veredictoBase: string
  veredictos: Record<Gate, VeredictosEncaje>
}

export interface Reglas {
  oMin: number
  cMin: number
  arranquesMinimos: number
}

export interface FilaInicios {
  id: string
  lineas: number
  propia: MedidaInicios | null
  /** Máx O*(0) y máx contraste de las letras de otras canciones sobre esta voz... ver `mejorAjena`. */
  mejorAjenaOstar0: number | null
  mejorAjenaContraste: number | null
  /** O*(0) de la propia desplazada −0,8 y +0,8 s. */
  desplazada800: [number | null, number | null]
  veredicto: string
  veredictoBase: string
}

export interface MedidasVentana extends VentanaInicios {
  filas: FilaInicios[]
  /** Medidas completas, para el barrido. */
  propias: Record<string, MedidaInicios | null>
  desplazadas: Record<string, Record<number, MedidaInicios | null>>
  ajenas: Record<string, Record<string, MedidaInicios | null>>
}

export const DESPLAZAMIENTOS_INICIOS_MS = [-3000, -1500, -800, -400, 400, 800, 1500, 3000] as const

export function medirVentana(canciones: EntradaInicios[], v: VentanaInicios): MedidasVentana {
  const arranques = new Map(
    canciones.map((c) => [c.id, arranquesDe(c.intervalos, v.pausaMinimaMs)])
  )
  const propias: MedidasVentana['propias'] = {}
  const desplazadas: MedidasVentana['desplazadas'] = {}
  const ajenas: MedidasVentana['ajenas'] = {}
  const filas: FilaInicios[] = []
  for (const c of canciones) {
    const arr = arranques.get(c.id)!
    propias[c.id] = medirInicios(c.inicios, arr, c.duracionMs, v, true)
    desplazadas[c.id] = {}
    for (const s of DESPLAZAMIENTOS_INICIOS_MS) {
      desplazadas[c.id]![s] = medirInicios(
        c.inicios.map((x) => x + s),
        arr,
        c.duracionMs,
        v,
        true
      )
    }
    ajenas[c.id] = {}
    for (const otra of canciones) {
      if (otra.id === c.id) continue
      ajenas[c.id]![otra.id] = medirInicios(
        c.inicios,
        arranques.get(otra.id)!,
        otra.duracionMs,
        v,
        false
      )
    }
    const aj = Object.values(ajenas[c.id]!).filter((m): m is MedidaInicios => m !== null)
    filas.push({
      id: c.id,
      lineas: c.inicios.length,
      propia: propias[c.id]!,
      mejorAjenaOstar0: aj.length ? Math.max(...aj.map((m) => m.ostar0)) : null,
      mejorAjenaContraste: aj.length ? Math.max(...aj.map((m) => m.contraste)) : null,
      desplazada800: [
        desplazadas[c.id]![-800]?.ostar0 ?? null,
        desplazadas[c.id]![800]?.ostar0 ?? null
      ],
      veredicto: c.veredictos.talCual.propia,
      veredictoBase: c.veredictoBase
    })
  }
  return { ...v, filas, propias, desplazadas, ajenas }
}

export interface ResumenRegla extends VentanaInicios, Reglas {
  propias: number
  propiasAceptadas: number
  plausibles: number
  plausiblesAceptadas: number
  ajenasAceptadas: number
  ajenasAceptadasSinFines: number
  pares: number
  /** Desplazadas ≥ 0,8 s aceptadas como «coincide» (talCual / sin fines). */
  desplazadasAceptadas: number
  desplazadasAceptadasSinFines: number
  /** Propias para las que la regla propondría una corrección (falsas). */
  falsasCorrecciones: number
  falsasCorreccionesSinFines: number
  /** Desplazadas ≥ 0,5 s de las propias aceptadas, y las recuperadas a ±200 ms con d*. */
  desplazadasDeAceptadas: number
  recuperadas200: number
  /** Correcciones propuestas (todas las propias, desplazadas ≥ 0,5 s) con error > 200 ms. */
  correccionesMalas: number
  correccionesMalasSinFines: number
  cumple1a4: boolean
  /** Criterio 5: solo si se quiere proponer el desfase. */
  cumple5: boolean
  adopcion: boolean
}

const acepta = (m: MedidaInicios | null, r: Reglas): boolean =>
  m !== null && m.arranques >= r.arranquesMinimos && m.ostar0 >= r.oMin && m.contraste >= r.cMin
/** La regla en d*: propone una corrección. */
const proponeCorreccion = (m: MedidaInicios | null, r: Reglas): boolean =>
  m !== null &&
  m.dStar !== null &&
  !m.borde &&
  Math.abs(m.dStar) >= DESFASE_PROPONER_MS &&
  m.arranques >= r.arranquesMinimos &&
  m.ostarDStar >= r.oMin &&
  m.contrasteDStar >= r.cMin

export function resumirRegla(
  canciones: EntradaInicios[],
  m: MedidasVentana,
  r: Reglas
): ResumenRegla {
  const res = {
    pausaMinimaMs: m.pausaMinimaMs,
    antesMs: m.antesMs,
    despuesMs: m.despuesMs,
    ...r,
    propias: canciones.length,
    propiasAceptadas: 0,
    plausibles: 0,
    plausiblesAceptadas: 0,
    ajenasAceptadas: 0,
    ajenasAceptadasSinFines: 0,
    pares: 0,
    desplazadasAceptadas: 0,
    desplazadasAceptadasSinFines: 0,
    falsasCorrecciones: 0,
    falsasCorreccionesSinFines: 0,
    desplazadasDeAceptadas: 0,
    recuperadas200: 0,
    correccionesMalas: 0,
    correccionesMalasSinFines: 0
  }
  const sufijo = (g: Gate): '' | 'SinFines' => (g === 'talCual' ? '' : 'SinFines')
  for (const c of canciones) {
    const propia = m.propias[c.id] ?? null
    const plausible = c.veredictoBase === 'coincide'
    if (plausible) res.plausibles++
    // Aceptada: `coincide` del encaje actual, o `dudosa` y la regla (nunca `no_coincide`).
    const v0 = c.veredictos.talCual.propia
    const aceptada = v0 === 'coincide' || (v0 === 'dudosa' && acepta(propia, r))
    if (aceptada) {
      res.propiasAceptadas++
      if (plausible) res.plausiblesAceptadas++
    }
    for (const g of GATES) {
      const s = sufijo(g)
      const k = (
        n: 'ajenasAceptadas' | 'desplazadasAceptadas' | 'falsasCorrecciones' | 'correccionesMalas'
      ) => `${n}${s}` as keyof typeof res
      const inc = (n: keyof typeof res): void => {
        ;(res[n] as number)++
      }
      if (c.veredictos[g].propia === 'dudosa' && proponeCorreccion(propia, r)) {
        inc(k('falsasCorrecciones'))
      }
      for (const sh of DESPLAZAMIENTOS_INICIOS_MS) {
        const med = m.desplazadas[c.id]![sh] ?? null
        const ve = c.veredictos[g].desplazadas[sh]
        if (
          Math.abs(sh) >= DESPLAZADAS_SENSIBLES_MS &&
          (ve === 'coincide' || (ve === 'dudosa' && acepta(med, r)))
        ) {
          inc(k('desplazadasAceptadas'))
        }
        if (Math.abs(sh) >= DESFASE_PROPONER_MS && ve === 'dudosa' && proponeCorreccion(med, r)) {
          const error = Math.abs(med!.dStar! + sh)
          if (error > TOLERANCIA_INICIOS_MS) inc(k('correccionesMalas'))
        }
      }
      for (const otra of canciones) {
        if (otra.id === c.id) continue
        if (g === 'talCual') res.pares++
        const ve = c.veredictos[g].ajenas[otra.id]
        if (
          ve === 'coincide' ||
          ve === 'desfasada' ||
          (ve === 'dudosa' && acepta(m.ajenas[c.id]![otra.id] ?? null, r))
        ) {
          inc(k('ajenasAceptadas'))
        }
      }
    }
    if (aceptada) {
      for (const sh of DESPLAZAMIENTOS_INICIOS_MS) {
        if (Math.abs(sh) < DESFASE_PROPONER_MS) continue
        res.desplazadasDeAceptadas++
        const med = m.desplazadas[c.id]![sh] ?? null
        if (
          c.veredictos.talCual.desplazadas[sh] === 'dudosa' &&
          proponeCorreccion(med, r) &&
          Math.abs(med!.dStar! + sh) <= TOLERANCIA_INICIOS_MS
        ) {
          res.recuperadas200++
        }
      }
    }
  }
  // `pares` se cuenta una vez por par (talCual); las propias plausibles: solo con tiempos medibles.
  const cumple1a4 =
    res.ajenasAceptadas === 0 &&
    res.ajenasAceptadasSinFines === 0 &&
    res.desplazadasAceptadas === 0 &&
    res.desplazadasAceptadasSinFines === 0 &&
    res.falsasCorrecciones === 0 &&
    res.falsasCorreccionesSinFines === 0 &&
    res.plausiblesAceptadas >= PLAUSIBLES_MINIMAS
  const cumple5 =
    res.desplazadasDeAceptadas > 0 &&
    res.recuperadas200 / res.desplazadasDeAceptadas >= 0.8 &&
    res.correccionesMalas === 0 &&
    res.correccionesMalasSinFines === 0
  return { ...res, cumple1a4, cumple5, adopcion: cumple1a4 }
}

export interface ResultadoInicios {
  parametros: typeof PARAMETROS_INICIOS
  ventanas: MedidasVentana[]
  reglas: ResumenRegla[]
  /** La más estricta (menos propias aceptadas) que cumple 1–4; `null` si ninguna. */
  elegida: ResumenRegla | null
  /** Más propias aceptadas con 0 ajenas, 0 desplazadas y 0 falsas correcciones (sin exigir el punto 4). */
  masAceptadasSegura: ResumenRegla | null
}

export function medirTodoInicios(canciones: EntradaInicios[]): ResultadoInicios {
  const ventanas: MedidasVentana[] = []
  const reglas: ResumenRegla[] = []
  for (const pausaMinimaMs of PARAMETROS_INICIOS.pausasMs) {
    for (const [antesMs, despuesMs] of PARAMETROS_INICIOS.ventanas) {
      const m = medirVentana(canciones, { pausaMinimaMs, antesMs, despuesMs })
      ventanas.push(m)
      for (const arranquesMinimos of PARAMETROS_INICIOS.arranquesMinimos) {
        for (const oMin of PARAMETROS_INICIOS.oMin) {
          for (const cMin of PARAMETROS_INICIOS.cMin) {
            reglas.push(resumirRegla(canciones, m, { oMin, cMin, arranquesMinimos }))
          }
        }
      }
    }
  }
  // La más estricta: menos propias aceptadas; en empate, umbrales más altos y, después, el primero del barrido.
  const cumplen = reglas.filter((r) => r.adopcion)
  const elegida =
    [...cumplen].sort(
      (a, b) =>
        a.propiasAceptadas - b.propiasAceptadas ||
        b.oMin - a.oMin ||
        b.cMin - a.cMin ||
        b.arranquesMinimos - a.arranquesMinimos
    )[0] ?? null
  const seguras = reglas.filter(
    (r) =>
      r.ajenasAceptadas === 0 &&
      r.ajenasAceptadasSinFines === 0 &&
      r.desplazadasAceptadas === 0 &&
      r.desplazadasAceptadasSinFines === 0 &&
      r.falsasCorrecciones === 0 &&
      r.falsasCorreccionesSinFines === 0
  )
  const masAceptadasSegura =
    [...seguras].sort((a, b) => b.plausiblesAceptadas - a.plausiblesAceptadas)[0] ?? null
  return { parametros: PARAMETROS_INICIOS, ventanas, reglas, elegida, masAceptadasSegura }
}

const sg = (n: number | null): string => (n === null ? '-' : n.toFixed(2))

export function formatearInicios(r: ResultadoInicios): string[] {
  const col = (v: string | number, n: number): string => String(v).padStart(n)
  const s: string[] = [
    '',
    'Inicios de línea (tarea 0385; solo medida, no cambia ningún veredicto):'
  ]
  for (const m of r.ventanas) {
    s.push(
      '',
      `Pausa ≥ ${m.pausaMinimaMs} ms, ventana (−${m.antesMs}, +${m.despuesMs}) ms. Propias:`,
      'id        líneas  arranq.  dens/s    O(0)  azar  O*(0)  O*±400      O*±800      O*±1500     contraste  d*_ini  veredicto      ajena máx O*  ajena máx contr.  desplaz. −0,8/+0,8 (O*)'
    )
    for (const f of m.filas) {
      const p = f.propia
      if (!p) {
        s.push(
          `${f.id.slice(0, 8).padEnd(8)} ${col(f.lineas, 7)}  no medible (menos de ${PARAMETROS_INICIOS.minLineas} líneas)`
        )
        continue
      }
      const par = (k: number): string => `${sg(p.lados[k]![0])}/${sg(p.lados[k]![1])}`.padEnd(11)
      s.push(
        `${f.id.slice(0, 8).padEnd(8)} ${col(f.lineas, 7)} ${col(p.arranques, 8)} ${col(p.densidad, 7)} ${col(p.o0, 7)} ${col(p.azar0, 5)} ${col(p.ostar0, 6)}  ${par(400)} ${par(800)} ${par(1500)} ${col(p.contraste, 9)}  ${col(p.dStar === null ? '-' : `${p.dStar}${p.borde ? '*' : ''}`, 6)}  ${f.veredicto.padEnd(13)} ${col(sg(f.mejorAjenaOstar0), 12)} ${col(sg(f.mejorAjenaContraste), 17)}  ${sg(f.desplazada800[0])}/${sg(f.desplazada800[1])}`
      )
    }
  }
  s.push(
    '',
    'Reglas (se aplican solo a las letras que el encaje deja en dudosa; el resto de las cifras, tal cual / sin fines):',
    'pausa  ventana    mín  oMin  cMin  propias(plaus.)  ajenas/pares  desplaz.  falsas corr.  recup.±200  corr. malas'
  )
  for (const x of r.reglas) {
    s.push(
      `${col(x.pausaMinimaMs, 5)}  (−${x.antesMs},+${x.despuesMs})  ${col(x.arranquesMinimos, 3)}  ${col(x.oMin, 4)}  ${col(x.cMin, 4)}  ` +
        `${col(`${x.propiasAceptadas}/${x.propias} (${x.plausiblesAceptadas}/${x.plausibles})`, 15)}  ` +
        `${col(`${x.ajenasAceptadas}+${x.ajenasAceptadasSinFines}/${x.pares}`, 12)}  ` +
        `${col(`${x.desplazadasAceptadas}+${x.desplazadasAceptadasSinFines}`, 8)}  ` +
        `${col(`${x.falsasCorrecciones}+${x.falsasCorreccionesSinFines}`, 12)}  ` +
        `${col(`${x.recuperadas200}/${x.desplazadasDeAceptadas}`, 10)}  ` +
        `${col(`${x.correccionesMalas}+${x.correccionesMalasSinFines}`, 11)}  ` +
        `Criterio de adopción (pregunta 0295): ${x.adopcion ? 'SÍ' : 'NO'}${x.adopcion ? ` (corregir el desfase, punto 5: ${x.cumple5 ? 'SÍ' : 'NO'})` : ''}`
    )
  }
  const el = r.elegida
  s.push(
    '',
    el
      ? `Combinación más estricta que cumple 1–4: pausa ${el.pausaMinimaMs} ms, ventana (−${el.antesMs},+${el.despuesMs}), mínimo ${el.arranquesMinimos} arranques, oMin ${el.oMin}, cMin ${el.cMin}: propias aceptadas ${el.propiasAceptadas}/${el.propias} (plausibles ${el.plausiblesAceptadas}/${el.plausibles}); corregir el desfase: ${el.cumple5 ? 'SÍ' : 'NO'}.`
      : 'Ninguna combinación cumple el criterio de adopción (pregunta 0295).'
  )
  const ms = r.masAceptadasSegura
  s.push(
    ms
      ? `Referencia (no es una elección): con 0 ajenas, 0 desplazadas y 0 falsas correcciones, lo máximo de propias plausibles aceptadas es ${ms.plausiblesAceptadas}/${ms.plausibles} (p. ej. pausa ${ms.pausaMinimaMs}, (−${ms.antesMs},+${ms.despuesMs}), mín ${ms.arranquesMinimos}, oMin ${ms.oMin}, cMin ${ms.cMin}).`
      : 'Referencia: ninguna combinación consigue 0 ajenas, 0 desplazadas y 0 falsas correcciones a la vez.'
  )
  return s
}
