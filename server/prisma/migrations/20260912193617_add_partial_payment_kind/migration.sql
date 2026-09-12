-- AlterTable
ALTER TABLE `advancepaymentsubmission` ADD COLUMN `kind` ENUM('REVISION', 'BUDGET') NOT NULL DEFAULT 'REVISION';
