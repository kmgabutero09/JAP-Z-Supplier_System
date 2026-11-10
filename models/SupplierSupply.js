import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const SupplierSupply = sequelize.define("SupplierSupply", {
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: "supplier_supply_pair"
  },
  supplyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: "supplier_supply_pair"
  }
}, {
  tableName: "supplier_supplies"
});
