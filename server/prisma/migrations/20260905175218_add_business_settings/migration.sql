-- CreateTable
CREATE TABLE `businesssettings` (
    `id` VARCHAR(191) NOT NULL,
    `pagoMovilBanco` VARCHAR(191) NOT NULL,
    `pagoMovilTelefono` VARCHAR(191) NOT NULL,
    `pagoMovilCedula` VARCHAR(191) NOT NULL,
    `transferenciaBanco` VARCHAR(191) NOT NULL,
    `transferenciaCuenta` VARCHAR(191) NOT NULL,
    `transferenciaRif` VARCHAR(191) NOT NULL,
    `binanceId` VARCHAR(191) NOT NULL,
    `binanceRed` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
