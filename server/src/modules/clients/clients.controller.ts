import { Request, Response } from 'express'
import * as clientsService from './clients.service'
import { isValidVenezuelanPhone, isValidVenezuelanIdNumber } from '../../lib/venezuela'

export const getClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const clients = await clientsService.getAllClients()
    res.json({ success: true, data: clients })
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
    res.json({ success: true, data: client })
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
    res.json({ success: true, data: client })
  } catch (error) {
    console.error('ERROR GET CLIENT BY ID NUMBER:', error)
    res.status(500).json({ success: false, message: 'Error al buscar el cliente' })
  }
}

export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, lastName, idNumber, phone, email, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding } = req.body
    if (!name || !lastName || !idNumber || !phone) {
      res.status(400).json({
        success: false,
        message: 'Nombre, apellido, cédula y teléfono son requeridos',
      })
      return
    }
    if (!isValidVenezuelanIdNumber(idNumber)) {
      res.status(400).json({
        success: false,
        message: 'La cédula debe tener el formato V-12345678 o E-12345678',
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
    const existing = await clientsService.getClientByIdNumber(idNumber)
    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con esa cédula',
      })
      return
    }
    const client = await clientsService.createClient({
      name,
      lastName,
      idNumber,
      phone,
      email,
      addressState,
      addressCity,
      addressNeighborhood,
      addressStreet,
      addressBuilding,
    })
    res.status(201).json({ success: true, data: client })
  } catch (error) {
    console.error('ERROR CREATE CLIENT:', error)
    res.status(500).json({ success: false, message: 'Error al crear el cliente' })
  }
}

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { name, lastName, phone, email, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding } = req.body
    if (phone && !isValidVenezuelanPhone(phone)) {
      res.status(400).json({
        success: false,
        message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)',
      })
      return
    }
    const client = await clientsService.updateClient(id, {
      name,
      lastName,
      phone,
      email,
      addressState,
      addressCity,
      addressNeighborhood,
      addressStreet,
      addressBuilding,
    })
    res.json({ success: true, data: client })
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
    res.json({ success: true, data: clients })
  } catch (error) {
    console.error('ERROR SEARCH CLIENTS:', error)
    res.status(500).json({ success: false, message: 'Error al buscar clientes' })
  }
}