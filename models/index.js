import { Op } from "sequelize";
import { sequelize } from "./db.js";
import { Supplier } from "./Supplier.js";
import { Supply } from "./Supply.js";
import { SupplierSupply } from "./SupplierSupply.js";
import { SupplyCategory, supplyCategories } from "./SupplyCategory.js";
import { PurchaseOrder } from "./PurchaseOrder.js";
import { PurchaseOrderItem } from "./PurchaseOrderItem.js";
import { Delivery } from "./Delivery.js";
import { DeliveryItem } from "./DeliveryItem.js";
import { SupplierTransaction } from "./SupplierTransaction.js";
import { AppSetting } from "./AppSetting.js";

Supplier.belongsToMany(Supply, { through: SupplierSupply, as: "Supplies", foreignKey: "supplierId", otherKey: "supplyId" });
Supply.belongsToMany(Supplier, { through: SupplierSupply, as: "Suppliers", foreignKey: "supplyId", otherKey: "supplierId" });
Supplier.hasMany(PurchaseOrder, { foreignKey: "supplierId" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplierId" });
PurchaseOrder.hasMany(PurchaseOrderItem, { as: "items", foreignKey: "purchaseOrderId", onDelete: "CASCADE" });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId" });
PurchaseOrderItem.belongsTo(Supply, { foreignKey: "supplyId" });
Supply.hasMany(PurchaseOrderItem, { foreignKey: "supplyId" });
PurchaseOrder.hasMany(Delivery, { foreignKey: "purchaseOrderId" });
Delivery.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId" });
Delivery.hasMany(DeliveryItem, { as: "items", foreignKey: "deliveryId", onDelete: "CASCADE" });
DeliveryItem.belongsTo(Delivery, { foreignKey: "deliveryId" });
DeliveryItem.belongsTo(PurchaseOrderItem, { foreignKey: "purchaseOrderItemId" });
PurchaseOrderItem.hasMany(DeliveryItem, { foreignKey: "purchaseOrderItemId" });
Supplier.hasMany(SupplierTransaction, { foreignKey: "supplierId" });
SupplierTransaction.belongsTo(Supplier, { foreignKey: "supplierId" });
PurchaseOrder.hasMany(SupplierTransaction, { foreignKey: "purchaseOrderId" });
SupplierTransaction.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId" });

export {
  sequelize,
  Supplier,
  Supply,
  SupplierSupply,
  SupplyCategory,
  PurchaseOrder,
  PurchaseOrderItem,
  Delivery,
  DeliveryItem,
  SupplierTransaction,
  AppSetting
};

export const migrateProcurementSchema = async () => {
  const table = await sequelize.getQueryInterface().describeTable(PurchaseOrder.getTableName());
  if (!table.status.type.includes("Draft")) {
    await sequelize.getQueryInterface().changeColumn(PurchaseOrder.getTableName(), "status", PurchaseOrder.rawAttributes.status);
  }
  const supplyTable = await sequelize.getQueryInterface().describeTable(Supply.getTableName());
  if (supplyTable.supplierId) {
    await sequelize.transaction(async (transaction) => {
      const legacySupplies = await Supply.findAll({
        attributes: ["id", "supplierId"],
        where: { supplierId: { [Op.ne]: null } },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      for (const supply of legacySupplies) {
        await SupplierSupply.findOrCreate({
          where: { supplierId: supply.supplierId, supplyId: supply.id },
          transaction
        });
        await supply.update({ supplierId: null }, { transaction });
      }
    });
  }
  await SupplyCategory.bulkCreate(supplyCategories.map((name) => ({ name })), {
    ignoreDuplicates: true
  });
};
