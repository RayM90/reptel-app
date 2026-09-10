/*
  Warnings:

  - You are about to drop the column `receiptUrl` on the `productorder` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDetails` on the `productorder` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `productorder` table. All the data in the column will be lost.
  - You are about to drop the column `requiresInstallation` on the `productorder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `productorder` DROP COLUMN `receiptUrl`,
    DROP COLUMN `paymentDetails`,
    DROP COLUMN `rejectionReason`,
    DROP COLUMN `requiresInstallation`;
