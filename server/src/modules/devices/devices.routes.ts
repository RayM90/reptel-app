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

// Listar dispositivos — ADMIN, TECHNICIAN_DELIVERY
router.get('/', authenticate, authorize('ADMIN', 'TECHNICIAN_DELIVERY'), getDevices);

// Obtener dispositivo por ID — ADMIN, TECHNICIAN_DELIVERY, CLIENT
router.get('/:id', authenticate, authorize('ADMIN', 'TECHNICIAN_DELIVERY', 'CLIENT'), getDevice);

// Registrar dispositivo — ADMIN
router.post('/', authenticate, authorize('ADMIN'), registerDevice);

// Actualizar dispositivo — ADMIN
router.patch('/:id', authenticate, authorize('ADMIN'), updateDeviceData);

export default router;