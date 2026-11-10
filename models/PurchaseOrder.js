import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseOrder = sequelize.define("PurchaseOrder", {
  orderNumber: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  orderDate: { type: DataTypes.DATEONLY, allowNull: false },
  expectedDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM("Draft", "Pending", "Approved", "Sent to Supplier", "Partially Delivered", "Completed", "Cancelled"),
    allowNull: false,
    defaultValue: "Pending"
  },
  totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true }
});
