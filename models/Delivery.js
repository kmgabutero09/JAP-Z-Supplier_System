import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Delivery = sequelize.define("Delivery", {
  deliveryDate: { type: DataTypes.DATEONLY, allowNull: false },
  receivedBy: { type: DataTypes.STRING(120), allowNull: false },
  remarks: { type: DataTypes.TEXT, allowNull: true }
});
