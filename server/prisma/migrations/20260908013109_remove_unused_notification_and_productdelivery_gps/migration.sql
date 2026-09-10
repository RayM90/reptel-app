/*
  Warnings:

  - You are about to drop the column `gpsLatitude` on the `productdelivery` table. All the data in the column will be lost.
  - You are about to drop the column `gpsLongitude` on the `productdelivery` table. All the data in the column will be lost.
  - You are about to drop the column `clientConfirmedAt` on the `productdelivery` table. All the data in the column will be lost.
  - You are about to drop the `notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_productOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_userId_fkey`;

-- AlterTable
ALTER TABLE `productdelivery` DROP COLUMN `gpsLatitude`,
    DROP COLUMN `gpsLongitude`,
    DROP COLUMN `clientConfirmedAt`;

-- DropTable
DROP TABLE `notification`;
