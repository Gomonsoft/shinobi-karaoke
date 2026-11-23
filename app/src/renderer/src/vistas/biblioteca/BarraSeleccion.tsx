import { forwardRef, type KeyboardEvent } from 'react'
import {
  FileMusic,
  Film,
  ListPlus,
  PackageOpen,
  Pencil,
  SquareCheck,
  Trash2,
  WandSparkles
} from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import type { AccionLote } from './acciones/modelo'
import { ACC } from './acciones/textos'
import { SEL } from './textosSeleccion'
import estilos from './biblioteca.module.css'

export interface CuentaAccion {
  /** A cuántas de las seleccionadas aplica. */
  aplican: number
  /** Motivo si no aplica a ninguna (tooltip y `aria-describedby`). */
  motivo?: string
}

interface Props {
  seleccionadas: number
  /** Seleccionadas que no están en la vista actual (`bib.sel.fuera`). */
  fuera: number
  /** Motivo por el que «Aplicar tema…» no está disponible (`aria-disabled` + tooltip). */
  motivoInactivo?: string
  cuentas: Record<AccionLote, CuentaAccion>
  alAccion(accion: AccionLote): void
  alAplicar(): void
  alSeleccionarVisibles(): void
  alQuitar(): void
  alTerminar(): void
}

const ICONOS: Record<Exclude<AccionLote, 'preparar'>, typeof Pencil> = {
  cola: ListPlus,
  exportar: Film,
  paquete: PackageOpen,
  letra: FileMusic,
  datos: Pencil,
  eliminar: Trash2
}

/** «{acción}» o «{acción} ({a} de {n})» (docs/ux/02 · Feature 8, «Recuento en cada acción»). */
const conRecuento = (texto: string, a: number, n: number): string =>
  a === n || a === 0 ? texto : ACC.menu.parte(texto, a, n)

/** Barra del modo selección: fija arriba al desplazar la vista (`position: sticky`). */
export const BarraSeleccion = forwardRef<HTMLButtonElement, Props>(function BarraSeleccion(
  {
    seleccionadas,
    fuera,
    motivoInactivo,
    cuentas,
    alAccion,
    alAplicar,
    alSeleccionarVisibles,
    alQuitar,
    alTerminar
  },
  refAplicar
) {
  const n = seleccionadas
  const motivo = (a: AccionLote): string | undefined =>
    n === 0 ? SEL.ninguna : cuentas[a].aplican === 0 ? cuentas[a].motivo : undefined
  const prep = cuentas.preparar
  const textoPreparar = conRecuento(ACC.preparar, prep.aplican, n)

  const entrada = (a: Exclude<AccionLote, 'preparar'>, base: string): ItemMenu => ({
    id: a,
    etiqueta: conRecuento(base, cuentas[a].aplican, n),
    icono: ICONOS[a],
    noDisponible: motivo(a),
    destructivo: a === 'eliminar',
    separadorAntes: a === 'eliminar',
    alSeleccionar: () => alAccion(a)
  })
  const items: ItemMenu[] = [
    entrada('cola', ACC.menu.cola),
    entrada('exportar', ACC.menu.exportar),
    entrada('paquete', ACC.menu.paquete),
    entrada('letra', ACC.menu.letra),
    entrada('datos', ACC.menu.datos),
    entrada('eliminar', ACC.menu.eliminar)
  ]

  // ←/→ recorren los botones de la barra (`toolbar`).
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (!(e.target instanceof HTMLButtonElement) || e.target.getAttribute('role') === 'menuitem')
      return
    const botones = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([role="menuitem"])')
    )
    const i = botones.indexOf(e.target)
    if (i < 0) return
    e.preventDefault()
    botones[(i + (e.key === 'ArrowRight' ? 1 : botones.length - 1)) % botones.length]?.focus()
  }

  return (
    <div
      className={estilos.barraSeleccion}
      role="toolbar"
      aria-label={ACC.barra}
      onKeyDown={teclas}
    >
      <p className={estilos.contadorSeleccion}>
        <Icono icono={SquareCheck} tamano={16} />
        <span>
          {SEL.contador(n)}
          {fuera > 0 && ` · ${SEL.fuera(fuera)}`}
        </span>
      </p>
      <div className={estilos.accionesLote}>
        <Boton
          noDisponible={n === 0 ? SEL.ninguna : prep.aplican === 0 ? prep.motivo : undefined}
          aria-label={
            prep.aplican < n && prep.aplican > 0 ? ACC.prepararAria(prep.aplican, n) : undefined
          }
          onClick={() => alAccion('preparar')}
        >
          <Icono icono={WandSparkles} tamano={16} />
          {textoPreparar}
        </Boton>
        <Boton
          ref={refAplicar}
          variante="primario"
          noDisponible={motivoInactivo}
          onClick={alAplicar}
        >
          {SEL.aplicarTema}
        </Boton>
        <MenuContextual etiqueta={ACC.mas} textoBoton={ACC.mas} items={items} />
      </div>
      <div className={estilos.accionesSeleccion}>
        <Boton onClick={alSeleccionarVisibles}>{SEL.visibles}</Boton>
        <Boton onClick={alQuitar}>{SEL.quitar}</Boton>
        <Boton onClick={alTerminar}>{SEL.terminar}</Boton>
      </div>
    </div>
  )
})
