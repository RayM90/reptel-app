/**
 * @file devices.service.ts
 * @description Servicio de gestión de dispositivos para RepTel API.
 * Maneja las operaciones CRUD de dispositivos (celulares, tablets,
 * laptops, PCs) que ingresan al taller para reparación.
 * @module Devices
 */

import prisma from '../../lib/prisma';

/**
 * Obtiene todos los dispositivos registrados en el sistema
 * @returns Lista de dispositivos con datos del cliente asociado
 */
export const getAllDevices = async () => {
  return prisma.device.findMany({
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Obtiene un dispositivo por su ID
 * @param id - UUID del dispositivo
 * @returns Dispositivo encontrado con datos del cliente o null
 */
export const getDeviceById = async (id: string) => {
  return prisma.device.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
};

/**
 * Registra un nuevo dispositivo en el sistema
 * @param data - Datos del dispositivo a registrar
 * @returns Dispositivo creado
 */
export const createDevice = async (data: {
  type: string;
  brand: string;
  model: string;
  serialNumber?: string;
  color?: string;
  clientId: string;
}) => {
  return prisma.device.create({
    data: {
      type: data.type as any,
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber,
      color: data.color,
      clientId: data.clientId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
};

/**
 * Actualiza los datos de un dispositivo
 * @param id - UUID del dispositivo a actualizar
 * @param data - Campos a actualizar
 * @returns Dispositivo actualizado
 */
export const updateDevice = async (
  id: string,
  data: {
    brand?: string;
    model?: string;
    serialNumber?: string;
    color?: string;
  }
) => {
  return prisma.device.update({
    where: { id },
    data,
  });
};