// Instala el runtime real sin Electron y mide la instalación (tarea 0040; ADR 0009).
//
//   SHINOBI_DATOS=<carpeta temporal> node --experimental-transform-types \
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/instalar-runtime.mjs [--perfil auto|cpu|cuda|mps] [--modelo calidad|rapido] \
//     [--salida runtime-real.json]
//
// Tras instalar separa 60 s de audio generado con Calidad en CPU y sin ffmpeg (`separacion`, 0062).
// Mide: duración por fase, tamaños en disco, tráfico de red de motor + componentes (`red_mb`,
// aproximado), pico de disco (espacio libre muestreado cada 1 s) y lo contrasta con el manifiesto
// (tarea 0058; preguntas/0018). `--modelo rapido` prueba la vía con consentimiento (0057).
//
// Reutiliza el gestor de runtime (`src/main/runtime/`) con los puertos reales. Después ejecuta `demo` y
// `diagnostico` con `resolverLanzador` en modo producción. Necesita uv (`SHINOBI_UV` o PATH) y red.
// No es parte de la CI normal: lo lanza `.github/workflows/runtime-real.yml` (solo `workflow_dispatch`).
import { execFile } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

register('./resolver-ts.mjs', import.meta.url)

const ejecutarArchivo = promisify(execFile)
const dirApp = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const { manifiestoSchema } = await import('../src/shared/index.ts')
const { ServicioConfig } = await import('../src/main/configuracion/index.ts')
const { RegistroArchivo } = await import('../src/main/registro/registroApp.ts')
const { crearClienteWorker, resolverLanzador } = await import('../src/main/trabajos/worker.ts')
const rt = await import('../src/main/runtime/index.ts')

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto
}

const perfilPedido = argumento('perfil', 'auto')
const salida = argumento('salida', 'runtime-real.json')
const modeloPedido = argumento('modelo', 'calidad')
if (!['calidad', 'rapido'].includes(modeloPedido)) {
  console.error(`--modelo debe ser calidad o rapido, no ${modeloPedido}`)
  process.exit(2)
}
const datos = resolve(process.env.SHINOBI_DATOS || mkdtempSync(join(tmpdir(), 'shinobi-datos-')))
const plataforma = process.platform
const win = plataforma === 'win32'

// ffmpeg fuera del PATH de todo el script: se quitan las carpetas que lo contienen (ADR 0002/0004:
// el runtime no debe depender de un FFmpeg del sistema).
function quitarFfmpegDelPath(env) {
  const clave = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  const nombres = win ? ['ffmpeg.exe', 'ffmpeg.cmd', 'ffmpeg.bat'] : ['ffmpeg']
  const quitadas = []
  const conservadas = (env[clave] ?? '').split(delimiter).filter((d) => {
    if (d !== '' && nombres.some((n) => existsSync(join(d, n)))) {
      quitadas.push(d)
      return false
    }
    return true
  })
  return { clave, ruta: conservadas.join(delimiter), quitadas }
}
const { clave: clavePath, ruta: pathSinFfmpeg, quitadas } = quitarFfmpegDelPath(process.env)
const env = { ...process.env, [clavePath]: pathSinFfmpeg }

// Bytes recibidos por las interfaces de red (todas salvo loopback); `null` si no se pueden leer.
async function bytesRecibidos() {
  try {
    if (plataforma === 'linux') {
      const lineas = readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
      return sumarRecibidosProcNetDev(lineas)
    }
    if (plataforma === 'darwin') {
      const { stdout } = await ejecutarArchivo('netstat', ['-ib'])
      return sumarRecibidosNetstat(stdout)
    }
    if (win) {
      const { stdout } = await ejecutarArchivo(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          '(Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes -Sum).Sum'
        ],
        { timeout: 30000 }
      )
      const n = Number(stdout.trim())
      return Number.isFinite(n) && stdout.trim() !== '' ? n : null
    }
  } catch {
    // sin contadores: red_mb queda en null
  }
  return null
}
function sumarRecibidosProcNetDev(lineas) {
  let total = 0
  for (const l of lineas) {
    const [nombre, resto] = l.split(':')
    if (resto === undefined || nombre.trim() === 'lo') continue
    total += Number(resto.trim().split(/\s+/)[0]) || 0
  }
  return total
}
// `netstat -ib`: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll. Se cuentan las
// filas `<Link#n>` (una por interfaz) y Ibytes se toma contando desde el final (Address puede faltar).
function sumarRecibidosNetstat(texto) {
  let total = 0
  for (const l of texto.split('\n')) {
    const c = l.trim().split(/\s+/)
    if (c.length < 8 || !c[2]?.startsWith('<Link#') || c[0].startsWith('lo')) continue
    total += Number(c[c.length - 5]) || 0
  }
  return total
}

