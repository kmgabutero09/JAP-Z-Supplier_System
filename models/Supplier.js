import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { supplyCategories } from "./SupplyCategory.js";

export const Supplier = sequelize.define("Supplier", {
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: { notEmpty: true, len: [2, 120] }
  },
  contactPerson: { type: DataTypes.STRING(120), allowNull: false },
  phone: { type: DataTypes.STRING(40), allowNull: false },
  email: {
    type: DataTypes.STRING(160),
    allowNull: true,
    validate: { isEmail: true }
  },
  address: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.ENUM(...supplyCategories), allowNull: false },
  paymentTerms: {
    type: DataTypes.ENUM("Cash", "COD", "7 days", "15 days", "30 days"),
    allowNull: false
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM("Active", "Inactive"),
    allowNull: false,
    defaultValue: "Active"
  }
});
