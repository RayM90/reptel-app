import { isValidVenezuelanPhone, isValidVenezuelanIdNumber, isValidStaffIdNumber } from '../lib/venezuela'

describe('isValidVenezuelanPhone', () => {
  it.each(['0412', '0414', '0416', '0424', '0426'])('acepta el prefijo %s + 7 dígitos', (prefix) => {
    expect(isValidVenezuelanPhone(`${prefix}1234567`)).toBe(true)
  })

  it('rechaza un prefijo que no es de operadora móvil', () => {
    expect(isValidVenezuelanPhone('02121234567')).toBe(false)
  })

  it('rechaza menos de 11 dígitos', () => {
    expect(isValidVenezuelanPhone('0412123456')).toBe(false)
  })

  it('rechaza más de 11 dígitos', () => {
    expect(isValidVenezuelanPhone('041212345678')).toBe(false)
  })

  it('rechaza caracteres no numéricos', () => {
    expect(isValidVenezuelanPhone('0412-123456')).toBe(false)
  })
})

describe('isValidVenezuelanIdNumber', () => {
  it('acepta V- con 7 dígitos', () => {
    expect(isValidVenezuelanIdNumber('V-1234567')).toBe(true)
  })

  it('acepta E- con 8 dígitos', () => {
    expect(isValidVenezuelanIdNumber('E-12345678')).toBe(true)
  })

  it('acepta J- y G- (jurídico/gobierno) con 9 dígitos', () => {
    expect(isValidVenezuelanIdNumber('J-123456789')).toBe(true)
    expect(isValidVenezuelanIdNumber('G-123456789')).toBe(true)
  })

  it('rechaza sin prefijo V/E/J/G', () => {
    expect(isValidVenezuelanIdNumber('12345678')).toBe(false)
  })

  it('rechaza menos de 7 dígitos', () => {
    expect(isValidVenezuelanIdNumber('V-123456')).toBe(false)
  })

  it('rechaza más de 9 dígitos', () => {
    expect(isValidVenezuelanIdNumber('V-1234567890')).toBe(false)
  })
})

describe('isValidStaffIdNumber', () => {
  it('acepta V- con 7 dígitos', () => {
    expect(isValidStaffIdNumber('V-1234567')).toBe(true)
  })

  it('acepta E- con 8 dígitos', () => {
    expect(isValidStaffIdNumber('E-12345678')).toBe(true)
  })

  it('rechaza J- (persona jurídica, no aplica a personal)', () => {
    expect(isValidStaffIdNumber('J-12345678')).toBe(false)
  })

  it('rechaza G- (gobierno, no aplica a personal)', () => {
    expect(isValidStaffIdNumber('G-12345678')).toBe(false)
  })

  it('rechaza 9 dígitos (fuera del rango real de cédula)', () => {
    expect(isValidStaffIdNumber('V-123456789')).toBe(false)
  })

  it('rechaza menos de 7 dígitos', () => {
    expect(isValidStaffIdNumber('V-123456')).toBe(false)
  })

  it('rechaza sin prefijo', () => {
    expect(isValidStaffIdNumber('12345678')).toBe(false)
  })
})