// Pico de memoria (MB) del proceso del worker: muestrea cada 2 s el mayor RSS entre los procesos cuya
// línea de comandos contiene `shinobi_worker` (el mayor y no la suma: evita contar dos veces el
// redirector de python.exe en Windows). `null` si no se pudo leer.
function medirPicoRss() {
  let pico = null
  let ocupado = false
  const leer = async () => {
    if (ocupado) return
    ocupado = true
    try {
      let rssKb = []
      if (win) {
        const { stdout } = await ejecutarArchivo(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            'Get-CimInstance Win32_Process -Filter "CommandLine like \'%shinobi_worker%\'" | ForEach-Object { [math]::Floor($_.WorkingSetSize / 1024) }'
          ],
          { timeout: 30000 }
        )
        rssKb = stdout.split(/\s+/).map(Number)
      } else {
        const { stdout } = await ejecutarArchivo('ps', ['-axo', 'rss=,command='])
        rssKb = stdout
          .split('\n')
          .filter((l) => l.includes('shinobi_worker') && !l.includes(' ps '))
          .map((l) => Number(l.trim().split(/\s+/)[0]))
      }
      const maximo = Math.max(0, ...rssKb.filter((n) => Number.isFinite(n)))
      if (maximo > 0) pico = Math.max(pico ?? 0, maximo)
    } catch {
      // sin lectura: el pico queda en null
    } finally {
      ocupado = false
    }
  }
  const t = setInterval(leer, 2000)
  return {
    async parar() {
      clearInterval(t)
      await leer()
      return pico === null ? null : Math.round((pico / 1024) * 10) / 10
    }
  }
}

// Audio de prueba generado (nada de terceros): acordes con vibrato y ruido suave, FLAC 16 bits,
// 44,1 kHz, estéreo. Se escribe con el Python del venv (soundfile y numpy están en el runtime).
const SEGUNDOS_SEPARACION = 60
async function generarAudio(python, destino, segundos) {
  const codigo = [
    'import sys, numpy as np, soundfile as sf',
    'fs, n = 44100, int(float(sys.argv[2]) * 44100)',
    't = np.arange(n, dtype=np.float64) / fs',
    'rng = np.random.default_rng(1)',
    'canales = []',
    'for c in range(2):',
    '    x = np.zeros(n)',
    '    for k, hz in enumerate((220.0, 277.18, 329.63, 440.0)):',
    '        x += np.sin(2 * np.pi * hz * (1 + 0.003 * c) * t + 3 * np.sin(2 * np.pi * (4 + k) * t)) / (k + 2)',
    '    x = 0.3 * x * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * t)) + 0.01 * rng.standard_normal(n)',
    '    canales.append(x)',
    "sf.write(sys.argv[1], np.stack(canales, axis=1), fs, format='FLAC', subtype='PCM_16')"
  ].join('\n')
  await ejecutarArchivo(python, ['-c', codigo, destino, String(segundos)], { env, timeout: 120000 })
}

