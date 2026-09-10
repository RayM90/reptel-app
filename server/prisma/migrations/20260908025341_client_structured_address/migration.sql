/*
  Warnings:

  - You are about to drop the column `address` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `client` DROP COLUMN `address`,
    ADD COLUMN `addressState` VARCHAR(191) NULL,
    ADD COLUMN `addressCity` VARCHAR(191) NULL,
    ADD COLUMN `addressNeighborhood` VARCHAR(191) NULL,
    ADD COLUMN `addressStreet` VARCHAR(191) NULL,
    ADD COLUMN `addressBuilding` VARCHAR(191) NULL;
