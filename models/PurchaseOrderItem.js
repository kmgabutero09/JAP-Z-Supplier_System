import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseOrderItem = sequelize.define("PurchaseOrderItem", {
  quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  unit: { type: DataTypes.STRING(24), allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
});
