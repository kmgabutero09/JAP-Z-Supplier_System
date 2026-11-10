import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { SupplyCategory, supplyCategories } from "./SupplyCategory.js";

export const Supply = sequelize.define("Supply", {
  name: { type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } },
  category: { type: DataTypes.ENUM(...supplyCategories), allowNull: false },
  unit: { type: DataTypes.STRING(24), allowNull: false },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  stockQuantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  reorderLevel: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  supplierId: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.ENUM("Active", "Inactive"), allowNull: false, defaultValue: "Active" }
});

Supply.belongsTo(SupplyCategory, {
  foreignKey: "category",
  targetKey: "name",
  constraints: false
});
SupplyCategory.hasMany(Supply, {
  foreignKey: "category",
  sourceKey: "name",
  constraints: false
});
