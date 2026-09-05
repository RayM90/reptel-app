-- AlterTable
ALTER TABLE `order` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `productorder` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;
