-- CreateTable
CREATE TABLE `productorderstatushistory` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'READY_FOR_PICKUP', 'ASSIGNED_DELIVERY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED') NOT NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `productOrderId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `productorderstatushistory` ADD CONSTRAINT `productorderstatushistory_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productorderstatushistory` ADD CONSTRAINT `productorderstatushistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
