/*
  Warnings:

  - Added the required column `clientId` to the `Device` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `device` ADD COLUMN `clientId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
