import { randomBytes } from "node:crypto";
import { AppSetting } from "../models/index.js";
import { supplyCategories } from "../models/SupplyCategory.js";

export const categories = supplyCategories;
export const paymentMethods = ["Cash", "Bank Transfer", "GCash", "Maya", "Check", "Other"];
export const numericValue = (value) => value === undefined || value === "" ? NaN : Number(value);
export const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
export const today = () => new Date().toISOString().slice(0, 10);
export const flashError = (req, res, message, path) => {
  req.flash("error_msg", message);
  res.redirect(path);
};
export const flashSuccess = (req, res, message, path) => {
  req.flash("success_msg", message);
  res.redirect(path);
};
export const positiveNumber = (value) => Number.isFinite(numericValue(value)) && numericValue(value) > 0;
export const nonNegativeNumber = (value) => Number.isFinite(numericValue(value)) && numericValue(value) >= 0;
export const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const withFlash = (req) => ({
  successMessage: req.flash("success_msg")[0],
  errorMessage: req.flash("error_msg")[0]
});
export const nextNumber = () => `${today().replaceAll("-", "").slice(2)}-${randomBytes(3).toString("hex").toUpperCase()}`;

const pageDetails = {
  products: { view: "supplies", description: "Track ingredient costs and stock levels.", action: "Add product" },
  orders: { view: "purchase-orders", description: "Create and track supplier purchase orders.", action: "New purchase order" },
  deliveries: { view: "deliveries", description: "Receive orders and record partial deliveries.", action: "Record delivery" },
  transactions: { view: "transactions", description: "Record supplier payments and review balances.", action: "Record payment" },
  reports: { view: "reports", description: "Review purchasing, payments, and inventory levels." },
  settings: { view: "settings", description: "Configure your restaurant workspace." }
};

export const renderPage = async (res, page, title, data = {}) => {
  const [currency, businessNameSetting] = await Promise.all([
    AppSetting.findByPk("currency"),
    AppSetting.findByPk("businessName")
  ]);
  const details = pageDetails[page];
  return res.render(`supplier/${details.view}.xian`, {
    title,
    supplierStyles: true,
    operationsStyles: true,
    currencySymbol: currency?.settingValue === "USD" ? "$" : "₱",
    currencyName: currency?.settingValue === "USD" ? "US dollars" : "Philippine pesos",
    currencyCode: currency?.settingValue || "PHP",
    businessName: businessNameSetting?.settingValue || "JAPZ GRILL & BISTRO",
    page,
    referenceSidebar: ["products", "orders", "deliveries", "transactions", "reports", "settings"].includes(page),
    procurementPage: page === "orders",
    pageDescription: details.description,
    hasPrimaryAction: Boolean(details.action),
    primaryAction: details.action,
    navDashboard: false,
    navSuppliers: false,
    navProducts: page === "products",
    navOrders: page === "orders",
    navDeliveries: page === "deliveries",
    navTransactions: page === "transactions",
    navReports: page === "reports",
    navSettings: page === "settings",
    pageProducts: page === "products",
    pageOrders: page === "orders",
    pageDeliveries: page === "deliveries",
    pageTransactions: page === "transactions",
    pageReports: page === "reports",
    pageSettings: page === "settings",
    categories,
    paymentMethods,
    today: today(),
    ...data
  });
};
