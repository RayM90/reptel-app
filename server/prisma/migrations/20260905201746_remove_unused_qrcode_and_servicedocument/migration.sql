-- DropForeignKey
ALTER TABLE `servicedocument` DROP FOREIGN KEY `ServiceDocument_orderId_fkey`;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `qrCode`;

-- DropTable
DROP TABLE `servicedocument`;

