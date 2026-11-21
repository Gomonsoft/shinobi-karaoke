import { fireEvent, screen, waitFor } from '@testing-library/react'
import { estadoP1, estadoSinCola, pantalla } from '@shared/__fixtures__/sesion'
import { SES } from '../../sesion/textos'
import { montarConSesion } from './montarConSesion'
import { resumenPrueba } from './resumenPrueba'

const lista = resumenPrueba({ id: 'a', titulo: 'Bohemian Rhapsody', estado: 'lista' })
const DOS = { pantallas: [pantalla(1), pantalla(2)], colocacion: 'libre' as const }

describe('cabecera de la Biblioteca (0184)', () => {
  it('«Abrir en otra pantalla…» abre el diálogo de pantallas', async () => {
    montarConSesion([lista], estadoSinCola(), { pantallas: DOS })
    fireEvent.click(await screen.findByRole('button', { name: SES.abrirAria }))
    expect(await screen.findByRole('dialog', { name: SES.dialogoTitulo })).toBeInTheDocument()
  })

  it('durante la sesión el botón no está', async () => {
    montarConSesion([lista], estadoP1(), { pantallas: DOS })
    await screen.findAllByText('Bohemian Rhapsody')
    await waitFor(() => expect(screen.queryByRole('button', { name: SES.abrirAria })).toBeNull())
  })

  it('con la biblioteca vacía no hay cabecera de sesión', async () => {
    montarConSesion([], estadoSinCola(), { pantallas: DOS })
    await screen.findByText('Tu biblioteca está vacía')
    expect(screen.queryByRole('button', { name: SES.abrirAria })).toBeNull()
  })
})
