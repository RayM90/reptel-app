import { Request, Response } from 'express'
import * as clientsService from './clients.service'
import { isValidVenezuelanPhone, isValidVenezuelanIdNumber, isCompanyIdNumber } from '../../lib/venezuela'
import { flattenClientAddresses } from '../../lib/clientAddress'
import prisma from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth.middleware'

export const getClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const clients = await clientsService.getAllClients()
    res.json({ success: true, data: clients.map(flattenClientAddresses) })
  } catch (error) {
    console.error('ERROR GET CLIENTS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener clientes' })
  }
}

export const getClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const client = await clientsService.getClientById(id)
    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' })
      return
    }
    res.json({ success: true, data: flattenClientAddresses(client) })
  } catch (error) {
    console.error('ERROR GET CLIENT:', error)
    res.status(500).json({ success: false, message: 'Error al obtener el cliente' })
  }
}

export const getClientByIdNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const idNumber = String(req.params.idNumber)
    const client = await clientsService.getClientByIdNumber(idNumber)
    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' })
      return
    }
    res.json({ success: true, data: flattenClientAddresses(client) })
  } catch (error) {
    console.error('ERROR GET CLIENT BY ID NUMBER:', error)
    res.status(500).json({ success: false, message: 'Error al buscar el cliente' })
  }
}

export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, lastName, idNumber, phone, email, contactPerson, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding } = req.body
    if (!name || !idNumber || !phone) {
      res.status(400).json({
        success: false,
        message: 'Nombre, cédula y teléfono son requeridos',
      })
      return
    }
    if (!isValidVenezuelanIdNumber(idNumber)) {
      res.status(400).json({
        success: false,
        message: 'La cédula/RIF debe tener el formato V-12345678, E-12345678, J-123456789 o G-123456789',
      })
      return
    }
    const isCompany = isCompanyIdNumber(idNumber)
    if (!isCompany && !lastName) {
      res.status(400).json({
        success: false,
        message: 'El apellido es requerido para personas naturales (V-/E-)',
      })
      return
    }
    if (!isValidVenezuelanPhone(phone)) {
      res.status(400).json({
        success: false,
        message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)',
      })
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'El correo es requerido — con él el cliente entrará a la app RepTel' })
      return
    }
    const addressFields = [addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding]
    if (addressFields.some((v) => !v || !String(v).trim())) {
      res.status(400).json({ success: false, message: 'La dirección debe estar completa (Estado, Municipio, Barrio/Urb., Calle y Edificio/Casa)' })
      return
    }
    const emailTaken = await prisma.user.findUnique({ where: { email } })
    if (emailTaken) {
      res.status(400).json({ success: false, message: 'Ese correo ya pertenece a una cuenta de la app. Usa otro correo.' })
      return
    }
    const existing = await clientsService.getClientByIdNumber(idNumber)
    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con esa cédula',
      })
      return
    }
    const { client, tempPassword } = await clientsService.createClientWithAppUser({
      name,
      lastName: lastName || '',
      idNumber,
      phone,
      email,
      contactPerson,
      addressState,
      addressCity,
      addressNeighborhood,
      addressStreet,
      addressBuilding,
    })
    res.status(201).json({ success: true, data: flattenClientAddresses(client), tempPassword })
  } catch (error) {
    console.error('ERROR CREATE CLIENT:', error)
    res.status(500).json({ success: false, message: 'Error al crear el cliente' })
  }
}

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { name, lastName, phone, email, contactPerson, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding } = req.body
    if (phone && !isValidVenezuelanPhone(phone)) {
      res.status(400).json({
        success: false,
        message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)',
      })
      return
    }
    // El correo es el usuario de Cognito: cambiarlo aquí dejaría al cliente
    // sin poder entrar. Queda para una próxima versión.
    if (email !== undefined) {
      const current = await prisma.client.findUnique({ where: { id }, select: { email: true, user: { select: { id: true } } } })
      if (current?.user && (email || '') !== (current.email || '')) {
        res.status(400).json({ success: false, message: 'El correo de un cliente con cuenta en la app no se puede cambiar por ahora' })
        return
      }
    }
    const client = await clientsService.updateClient(id, {
      name,
      lastName,
      phone,
      email,
      contactPerson,
      addressState,
      addressCity,
      addressNeighborhood,
      addressStreet,
      addressBuilding,
    })
    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' })
      return
    }
    res.json({ success: true, data: flattenClientAddresses(client) })
  } catch (error) {
    console.error('ERROR UPDATE CLIENT:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar el cliente' })
  }
}

