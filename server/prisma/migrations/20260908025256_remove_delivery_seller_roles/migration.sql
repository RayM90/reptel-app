-- Borra las cuentas de prueba/dev con rol DELIVERY (motorizado de tienda,
-- ya sin sentido tras eliminar el checkout online) antes de reducir el enum.
-- Confirmado antes de aplicar: 0 usuarios SELLER, y los 3 DELIVERY son
-- fixtures de prueba (delivery2@reptel.com, "Motorizado Test", "Test Motorizado Smoke").
DELETE FROM `User` WHERE `role` = 'DELIVERY';

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'CASHIER', 'TECHNICIAN', 'TECHNICIAN_DELIVERY', 'CLIENT', 'MANAGER') NOT NULL DEFAULT 'CLIENT';