async function separarSesentaSegundos(cliente, python) {
  const dir = mkdtempSync(join(datos, 'separacion-'))
  const entrada = join(dir, 'mezcla.flac')
  const salidaDir = join(dir, 'pistas')
  mkdirSync(salidaDir)
  await generarAudio(python, entrada, SEGUNDOS_SEPARACION)
  const modelo = manifiesto.modelos.find((m) => m.id === 'calidad')
  const medidorRss = medirPicoRss()
  const inicio = Date.now()
  let datosSeparar
  let picoRss = null
  try {
    datosSeparar = await cliente.ejecutar('separar', {
      entrada,
      salida_dir: salidaDir,
      modelo: { id: 'calidad', archivo: modelo.archivo, dir: join(datos, 'modelos') },
      dispositivo: 'cpu',
      bloques: 'normal'
    })
  } finally {
    picoRss = await medidorRss.parar()
  }
  const segundos = Math.round((Date.now() - inicio) / 100) / 10
  const pistas = {}
  for (const nombre of ['voz', 'instrumental']) {
    const ruta = join(salidaDir, `${nombre}.flac`)
    if (!existsSync(ruta)) throw new Error(`Falta la pista ${nombre}.flac`)
    const cab = readFileSync(ruta).subarray(0, 64)
    // FLAC: "fLaC" + bloque STREAMINFO; bits por muestra = 5 bits tras 20 (frecuencia) + 3 (canales).
    if (cab.subarray(0, 4).toString('latin1') !== 'fLaC')
      throw new Error(`${nombre}.flac no es FLAC`)
    const bits = (((cab[20] & 1) << 4) | (cab[21] >> 4)) + 1
    if (bits !== 16) throw new Error(`${nombre}.flac es de ${bits} bits, no de 16`)
    pistas[nombre] = statSync(ruta).size
  }
  return {
    segundos,
    factor: Math.round((segundos / SEGUNDOS_SEPARACION) * 100) / 100,
    pico_rss_mb: picoRss,
    voz_bytes: pistas.voz,
    instrumental_bytes: pistas.instrumental,
    segundos_separando: datosSeparar.segundos_separando ?? null,
    estimacion_manifiesto: manifiesto.estimacion.cpu.calidad
  }
}

const espacio = rt.crearEspacioLibre()
const medidor = rt.medidorReal
const mb = (b) => (b === null ? null : Math.round((b / 1e6) * 10) / 10)

const registro = new RegistroArchivo(join(datos, 'registros'))
const config = await ServicioConfig.abrir(datos, { registro })
// El modelo es siempre Calidad (también en CPU). `--modelo rapido` escribe el consentimiento como
// lo haría la interfaz (0057) y fija el modo Rápido.
if (modeloPedido === 'rapido') {
  await config.actualizar({
    separacion: { modo: 'rapido', rapido_aceptado: new Date().toISOString() }
  })
}
const manifiesto = manifiestoSchema.parse(
  JSON.parse(await readFile(join(dirApp, 'resources', 'runtime-manifest.json'), 'utf8'))
)
const rutas = rt.rutasRecursosRuntime({ empaquetada: false, dirRecursos: '', dirApp })
const deteccion = rt.crearServicioDeteccion(
  {
    manifiesto,
    rutaDatos: datos,
    detectorGpu: rt.crearDetectorGpu(),
    espacio,
    entorno: rt.entornoReal(false)
  },
  config
)
const dirRuntime = join(datos, 'runtime')

// Mide la caché de uv (descomprimida) y el tráfico de red justo antes de `uv cache clean`: en ese
// punto terminaron las fases motor y componentes (el modelo se descarga después).
const ejecutorReal = rt.crearEjecutorUv({
  uv: rt.resolverUv({ empaquetada: false, dirRecursos: '', plataforma, env }),
  dirRegistros: join(datos, 'registros'),
  plataforma
})
let bytesCacheUv = null
let recibidosInicio = null
let recibidosTrasComponentes = null
const ejecutorUv = {
  async ejecutar(args, opciones) {
    if (args.includes('cache') && args.includes('clean')) {
      recibidosTrasComponentes = await bytesRecibidos()
      bytesCacheUv = await medidor.bytes(join(dirRuntime, 'cache-uv'))
    }
    return ejecutorReal.ejecutar(args, opciones)
  }
}

const gestor = rt.crearGestorRuntime({
  datos,
  manifiesto,
  config,
  deteccion,
  ejecutorUv,
  diagnosticador: rt.diagnosticadorReal,
  descargador: rt.descargadorModelosReal,
  medidor,
  espacio,
  raizRecursos: rutas.raizRecursos,
  rutaCodigoWorker: rutas.rutaCodigoWorker,
  registro,
  envBase: env,
  plataformaSO: plataforma
})

// Duración por fase visible, a partir de los cambios de estado del progreso.
const t0 = Date.now()
const inicioFase = {}
const duracionFaseS = {}
gestor.suscribir((p) => {
  for (const f of rt.FASES_VISIBLES) {
    if (p.estados[f] === 'en_curso' && inicioFase[f] === undefined) inicioFase[f] = Date.now()
    if (p.estados[f] === 'completada' && inicioFase[f] !== undefined && !(f in duracionFaseS)) {
      duracionFaseS[f] = Math.round((Date.now() - inicioFase[f]) / 100) / 10
    }
  }
})

