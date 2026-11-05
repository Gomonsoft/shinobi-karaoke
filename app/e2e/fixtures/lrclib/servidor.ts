import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { leerFixtureLetraJson } from '../../../src/shared/__fixtures__/letras'

/**
 * Doble HTTP local de LRCLIB para los E2E de letras (0088, ADR 0005 Revisión 2026-11-05).
 * Escucha en `127.0.0.1:0` y sirve `/api/get`, `/api/search` y `/api/get/:id` con las fixtures
 * inventadas de 0077. El escenario lo decide una palabra clave del título buscado (`track_name`
 * o `q`); un título sin palabra clave responde 404 / lista vacía. La app lo usa con
 * `SHINOBI_LRCLIB_URL` (solo sin empaquetar). Nada sale a `lrclib.net`.
 */

/** Palabras clave de título → escenario. */
export const TITULOS = {
  /** `get` y `search` devuelven letras con palabra, línea y texto. */
  completa: 'Tema completa',
  /** `get` da 404; solo `search` devuelve candidatos. */
  soloSearch: 'Tema solo search',
  /** 404 en `get` y lista vacía en `search`. */
  inexistente: 'Tema inexistente',
  /** `get` devuelve un registro instrumental; `search` está vacío. */
  instrumental: 'Tema instrumental',
  /** Un 429 con `Retry-After: 1` la primera vez; después, como `completa`. */
  limiteCorto: 'Tema limite corto',
  /** 429 con `Retry-After: 120` siempre. */
  limiteLargo: 'Tema limite largo',
  /** 500 en todo. */
  servicioRoto: 'Tema servicio roto',
  /** Responde a los 12 s (el cliente lo corta a los 10 s). */
  lenta: 'Tema lenta'
} as const

type Escenario = keyof typeof TITULOS

const ORDEN: Escenario[] = [
  'soloSearch',
  'completa',
  'inexistente',
  'instrumental',
  'limiteCorto',
  'limiteLargo',
  'servicioRoto',
  'lenta'
]

export const RETARDO_LENTA_MS = 12_000

export interface PeticionLrclib {
  ruta: string
  parametros: Record<string, string>
  userAgent: string | undefined
  /** Valor de la cabecera `Cookie`, si llegó (no debe llegar). */
  cookie: string | undefined
  escenario: Escenario | null
  inicio: number
  fin: number | null
  estado: number | null
}

export interface ServidorLrclib {
  /** `http://127.0.0.1:<puerto>`. */
  url: string
  peticiones: PeticionLrclib[]
  /** Máximo de peticiones simultáneas observado (la app debe pedir en serie: 1). */
  maxSimultaneas: number
  /** Vacía el registro y reinicia los contadores (el 429 corto vuelve a darse). */
  reiniciar(): void
  cerrar(): Promise<void>
}

interface RegistroFixture {
  id: number
  trackName: string
  duration: number
  [campo: string]: unknown
}

const fixtures = (): {
  get: RegistroFixture
  search: RegistroFixture[]
  instrumental: RegistroFixture
} => ({
  get: leerFixtureLetraJson<RegistroFixture>('lrclib-get.json'),
  search: leerFixtureLetraJson<RegistroFixture[]>('lrclib-search.json'),
  instrumental: leerFixtureLetraJson<RegistroFixture>('lrclib-instrumental.json')
})

/** Candidatos de la letra, con duraciones relativas a la de la canción (`duration` pedida). */
function candidatos(duracionS: number): {
  linea: RegistroFixture
  palabra: RegistroFixture
  texto: RegistroFixture
} {
  const f = fixtures()
  const por = (id: number): RegistroFixture => f.search.find((r) => r.id === id)!
  return {
    // 9001: por línea, misma duración (la insignia dice "igual").
    linea: { ...f.get, duration: duracionS },
    // 9002: por palabra, 5 s más larga.
    palabra: { ...por(9002), duration: duracionS + 5 },
    // 9003: solo texto, 40 s más corta ("muy distinta").
    texto: { ...por(9003), duration: Math.max(1, duracionS - 40) }
  }
}

function escenarioDe(parametros: Record<string, string>): Escenario | null {
  const titulo = (parametros.track_name ?? parametros.q ?? '').toLowerCase()
  return ORDEN.find((e) => titulo.includes(TITULOS[e].toLowerCase().replace('tema ', ''))) ?? null
}

