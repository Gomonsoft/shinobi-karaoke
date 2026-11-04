import { expect, it } from 'vitest'
import { TITULO_APP } from './titulo'

it('el título de la app es Shinobi Karaoke', () => {
  expect(TITULO_APP).toBe('Shinobi Karaoke')
})
