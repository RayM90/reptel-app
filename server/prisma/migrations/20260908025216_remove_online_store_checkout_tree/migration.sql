/*
  Warnings:

  - You are about to drop the `productdelivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productorder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productorderitem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productorderpaymentsubmission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productorderstatushistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `productdelivery` DROP FOREIGN KEY `productdelivery_productOrderId_fkey`;
ALTER TABLE `productdelivery` DROP FOREIGN KEY `productdelivery_agentId_fkey`;

-- DropForeignKey
ALTER TABLE `productorderpaymentsubmission` DROP FOREIGN KEY `productorderpaymentsubmission_productOrderId_fkey`;
ALTER TABLE `productorderpaymentsubmission` DROP FOREIGN KEY `productorderpaymentsubmission_confirmedByUserId_fkey`;

-- DropForeignKey
ALTER TABLE `productorderstatushistory` DROP FOREIGN KEY `productorderstatushistory_productOrderId_fkey`;
ALTER TABLE `productorderstatushistory` DROP FOREIGN KEY `productorderstatushistory_userId_fkey`;

-- DropForeignKey
ALTER TABLE `productorderitem` DROP FOREIGN KEY `productorderitem_productId_fkey`;
ALTER TABLE `productorderitem` DROP FOREIGN KEY `productorderitem_productOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `productorder` DROP FOREIGN KEY `productorder_clientId_fkey`;
ALTER TABLE `productorder` DROP FOREIGN KEY `productorder_linkedOrderId_fkey`;

-- DropTable
DROP TABLE `productdelivery`;

-- DropTable
DROP TABLE `productorderpaymentsubmission`;

-- DropTable
DROP TABLE `productorderstatushistory`;

-- DropTable
DROP TABLE `productorderitem`;

-- DropTable
DROP TABLE `productorder`;
