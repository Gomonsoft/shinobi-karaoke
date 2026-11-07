import { createRequire } from 'node:module'
import { resolve } from 'node:path'

/** Electron instala su binario al primer require; hacerlo antes de iniciar los workers. */
export default function prepararElectron(): void {
  createRequire(resolve(__dirname, '../package.json'))('electron')
}
