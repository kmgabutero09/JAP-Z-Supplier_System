import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const SupplierTransaction = sequelize.define("SupplierTransaction", {
  transactionDate: { type: DataTypes.DATEONLY, allowNull: false },
  type: { type: DataTypes.ENUM("Payment", "Adjustment"), allowNull: false, defaultValue: "Payment" },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  method: { type: DataTypes.ENUM("Cash", "Bank Transfer", "GCash", "Maya", "Check", "Other"), allowNull: false },
  reference: { type: DataTypes.STRING(100), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
});