export const searchClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.q || '')
    if (!query) {
      res.status(400).json({ success: false, message: 'El parámetro de búsqueda es requerido' })
      return
    }
    const clients = await clientsService.searchClients(query)
    res.json({ success: true, data: clients.map(flattenClientAddresses) })
  } catch (error) {
    console.error('ERROR SEARCH CLIENTS:', error)
    res.status(500).json({ success: false, message: 'Error al buscar clientes' })
  }
}

const ADDRESS_KEYS = ['addressState', 'addressCity', 'addressNeighborhood', 'addressStreet', 'addressBuilding'] as const
const isBlank = (v: unknown) => !v || !String(v).trim()

// Validación del perfil que el cliente edita desde la app.
export const validateOwnProfile = (body: any, idNumber: string): string | null => {
  if (isBlank(body.name)) return 'El nombre es requerido'
  if (!isCompanyIdNumber(idNumber) && isBlank(body.lastName)) return 'El apellido es requerido'
  if (!body.phone || !isValidVenezuelanPhone(body.phone)) return 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)'
  if (ADDRESS_KEYS.some((k) => isBlank(body[k])))
    return 'La dirección debe estar completa (Estado, Municipio, Barrio/Urb., Calle y Edificio/Casa)'
  const second = body.secondaryAddress
  if (second && (isBlank(second.label) || ADDRESS_KEYS.some((k) => isBlank(second[k]))))
    return 'La segunda dirección debe tener nombre y los 5 campos completos'
  return null
}

const ownClientId = async (req: AuthRequest): Promise<string | null> => {
  const user = await prisma.user.findUnique({ where: { email: req.user!.email }, select: { clientId: true } })
  return user?.clientId ?? null
}

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clientId = await ownClientId(req)
    const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, include: { addresses: true } }) : null
    if (!client) {
      res.status(404).json({ success: false, message: 'No se encontró tu perfil de cliente' })
      return
    }
    res.json({ success: true, data: flattenClientAddresses(client) })
  } catch (error) {
    console.error('ERROR GET MY PROFILE:', error)
    res.status(500).json({ success: false, message: 'Error al obtener tu perfil' })
  }
}

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clientId = await ownClientId(req)
    const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { idNumber: true } }) : null
    if (!clientId || !client) {
      res.status(404).json({ success: false, message: 'No se encontró tu perfil de cliente' })
      return
    }
    const error = validateOwnProfile(req.body, client.idNumber)
    if (error) {
      res.status(400).json({ success: false, message: error })
      return
    }
    const b = req.body
    const updated = await clientsService.updateOwnProfile(clientId, {
      name: String(b.name).trim(),
      lastName: isCompanyIdNumber(client.idNumber) ? '' : String(b.lastName).trim(),
      phone: b.phone,
      addressState: b.addressState,
      addressCity: b.addressCity,
      addressNeighborhood: b.addressNeighborhood,
      addressStreet: b.addressStreet,
      addressBuilding: b.addressBuilding,
      secondaryAddress: b.secondaryAddress,
    })
    res.json({ success: true, data: flattenClientAddresses(updated!) })
  } catch (error) {
    console.error('ERROR UPDATE MY PROFILE:', error)
    res.status(500).json({ success: false, message: 'Error al guardar tu perfil' })
  }
}
