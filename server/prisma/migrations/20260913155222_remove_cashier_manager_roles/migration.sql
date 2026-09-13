-- Quita CASHIER y MANAGER del enum Role — sin uso real en el código (solo aparecían en un test),
-- ver docs/superpowers/specs/2026-09-13-formulario-crear-personal-design.md. Verificado antes de
-- aplicar (2026-09-13, contra la BD de desarrollo del worktree): un script temporal con Prisma
-- Client (`User.groupBy({ by: ['role'], where: { role: { in: ['CASHIER','MANAGER'] } } })`)
-- confirmó 0 filas con esos roles; corroborado además por el propio diff de
-- `prisma migrate dev --create-only`, que solo listó CASHIER/MANAGER como valores removidos del
-- enum `User_role` sin advertir de filas afectadas. Re-verificar el mismo conteo contra la base de
-- producción antes de `migrate deploy` allí — este ALTER no tiene guarda de datos propia.

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY', 'CLIENT') NOT NULL DEFAULT 'CLIENT';
