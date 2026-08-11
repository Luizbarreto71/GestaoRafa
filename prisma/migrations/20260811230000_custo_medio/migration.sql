-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lastPurchaseAt" TIMESTAMP(3),
ADD COLUMN     "lastPurchaseCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "averageCostAfter" DECIMAL(12,2),
ADD COLUMN     "unitCost" DECIMAL(12,2);

