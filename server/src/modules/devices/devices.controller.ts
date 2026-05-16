/**
 * @file devices.controller.ts
 * @description Controlador de dispositivos para RepTel API.
 * Maneja las peticiones HTTP para el registro y gestión de
 * equipos que ingresan al taller para reparación.
 * @module Devices
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
} from './devices.service';

/**
 * Obtiene todos los dispositivos registrados
 */
export const getDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const devices = await getAllDevices();
    res.status(200).json({ success: true, data: devices });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener dispositivos' });
  }
};

/**
 * Obtiene un dispositivo por su ID
 */
export const getDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const device = await getDeviceById(id as string);
    if (!device) {
      res.status(404).json({ message: 'Dispositivo no encontrado' });
      return;
    }
    res.status(200).json({ success: true, data: device });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener dispositivo' });
  }
};

/**
 * Registra un nuevo dispositivo en el sistema
 */
export const registerDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, brand, model, serialNumber, color, clientId } = req.body;

    if (!type || !brand || !model || !clientId) {
      res.status(400).json({ message: 'Tipo, marca, modelo y cliente son requeridos' });
      return;
    }

    const validTypes = ['CELLPHONE', 'TABLET', 'LAPTOP', 'PC', 'OTHER'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: 'Tipo de dispositivo inválido' });
      return;
    }

    const device = await createDevice({ type, brand, model, serialNumber, color, clientId });
    res.status(201).json({ success: true, data: device });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error al registrar dispositivo' });
  }
};

/**
 * Actualiza los datos de un dispositivo
 */
export const updateDeviceData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { brand, model, serialNumber, color } = req.body;
    const device = await updateDevice(id as string, { brand, model, serialNumber, color });
    res.status(200).json({ success: true, data: device });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al actualizar dispositivo' });
  }
};