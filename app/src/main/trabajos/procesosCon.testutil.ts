import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'

/**
 * Cuenta los procesos vivos cuya línea de comandos contiene `texto`.
 * POSIX: `pgrep -f`. Windows: PowerShell (CIM), solo procesos `python*`/`uv*`;
 * se busca por el nombre del archivo porque en los argumentos JSON las barras
 * invertidas de la ruta van escapadas.
 */
export function procesosCon(texto: string): number {
  if (process.platform === 'win32') {
    const guion =
      '$p = $env:SHINOBI_PATRON; ' +
      "@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -match '^(python|uv)' -and $_.CommandLine -and $_.CommandLine.Contains($p) }).Count"
    try {
      const salida = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', guion],
        {
          encoding: 'utf8',
          windowsHide: true,
          env: { ...process.env, SHINOBI_PATRON: basename(texto) }
        }
      )
      return Number.parseInt(salida.trim(), 10) || 0
    } catch {
      return 0
    }
  }
  try {
    return execFileSync('pgrep', ['-f', texto], { encoding: 'utf8' }).split('\n').filter(Boolean)
      .length // pgrep sale con 1 si no hay coincidencias
  } catch {
    return 0
  }
}
