import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ESPERA_LEGADA } from '@shared/espera'
import { linea } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { generarPicos } from '@shared/__fixtures__/picos'
import { detectarVoz, proponerAjusteSilencios } from '@shared/silencios'
import { DialogoAjustarSilencios } from './DialogoAjustarSilencios'
import type { PropuestaAbierta } from './useAjustarSilencios'

const DUR = 15000
const letraAntes: Letra = {
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas: [
    { ...linea('a', 'Primera línea', 1000), fin_ms: 2000 },
    linea('b', 'Segunda', 3700),
    linea('c', 'Tercera', 11000)
  ]
}

function abierta(espera = { ...ESPERA_LEGADA }): PropuestaAbierta {
  const voz = detectarVoz(
    generarPicos({
      duracionMs: DUR,
      tramos: [
        { desdeMs: 1000, hastaMs: 3200, dbfs: -6 },
        { desdeMs: 3700, hastaMs: 6000, dbfs: -6 },
        { desdeMs: 11000, hastaMs: 13000, dbfs: -6 }
      ]
    })
  )
  return {
    propuesta: proponerAjusteSilencios(letraAntes, voz, { duracionMs: DUR, espera }),
    letraAntes,
    espera,
    obsoleto: false
  }
}

function montar(a = abierta()) {
  const alConfirmar = vi.fn()
  const alCancelar = vi.fn()
  render(
    <DialogoAjustarSilencios
      abierta={a}
      duracionMs={DUR}
      mac={false}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    />
  )
  return { alConfirmar, alCancelar }
}

describe('DialogoAjustarSilencios', () => {
  it('muestra los recuentos, enfoca confirmar y Esc cancela', () => {
    const { alCancelar } = montar()
    const dialogo = screen.getByRole('dialog', { name: '¿Ajustar los silencios?' })
    expect(within(dialogo).getByText('Cambiará el fin de 3 de 3 líneas.')).toBeTruthy()
    expect(within(dialogo).getByText(/1 de ellas tenía un fin fijado/)).toBeTruthy()
    expect(within(dialogo).getByText(/Quedará 1 silencio de 4,0 s o más. Se activará/)).toBeTruthy()
    expect(within(dialogo).getByText('Puedes deshacerlo de una vez con Ctrl+Z.')).toBeTruthy()
    expect(document.activeElement).toBe(
      within(dialogo).getByRole('button', { name: 'Ajustar los silencios' })
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCancelar).toHaveBeenCalledOnce()
  })

  it('omite lo que no aplica y cita la cuenta que ya estaba activa', () => {
    const a = abierta({ ...ESPERA_LEGADA, cuenta: true })
    a.letraAntes = { ...letraAntes, lineas: letraAntes.lineas.map((l) => ({ ...l, fin_ms: null })) }
    a.propuesta = { ...a.propuesta, finesFijadosCambiados: 0 }
    montar(a)
    expect(screen.queryByText(/fin fijado/)).toBeNull()
    expect(screen.getByText(/con la cuenta 3·2·1 que ya tiene esta canción/)).toBeTruthy()
  })

  it('la lista revelada muestra exactamente las líneas de cambios', () => {
    montar()
    const boton = screen.getByRole('button', { name: 'Ver las líneas' })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    const filas = within(
      document.getElementById(boton.getAttribute('aria-controls')!)!
    ).getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[0]!.textContent).toBe('Línea 1 · «Primera línea» 00:02.00 → 00:03.30 · fijado')
    expect(filas[1]!.textContent).toContain('silencio largo')
  })

  it('el aviso de obsoleto es un alert', () => {
    montar({ ...abierta(), obsoleto: true })
    expect(screen.getByRole('alert').textContent).toMatch(/Los tiempos cambiaron/)
  })
})
