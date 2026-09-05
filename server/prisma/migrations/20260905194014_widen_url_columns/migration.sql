-- AlterTable
ALTER TABLE `invoice` MODIFY `pdfUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `order` MODIFY `advanceReceiptUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `product` MODIFY `imageUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `productdelivery` MODIFY `photoUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `productorder` MODIFY `receiptUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `servicedocument` MODIFY `pdfUrl` VARCHAR(500) NULL;
