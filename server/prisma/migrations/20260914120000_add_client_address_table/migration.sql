-- CreateTable
CREATE TABLE `ClientAddress` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `addressState` VARCHAR(191) NULL,
    `addressCity` VARCHAR(191) NULL,
    `addressNeighborhood` VARCHAR(191) NULL,
    `addressStreet` VARCHAR(191) NULL,
    `addressBuilding` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientAddress_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientAddress` ADD CONSTRAINT `ClientAddress_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateData: copia la dirección plana de cada Client existente a una fila
-- ClientAddress marcada como principal, antes de borrar las columnas viejas.
INSERT INTO `ClientAddress` (`id`, `clientId`, `label`, `isPrimary`, `addressState`, `addressCity`, `addressNeighborhood`, `addressStreet`, `addressBuilding`, `createdAt`, `updatedAt`)
SELECT UUID(), `id`, 'Principal', true, `addressState`, `addressCity`, `addressNeighborhood`, `addressStreet`, `addressBuilding`, NOW(), NOW()
FROM `client`
WHERE `addressState` IS NOT NULL
   OR `addressCity` IS NOT NULL
   OR `addressNeighborhood` IS NOT NULL
   OR `addressStreet` IS NOT NULL
   OR `addressBuilding` IS NOT NULL;

-- AlterTable
ALTER TABLE `client` DROP COLUMN `addressBuilding`,
    DROP COLUMN `addressCity`,
    DROP COLUMN `addressNeighborhood`,
    DROP COLUMN `addressState`,
    DROP COLUMN `addressStreet`;
