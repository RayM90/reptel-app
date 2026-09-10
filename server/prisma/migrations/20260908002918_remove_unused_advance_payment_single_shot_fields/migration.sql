/*
  Warnings:

  - You are about to drop the column `advanceReceiptUrl` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `advancePaymentDetails` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `advancePaymentConfirmed` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `advancePaymentConfirmedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `advancePaymentRejectionReason` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Order` DROP COLUMN `advanceReceiptUrl`,
    DROP COLUMN `advancePaymentDetails`,
    DROP COLUMN `advancePaymentConfirmed`,
    DROP COLUMN `advancePaymentConfirmedAt`,
    DROP COLUMN `advancePaymentRejectionReason`;