export async function iniciarServidorLrclib(): Promise<ServidorLrclib> {
  const sockets = new Set<Socket>()
  const temporizadores = new Set<NodeJS.Timeout>()
  let enCurso = 0
  let yaDio429 = false
  // La búsqueda (`search`) no lleva la duración: se reutiliza la del último `get` de la canción.
  let ultimaDuracionS = 215

  const servidor: ServidorLrclib = {
    url: '',
    peticiones: [],
    maxSimultaneas: 0,
    reiniciar() {
      servidor.peticiones.length = 0
      servidor.maxSimultaneas = 0
      yaDio429 = false
      ultimaDuracionS = 215
    },
    cerrar: () =>
      new Promise((resolver) => {
        for (const t of temporizadores) clearTimeout(t)
        for (const s of sockets) s.destroy()
        http.close(() => resolver())
      })
  }

  const json = (
    res: ServerResponse,
    estado: number,
    cuerpo: unknown,
    cab: Record<string, string> = {}
  ): void => {
    res.writeHead(estado, { 'Content-Type': 'application/json', ...cab })
    res.end(JSON.stringify(cuerpo))
  }

  const responder = (
    peticion: PeticionLrclib,
    ruta: string,
    parametros: Record<string, string>,
    res: ServerResponse
  ): void => {
    const e = peticion.escenario
    if (e === 'limiteLargo') return json(res, 429, { message: 'limite' }, { 'Retry-After': '120' })
    if (e === 'limiteCorto' && !yaDio429) {
      yaDio429 = true
      return json(res, 429, { message: 'limite' }, { 'Retry-After': '1' })
    }
    if (e === 'servicioRoto') return json(res, 500, { message: 'caido' })

    if (ruta === '/api/get' && Number(parametros.duration))
      ultimaDuracionS = Number(parametros.duration)
    const duracionS = ultimaDuracionS
    const c = candidatos(duracionS)
    const conLetra = e === 'completa' || e === 'limiteCorto' || e === 'lenta' || e === 'soloSearch'
    const porId = /^\/api\/get\/(\d+)$/.exec(ruta)
    if (porId) {
      const todos = [c.linea, c.palabra, c.texto, fixtures().instrumental]
      const r = todos.find((x) => x.id === Number(porId[1]))
      return r ? json(res, 200, r) : json(res, 404, { message: 'no existe' })
    }
    if (ruta === '/api/get') {
      if (e === 'instrumental')
        return json(res, 200, { ...fixtures().instrumental, duration: duracionS })
      if (conLetra && e !== 'soloSearch') return json(res, 200, c.linea)
      return json(res, 404, { message: 'no existe' })
    }
    if (ruta === '/api/search') {
      // Fuera de orden a propósito: la app debe ordenar palabra > línea > texto.
      return json(res, 200, conLetra ? [c.texto, c.linea, c.palabra] : [])
    }
    return json(res, 404, { message: 'ruta desconocida' })
  }

  const alPeticion = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const parametros = Object.fromEntries(url.searchParams)
    const cookie = req.headers.cookie
    const peticion: PeticionLrclib = {
      ruta: url.pathname,
      parametros,
      userAgent: req.headers['user-agent'],
      cookie: typeof cookie === 'string' ? cookie : undefined,
      escenario: escenarioDe(parametros),
      inicio: Date.now(),
      fin: null,
      estado: null
    }
    servidor.peticiones.push(peticion)
    enCurso++
    servidor.maxSimultaneas = Math.max(servidor.maxSimultaneas, enCurso)
    let contada = true
    const terminar = (): void => {
      if (!contada) return
      contada = false
      enCurso--
      peticion.fin = Date.now()
      peticion.estado = res.statusCode
    }
    res.on('close', terminar)
    const lanzar = (): void => responder(peticion, url.pathname, parametros, res)
    if (peticion.escenario === 'lenta') {
      const t = setTimeout(lanzar, RETARDO_LENTA_MS)
      temporizadores.add(t)
    } else lanzar()
  }

  const http: Server = createServer(alPeticion)
  http.on('connection', (s) => {
    sockets.add(s)
    s.on('close', () => sockets.delete(s))
  })
  await new Promise<void>((resolver) => http.listen(0, '127.0.0.1', resolver))
  servidor.url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`
  return servidor
}
