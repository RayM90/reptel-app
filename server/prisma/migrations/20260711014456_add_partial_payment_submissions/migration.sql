-- CreateTable
CREATE TABLE `productorderpaymentsubmission` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paymentDetails` JSON NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `productOrderId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `productorderpaymentsubmission` ADD CONSTRAINT `productorderpaymentsubmission_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
