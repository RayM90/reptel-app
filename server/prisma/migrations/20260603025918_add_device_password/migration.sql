/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `device` table. All the data in the column will be lost.
  - The values [OTHER] on the enum `ServiceRequest_deviceType` will be removed. If these variants are still used in the database, this will fail.
  - The values [OTHER] on the enum `ServiceRequest_deviceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `device` DROP COLUMN `photoUrl`,
    ADD COLUMN `devicePassword` VARCHAR(191) NULL,
    MODIFY `type` ENUM('LAPTOP', 'PC') NOT NULL;

-- AlterTable
ALTER TABLE `servicerequest` MODIFY `deviceType` ENUM('LAPTOP', 'PC') NOT NULL;
