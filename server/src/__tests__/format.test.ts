import { formatFullName } from '../lib/format'

describe('formatFullName', () => {
  it('concatena nombre y apellido cuando ambos existen', () => {
    expect(formatFullName('Juan', 'Pérez')).toBe('Juan Pérez')
  })

  it('devuelve solo el nombre cuando el apellido es una cadena vacía (empresa/gobierno)', () => {
    expect(formatFullName('Constructora ABC, C.A.', '')).toBe('Constructora ABC, C.A.')
  })

  it('devuelve solo el nombre cuando el apellido es null', () => {
    expect(formatFullName('Constructora ABC, C.A.', null)).toBe('Constructora ABC, C.A.')
  })

  it('devuelve solo el nombre cuando el apellido es undefined', () => {
    expect(formatFullName('Constructora ABC, C.A.')).toBe('Constructora ABC, C.A.')
  })
})
