import { fireEvent, screen, waitFor } from '@testing-library/react'
import { estadoP1, estadoSinCola, pantalla } from '@shared/__fixtures__/sesion'
import { EDI_BLOQUEO, SES } from '../../sesion/textos'
import { montarConSesion } from './montarConSesion'
import { paso, resumenPrueba } from './resumenPrueba'
import { BIB_PREP } from './textosPreparacion'

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

describe('F5-B3: «Lista para revisar» con una sesión en vivo', () => {
  it('«Revisar» muestra el candado de edi.bloqueo y «Probar» queda aria-disabled con su motivo', async () => {
    const revisar = resumenPrueba({
      id: 'r1',
      titulo: 'Semestre de Otoño',
      pasos: {
        fuente: paso('completado'),
        separacion: paso('completado'),
        letra: paso('completado'),
        edicion: paso('pendiente')
      },
      estadoPreparacion: 'lista_para_revisar'
    })
    montarConSesion([revisar], estadoP1(), { pantallas: DOS })
    const boton = await screen.findByRole('button', {
      name: `Revisar «Semestre de Otoño»${EDI_BLOQUEO.aria}`
    })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    const probar = screen.getByRole('button', { name: /^Probar «Semestre de Otoño»/ })
    expect(probar).toHaveAttribute('aria-disabled', 'true')
    expect(probar).toHaveAttribute('title', BIB_PREP.probarSesion)
  })
})
