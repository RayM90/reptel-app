-- AlterTable
ALTER TABLE `user` ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `idNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_idNumber_key` ON `user`(`idNumber`);
