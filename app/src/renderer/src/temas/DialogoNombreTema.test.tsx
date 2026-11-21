import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DialogoNombreTema, nombreRepetido, proponerNombre } from './DialogoNombreTema'

const existentes = [
  { id: '1', nombre: 'Noche Ninja' },
  { id: '2', nombre: 'Noche ninja (copia)' },
  { id: '3', nombre: 'Canción' }
]

function abrir(
  extra: Partial<Parameters<typeof DialogoNombreTema>[0]> = {},
  onConfirmar = vi.fn().mockResolvedValue(undefined)
) {
  const onCancelar = vi.fn()
  render(
    <DialogoNombreTema
      abierto
      modo="nuevo"
      propuesta="Tema nuevo"
      existentes={existentes}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
      {...extra}
    />
  )
  return { onCancelar, onConfirmar }
}

describe('identidad del nombre', () => {
  it('«noche ninja» repite «Noche Ninja»; «Cancion» no repite «Canción»', () => {
    expect(nombreRepetido('noche ninja', existentes)).toBe(true)
    expect(nombreRepetido('  NOCHE   ninja ', existentes)).toBe(true)
    expect(nombreRepetido('Cancion', existentes)).toBe(false)
    expect(nombreRepetido('Noche Ninja', existentes, '1')).toBe(false)
  })

  it('propone «Noche ninja (copia) 2» si la copia ya existe', () => {
    expect(proponerNombre('Noche ninja (copia)', existentes)).toBe('Noche ninja (copia) 2')
    expect(proponerNombre('Otra', existentes)).toBe('Otra')
    expect(
      proponerNombre('Noche ninja (copia)', [
        ...existentes,
        { id: '9', nombre: 'Noche ninja (copia) 2' }
      ])
    ).toBe('Noche ninja (copia) 3')
  })
})

describe('DialogoNombreTema', () => {
  it('preselecciona la propuesta y tiene el foco en el campo', () => {
    abrir({ propuesta: 'Noche ninja (copia)', modo: 'duplicar' })
    const campo = screen.getByRole('textbox', { name: 'Nombre del tema' }) as HTMLInputElement
    expect(campo.value).toBe('Noche ninja (copia) 2')
    expect(campo).toHaveFocus()
    expect(campo.selectionStart).toBe(0)
    expect(campo.selectionEnd).toBe(campo.value.length)
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeVisible()
  })

  it('rechaza vacío y repetido, con validación en vivo tras el primer intento', async () => {
    const { onConfirmar } = abrir()
    const campo = screen.getByRole('textbox')
    fireEvent.change(campo, { target: { value: '   ' } })
    expect(screen.queryByText('Escribe un nombre.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Crear tema' }))
    expect(await screen.findByText('Escribe un nombre.')).toBeVisible()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(campo, { target: { value: 'noche ninja' } })
    expect(screen.getByText('Ya tienes un tema con ese nombre.')).toBeVisible()
    fireEvent.change(campo, { target: { value: 'Cancion' } })
    expect(screen.queryByText(/Ya tienes|Escribe/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Crear tema' }))
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith('Cancion'))
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('Intro confirma', async () => {
    const { onConfirmar } = abrir()
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith('Tema nuevo'))
  })

  it('TEMA_NOMBRE_DUPLICADO del servidor: error en el campo, foco y selección', async () => {
    const onConfirmar = vi.fn().mockRejectedValue({ codigo: 'TEMA_NOMBRE_DUPLICADO', mensaje: 'x' })
    abrir({}, onConfirmar)
    fireEvent.click(screen.getByRole('button', { name: 'Crear tema' }))
    expect(await screen.findByText('Ya tienes un tema con ese nombre.')).toBeVisible()
    const campo = screen.getByRole('textbox') as HTMLInputElement
    expect(campo).toHaveFocus()
    expect(campo.selectionEnd).toBe(campo.value.length)
  })

  it('contador desde 50 caracteres y maxlength 60', () => {
    abrir()
    const campo = screen.getByRole('textbox')
    expect(campo).toHaveAttribute('maxlength', '60')
    expect(screen.queryByText(/ \/ 60/)).toBeNull()
    fireEvent.change(campo, { target: { value: 'a'.repeat(52) } })
    expect(screen.getByText('52 / 60')).toBeVisible()
  })

  it('renombrar sin cambios cierra sin escribir', async () => {
    const { onCancelar, onConfirmar } = abrir({
      modo: 'renombrar',
      propuesta: 'Noche Ninja',
      excluirId: '1'
    })
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    await waitFor(() => expect(onCancelar).toHaveBeenCalled())
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('otros errores van a onError y el diálogo sigue abierto', async () => {
    const onError = vi.fn()
    const err = { codigo: 'ERROR_INTERNO', mensaje: 'x' }
    abrir({ onError }, vi.fn().mockRejectedValue(err))
    fireEvent.click(screen.getByRole('button', { name: 'Crear tema' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith(err))
    expect(screen.getByRole('dialog')).toBeVisible()
  })
})
