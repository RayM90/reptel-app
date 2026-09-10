-- AlterTable
ALTER TABLE `advancepaymentsubmission` ADD COLUMN `confirmedByUserId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `productorderpaymentsubmission` ADD COLUMN `confirmedByUserId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `productorderpaymentsubmission` ADD CONSTRAINT `productorderpaymentsubmission_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advancepaymentsubmission` ADD CONSTRAINT `advancepaymentsubmission_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
