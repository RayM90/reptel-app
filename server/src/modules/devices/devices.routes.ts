/**
 * @file devices.routes.ts
 * @description Rutas del módulo de dispositivos para RepTel API.
 * Define los endpoints para gestión de equipos del taller,
 * protegidos por autenticación JWT y control de roles.
 * @module Devices
 */

import { Router } from 'express';
import {
  getDevices,
  getDevice,
  registerDevice,
  updateDeviceData,
} from './devices.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Listar dispositivos — ADMIN, MANAGER, TECHNICIAN, SELLER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER'), getDevices);

// Obtener dispositivo por ID — todos los roles
router.get('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER', 'CLIENT'), getDevice);

// Registrar dispositivo — ADMIN, MANAGER, SELLER
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'SELLER'), registerDevice);

// Actualizar dispositivo — ADMIN, MANAGER
router.patch('/:id', authenticate, authorize('ADMIN', 'MANAGER'), updateDeviceData);

export default router;