import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const DeliveryItem = sequelize.define("DeliveryItem", {
  quantityReceived: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  quantityDamaged: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  remarks: { type: DataTypes.STRING(255), allowNull: true }
});