const libreAntes = await espacio.bytesLibres(datos)
console.log(`Datos: ${datos}`)
console.log(`Carpetas quitadas del PATH por contener ffmpeg: ${quitadas.join(', ') || '(ninguna)'}`)

const resultado = {
  plataforma,
  arquitectura: process.arch,
  perfil_pedido: perfilPedido,
  node: process.version,
  uv: null,
  ffmpeg_en_path: { carpetas_quitadas: quitadas, salida: null },
  modelo_pedido: modeloPedido,
  espacio_libre_mb: { antes: mb(libreAntes), minimo: null, despues: null },
  pico_mb: null,
  red_mb: null,
  manifiesto: null,
  instalacion: null,
  mb_descargados: null,
  disco_mb: null,
  duracion_s: { por_fase: duracionFaseS, total: null },
  versiones: {},
  demo: null,
  diagnostico: null,
  separacion: null,
  errores: []
}

async function ejecutarYCapturar(args) {
  const r = await ejecutarArchivo(args[0], args.slice(1), { env, timeout: 60000 }).catch((e) => e)
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
}

// Pico de disco: espacio libre del volumen de SHINOBI_DATOS cada 1 s durante toda la instalación.
let libreMinimo = libreAntes
let muestreando = false
const muestrear = async () => {
  if (muestreando) return
  muestreando = true
  try {
    libreMinimo = Math.min(libreMinimo, await espacio.bytesLibres(datos))
  } catch {
    // una muestra perdida no invalida la medición
  } finally {
    muestreando = false
  }
}
const temporizador = setInterval(muestrear, 1000)

