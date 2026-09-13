-- Quita CASHIER y MANAGER del enum Role — sin uso real en el código (solo aparecían en un test),
-- ver docs/superpowers/specs/2026-09-13-formulario-crear-personal-design.md. Verificado antes de
-- aplicar: 0 filas User con esos roles (server/scripts/check-legacy-roles.sql, Step 1).

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY', 'CLIENT') NOT NULL DEFAULT 'CLIENT';
