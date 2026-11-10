import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const AppSetting = sequelize.define("AppSetting", {
  settingKey: { type: DataTypes.STRING(64), primaryKey: true },
  settingValue: { type: DataTypes.TEXT, allowNull: false }
}, { timestamps: true });
