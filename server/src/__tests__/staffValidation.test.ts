import { STAFF_EMAIL_DOMAIN, isValidStaffEmail, isValidPersonName } from '../lib/staffValidation'

describe('STAFF_EMAIL_DOMAIN', () => {
  it('es @reptel.com', () => {
    expect(STAFF_EMAIL_DOMAIN).toBe('@reptel.com')
  })
})

describe('isValidStaffEmail', () => {
  it('acepta identidad + @reptel.com', () => {
    expect(isValidStaffEmail('jperez@reptel.com')).toBe(true)
  })

  it('acepta mayúsculas (normaliza a minúsculas internamente)', () => {
    expect(isValidStaffEmail('JPerez@Reptel.com')).toBe(true)
  })

  it('rechaza un dominio externo', () => {
    expect(isValidStaffEmail('jperez@gmail.com')).toBe(false)
  })

  it('rechaza identidad vacía', () => {
    expect(isValidStaffEmail('@reptel.com')).toBe(false)
  })

  it('rechaza identidad con caracteres no permitidos', () => {
    expect(isValidStaffEmail('j perez!@reptel.com')).toBe(false)
  })

  it('rechaza identidad de más de 30 caracteres', () => {
    expect(isValidStaffEmail(`${'a'.repeat(31)}@reptel.com`)).toBe(false)
  })
})

describe('isValidPersonName', () => {
  it('acepta nombre simple', () => {
    expect(isValidPersonName('Juan')).toBe(true)
  })

  it('acepta nombre compuesto con tildes y ñ', () => {
    expect(isValidPersonName('María José Núñez')).toBe(true)
  })

  it('rechaza menos de 2 caracteres', () => {
    expect(isValidPersonName('A')).toBe(false)
  })

  it('rechaza números', () => {
    expect(isValidPersonName('Juan123')).toBe(false)
  })

  it('rechaza símbolos', () => {
    expect(isValidPersonName('Juan-Pérez')).toBe(false)
  })

  it('rechaza más de 50 caracteres', () => {
    expect(isValidPersonName('a'.repeat(51))).toBe(false)
  })
})