try {
  recibidosInicio = await bytesRecibidos()
  resultado.uv = await ejecutarYCapturar([
    rt.resolverUv({ empaquetada: false, dirRecursos: '', plataforma, env }),
    '--version'
  ])
  const inst = await gestor.instalar()
  resultado.duracion_s.total = Math.round((Date.now() - t0) / 100) / 10
  resultado.instalacion = inst
  if (inst.estado !== 'completa')
    throw new Error(`Instalación no completa: ${JSON.stringify(inst)}`)

  const cfg = config.obtener()
  resultado.perfil = cfg.instalacion.perfil_hardware
  resultado.motivo_rebaja = cfg.instalacion.motivo_rebaja
  resultado.modelos_descargados = cfg.separacion.modelos_descargados
  if (perfilPedido !== 'auto' && perfilPedido !== resultado.perfil) {
    throw new Error(`Perfil pedido ${perfilPedido} pero el equipo resolvió ${resultado.perfil}`)
  }

  clearInterval(temporizador)
  await muestrear()

  // Tráfico de red de motor + componentes (incluye el Python gestionado por uv; aproximado).
  if (recibidosInicio !== null && recibidosTrasComponentes !== null) {
    resultado.red_mb = mb(recibidosTrasComponentes - recibidosInicio)
  }

  // Tamaños. `cache_uv_descomprimida` NO son bytes de red (las ruedas están descomprimidas).
  const bytesModelos = await medidor.bytes(join(datos, 'modelos'))
  const bytesVenv = await medidor.bytes(join(dirRuntime, 'venv'))
  const bytesPython = await medidor.bytes(join(dirRuntime, 'python'))
  resultado.mb_descargados = {
    cache_uv_descomprimida: mb(bytesCacheUv),
    modelos: mb(bytesModelos),
    total: bytesCacheUv === null ? null : mb(bytesCacheUv + bytesModelos)
  }
  const entrada = manifiesto.runtime[`${plataforma}-${process.arch}`]?.[resultado.perfil]
  if (entrada) {
    const python = manifiesto.python.bytes_descarga[`${plataforma}-${process.arch}`] ?? 0
    const pct = (red) =>
      red === null || !entrada.bytes_descarga
        ? null
        : Math.round(((red * 1e6 - entrada.bytes_descarga) / entrada.bytes_descarga) * 1000) / 10
    resultado.manifiesto = {
      bytes_descarga_mb: mb(entrada.bytes_descarga),
      python_mb: mb(python),
      espacio_requerido_mb: mb(entrada.espacio_requerido),
      // Diferencia de red_mb con la suma de ruedas (con y sin el Python de uv): criterio ±10 %.
      red_vs_ruedas_pct: pct(resultado.red_mb),
      red_sin_python_vs_ruedas_pct: pct(
        resultado.red_mb === null ? null : resultado.red_mb - python / 1e6
      )
    }
  }
  resultado.disco_mb = {
    venv: mb(bytesVenv),
    runtime_python: mb(bytesPython),
    modelos: mb(bytesModelos),
    cache_uv_tras_limpiar: mb(await medidor.bytes(join(dirRuntime, 'cache-uv'))),
    datos_total: mb(await medidor.bytes(datos))
  }
  resultado.espacio_libre_mb.despues = mb(await espacio.bytesLibres(datos))
  resultado.espacio_libre_mb.minimo = mb(libreMinimo)
  resultado.pico_mb = mb(libreAntes - libreMinimo)
  // Criterio de la pregunta 0018: pico + 0,5 GB <= espacio_requerido del perfil.
  if (entrada && resultado.pico_mb + 500 > entrada.espacio_requerido / 1e6) {
    resultado.errores.push(
      `Pico de disco ${resultado.pico_mb} MB + 500 MB > espacio_requerido ` +
        `${entrada.espacio_requerido / 1e6} MB del perfil ${resultado.perfil}: ` +
        'abrir pregunta para el arquitecto'
    )
  }

  // Lanzador de producción: el mismo que usa la app instalada.
  const lanzador = resolverLanzador({
    modo: 'produccion',
    datos,
    plataforma,
    rutaCodigoWorker: rutas.rutaCodigoWorker,
    envBase: env
  })
  const cliente = crearClienteWorker({
    lanzador,
    dirRegistros: join(datos, 'registros'),
    plataforma
  })
  resultado.demo = await cliente.ejecutar('demo', { segundos: 1 })
  resultado.diagnostico = await cliente.ejecutar('diagnostico', {
    perfil_previsto: resultado.perfil
  })

  // Separación real de extremo a extremo (tarea 0062; cubre el "primer factor x86" de la 0058): 60 s
  // de audio generado, Calidad en CPU y sin ffmpeg en el PATH (`env` ya lo quitó).
  const python = lanzador.comando
  try {
    resultado.separacion = await separarSesentaSegundos(cliente, python)
  } catch (e) {
    resultado.errores.push(`Separación real: ${String(e?.stack ?? e)}`)
    if (e?.detalles) resultado.errores.push(String(e.detalles))
  }

  // Versiones instaladas, con el intérprete del venv.
  const codigo = [
    'import importlib.metadata as m, json',
    'def v(n):',
    '    try: return m.version(n)',
    '    except m.PackageNotFoundError: return None',
    "print(json.dumps({n: v(n) for n in ['torch', 'onnxruntime', 'audio-separator', 'yt-dlp', 'av']}))"
  ].join('\n')
  const v = await ejecutarYCapturar([python, '-c', codigo])
  try {
    resultado.versiones = JSON.parse(v.split('\n').pop())
  } catch {
    resultado.errores.push(`No se pudieron leer las versiones: ${v.slice(-300)}`)
  }

  // `where`/`which ffmpeg` con el PATH sin ffmpeg: debe salir vacío.
  const buscador = win ? 'where' : 'which'
  const f = await ejecutarArchivo(buscador, ['ffmpeg'], { env }).catch(() => ({ stdout: '' }))
  resultado.ffmpeg_en_path.salida = String(f.stdout ?? '').trim()
  if (resultado.ffmpeg_en_path.salida !== '') {
    resultado.errores.push(`${buscador} ffmpeg no está vacío: ${resultado.ffmpeg_en_path.salida}`)
  }
} catch (e) {
  resultado.errores.push(String(e?.stack ?? e))
  if (e?.detalles) resultado.errores.push(String(e.detalles))
}

clearInterval(temporizador)
resultado.espacio_libre_mb.despues ??= mb(await espacio.bytesLibres(datos).catch(() => null))
resultado.ok = resultado.errores.length === 0 && resultado.instalacion?.estado === 'completa'
writeFileSync(salida, JSON.stringify(resultado, null, 2) + '\n')
console.log(JSON.stringify(resultado, null, 2))
console.log(
  `Resultado guardado en ${resolve(salida)} (carpetas de datos: ${readdirSync(datos).join(', ')})`
)
process.exit(resultado.ok ? 0 : 1)
