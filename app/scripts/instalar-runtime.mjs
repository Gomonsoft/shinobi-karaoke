// Instala el runtime real sin Electron y mide la instalación (tarea 0040; ADR 0009).
//
//   SHINOBI_DATOS=<carpeta temporal> node --experimental-transform-types \
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/instalar-runtime.mjs [--perfil auto|cpu|cuda|mps] [--salida runtime-real.json]
//
// Reutiliza el gestor de runtime (`src/main/runtime/`) con los puertos reales. Después ejecuta `demo` y
// `diagnostico` con `resolverLanzador` en modo producción. Necesita uv (`SHINOBI_UV` o PATH) y red.
// No es parte de la CI normal: lo lanza `.github/workflows/runtime-real.yml` (solo `workflow_dispatch`).
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
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

const espacio = rt.crearEspacioLibre()
const medidor = rt.medidorReal
const mb = (b) => (b === null ? null : Math.round((b / 1e6) * 10) / 10)

const registro = new RegistroArchivo(join(datos, 'registros'))
const config = await ServicioConfig.abrir(datos, { registro })
// Modo Rápido (el perfil `cpu` ya lo implica; ver `modeloDelPerfil`).
await config.actualizar({ separacion: { modo: 'rapido' } })

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

// Mide la caché de uv justo antes de `uv cache clean` (bytes descargados por uv).
const ejecutorReal = rt.crearEjecutorUv({
  uv: rt.resolverUv({ empaquetada: false, dirRecursos: '', plataforma, env }),
  dirRegistros: join(datos, 'registros'),
  plataforma
})
let bytesCacheUv = null
const ejecutorUv = {
  async ejecutar(args, opciones) {
    if (args.includes('cache') && args.includes('clean')) {
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
  espacio_libre_mb: { antes: mb(libreAntes), despues: null },
  instalacion: null,
  mb_descargados: null,
  disco_mb: null,
  duracion_s: { por_fase: duracionFaseS, total: null },
  versiones: {},
  demo: null,
  diagnostico: null,
  errores: []
}

async function ejecutarYCapturar(args) {
  const r = await ejecutarArchivo(args[0], args.slice(1), { env, timeout: 60000 }).catch((e) => e)
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
}

try {
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

  // Tamaños. Descarga = caché de uv antes de limpiarla + modelo(s) (+ Python gestionado por uv, aparte).
  const bytesModelos = await medidor.bytes(join(datos, 'modelos'))
  const bytesVenv = await medidor.bytes(join(dirRuntime, 'venv'))
  const bytesPython = await medidor.bytes(join(dirRuntime, 'python'))
  resultado.mb_descargados = {
    cache_uv: mb(bytesCacheUv),
    modelos: mb(bytesModelos),
    total: bytesCacheUv === null ? null : mb(bytesCacheUv + bytesModelos)
  }
  resultado.disco_mb = {
    venv: mb(bytesVenv),
    runtime_python: mb(bytesPython),
    modelos: mb(bytesModelos),
    cache_uv_tras_limpiar: mb(await medidor.bytes(join(dirRuntime, 'cache-uv'))),
    datos_total: mb(await medidor.bytes(datos))
  }
  resultado.espacio_libre_mb.despues = mb(await espacio.bytesLibres(datos))

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

  // Versiones instaladas, con el intérprete del venv.
  const python = lanzador.comando
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

resultado.espacio_libre_mb.despues ??= mb(await espacio.bytesLibres(datos).catch(() => null))
resultado.ok = resultado.errores.length === 0 && resultado.instalacion?.estado === 'completa'
writeFileSync(salida, JSON.stringify(resultado, null, 2) + '\n')
console.log(JSON.stringify(resultado, null, 2))
console.log(
  `Resultado guardado en ${resolve(salida)} (carpetas de datos: ${readdirSync(datos).join(', ')})`
)
process.exit(resultado.ok ? 0 : 1)
