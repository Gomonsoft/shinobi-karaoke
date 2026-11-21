// Prueba de concepto del ADR 0019 (no es código de producción).
// Ventana offscreen gobernada por índice de fotograma → captura → pipe con contrapresión → PyAV.
//
//   app/node_modules/.bin/electron docs/poc/0019-exportacion/electron/main.js \
//     --ancho 1920 --alto 1080 --fps 30 --segundos 10 --modo captura --perfil av1 --salida /tmp/x.mkv
//
// --modo captura: webContents.capturePage() tras dos requestAnimationFrame.
// --modo paint:   evento `paint` de la ventana offscreen tras invalidate().
// --sin-codificar: descarta los fotogramas (mide solo render + captura).
// Variables: SHINOBI_POC_PYTHON (intérprete del worker).
'use strict'
const { app, BrowserWindow } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { monitorEventLoopDelay, performance } = require('node:perf_hooks')

function arg(nombre, def) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : def
}
const ANCHO = Number(arg('ancho', 1920))
const ALTO = Number(arg('alto', 1080))
const FPS = Number(arg('fps', 30))
const SEGUNDOS = Number(arg('segundos', 10))
const MODO = arg('modo', 'captura')
const PERFIL = arg('perfil', 'av1')
const SALIDA = arg('salida', '/tmp/poc-0019.mkv')
const SIN_CODIFICAR = process.argv.includes('--sin-codificar')
const EN_VUELO = Number(arg('en-vuelo', 0))
const TOTAL = Math.round(SEGUNDOS * FPS)
const RAIZ = path.resolve(__dirname, '..', '..', '..', '..')
const PYTHON = process.env.SHINOBI_POC_PYTHON || path.join(RAIZ, 'worker', '.venv', 'bin', 'python')

app.commandLine.appendSwitch('force-device-scale-factor', '1')

async function principal() {
  const ventana = new BrowserWindow({
    show: false,
    width: ANCHO,
    height: ALTO,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: {
      offscreen: { useSharedTexture: false, deviceScaleFactor: 1 },
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  const wc = ventana.webContents
  wc.setAudioMuted(true)
  wc.setFrameRate(240)
  await ventana.loadFile(path.join(__dirname, 'pagina.html'), process.argv.includes('--movil') ? { search: 'movil=1' } : undefined)
  await wc.executeJavaScript('document.fonts.ready.then(() => true)')

  // Formato de píxel: un fondo rojo puro debe dar B=0 G=0 R=255 A=255 (BGRA) o R,G,B,A (RGBA).
  await wc.executeJavaScript('pintarPrueba()')
  const prueba = await wc.capturePage()
  const tam = prueba.getSize()
  const px = prueba.toBitmap().subarray(0, 4)
  const formato = px[2] === 255 && px[0] === 0 ? 'bgra' : px[0] === 255 ? 'rgba' : `?${[...px]}`
  await wc.executeJavaScript('restaurar()')

  let hijo = null
  let tSalidaHijo = null
  if (!SIN_CODIFICAR) {
    hijo = spawn(
      PYTHON,
      [
        path.join(__dirname, '..', 'codificar.py'),
        '--stdin', '--perfil', PERFIL, '--ancho', String(ANCHO), '--alto', String(ALTO),
        '--fps', String(FPS), '--segundos', String(SEGUNDOS), '--salida', SALIDA
      ],
      { stdio: ['pipe', 'pipe', 'ignore'] }
    )
    tSalidaHijo = new Promise((resolve) => {
      let texto = ''
      hijo.stdout.on('data', (d) => (texto += d))
      hijo.on('exit', (codigo) => resolve({ codigo, texto }))
    })
  }

  // El evento `paint` llega con cada fotograma compuesto; nos quedamos con el último.
  let ultimoPaint = null
  let esperandoPaint = null
  if (MODO === 'paint') {
    wc.on('paint', (_e, _sucio, imagen) => {
      ultimoPaint = imagen
      if (esperandoPaint) {
        const r = esperandoPaint
        esperandoPaint = null
        r(imagen)
      }
    })
  }

  const lag = monitorEventLoopDelay({ resolution: 10 })
  lag.enable()
  const t = { render: 0, captura: 0, bitmap: 0, escritura: 0, drenaje: 0 }
  let bytesMal = 0
  const t0 = performance.now()
  for (let n = 0; n < TOTAL; n++) {
    let a = performance.now()
    await wc.executeJavaScript(`renderizar(${n}, ${FPS})`)
    t.render += performance.now() - a
    a = performance.now()
    let imagen
    if (MODO === 'paint') {
      imagen = await new Promise((r) => {
        esperandoPaint = r
        wc.invalidate()
      })
    } else {
      imagen = await wc.capturePage()
    }
    t.captura += performance.now() - a
    a = performance.now()
    const buf = imagen.toBitmap()
    t.bitmap += performance.now() - a
    if (buf.length !== ANCHO * ALTO * 4) bytesMal++
    if (hijo) {
      a = performance.now()
      const sigue = hijo.stdin.write(buf)
      t.escritura += performance.now() - a
      // --en-vuelo K: contrapresión por bytes pendientes (ADR 0019 §7) en vez de esperar cada drain.
      const limite = EN_VUELO > 0 ? EN_VUELO * ANCHO * ALTO * 4 : 0
      if (EN_VUELO > 0 ? hijo.stdin.writableLength > limite : !sigue) {
        a = performance.now()
        await new Promise((r) => hijo.stdin.once('drain', r))
        t.drenaje += performance.now() - a
      }
    }
  }
  const tBucle = performance.now() - t0
  lag.disable()
  let codificacion = null
  if (hijo) {
    hijo.stdin.end()
    const { codigo, texto } = await tSalidaHijo
    codificacion = codigo === 0 ? JSON.parse(texto.trim().split('\n').pop()) : { codigo }
  }
  const ms = (v) => Math.round((v / TOTAL) * 100) / 100
  const resultado = {
    modo: MODO,
    en_vuelo: EN_VUELO,
    fondo_movil: process.argv.includes('--movil'),
    resolucion: `${ANCHO}x${ALTO}`,
    fps: FPS,
    fotogramas: TOTAL,
    tamano_captura: `${tam.width}x${tam.height}`,
    formato_pixel: formato,
    fotogramas_tamano_incorrecto: bytesMal,
    fps_extremo_a_extremo: Math.round((TOTAL / tBucle) * 1000 * 10) / 10,
    factor_tiempo_real: Math.round((tBucle / 1000 / SEGUNDOS) * 100) / 100,
    ms_por_fotograma: {
      render: ms(t.render),
      captura: ms(t.captura),
      toBitmap: ms(t.bitmap),
      write: ms(t.escritura),
      espera_drain: ms(t.drenaje)
    },
    bucle_main_ms: { p50: lag.percentile(50) / 1e6, p99: lag.percentile(99) / 1e6, max: lag.max / 1e6 },
    pico_rss_main_mb: Math.round(process.memoryUsage().rss / 1e6),
    codificacion
  }
  console.log(JSON.stringify(resultado))
  app.exit(0)
}

app.whenReady().then(principal).catch((e) => {
  console.error(e)
  app.exit(1)
})
