import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const supplyCategories = [
  "Meat & Poultry",
  "Produce",
  "Dairy",
  "Beverages",
  "Dry Goods",
  "Packaging",
  "Other"
];

export const SupplyCategory = sequelize.define("SupplyCategory", {
  name: {
    type: DataTypes.STRING(40),
    primaryKey: true,
    allowNull: false
  }
}, {
  tableName: "supply_categories",
  timestamps: false
});
