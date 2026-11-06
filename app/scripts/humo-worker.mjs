import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = fileURLToPath(new URL('../', import.meta.url))
const windows = process.platform === 'win32'
const mac = process.platform === 'darwin'
const bin = process.env.SHINOBI_PAQUETE_BIN
const recursos = resolve(
  process.argv[2] ??
    (bin
      ? join(dirname(bin), mac ? '../Resources' : 'resources')
      : join(
          app,
          'release',
          mac
            ? 'mac-arm64/Shinobi Karaoke.app/Contents/Resources'
            : windows
              ? 'win-unpacked/resources'
              : 'linux-unpacked/resources'
        ))
)
const worker = join(recursos, 'worker')

function comprobarBytecode() {
  const cache = readdirSync(worker, { recursive: true, withFileTypes: true }).find(
    ({ name }) => name === '__pycache__' || name.endsWith('.pyc')
  )
  if (cache)
    throw new Error(`Bytecode en el worker empaquetado: ${join(cache.parentPath, cache.name)}`)
}

try {
  comprobarBytecode()
  const ejecucion = spawnSync(
    join(recursos, 'bin', windows ? 'uv.exe' : 'uv'),
    [
      'run',
      '--no-project',
      '--isolated',
      '--python',
      '3.12',
      'python',
      '-m',
      'shinobi_worker',
      'demo',
      '--args',
      JSON.stringify({ segundos: 1 })
    ],
    {
      cwd: recursos,
      env: { ...process.env, PYTHONPATH: worker, PYTHONDONTWRITEBYTECODE: '1' },
      encoding: 'utf8',
      timeout: 180_000,
      windowsHide: true
    }
  )
  if (ejecucion.stderr) process.stderr.write(ejecucion.stderr)
  if (ejecucion.stdout) process.stdout.write(ejecucion.stdout)
  comprobarBytecode()
  if (ejecucion.error) throw ejecucion.error
  if (ejecucion.status !== 0)
    throw new Error(`uv terminó con código ${ejecucion.status} y señal ${ejecucion.signal}`)
  const eventos = ejecucion.stdout
    .trim()
    .split(/\r?\n/)
    .map((linea) => JSON.parse(linea))
  if (!eventos.some((evento) => evento.tipo === 'resultado' && evento.datos?.segundos === 1)) {
    throw new Error('El worker no emitió el resultado de demo')
  }
} catch (error) {
  console.error('Falló el humo del worker empaquetado:', error)
  process.exitCode = 1
}
