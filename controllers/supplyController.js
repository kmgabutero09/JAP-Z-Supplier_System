import { AppSetting, Supplier, SupplierSupply, Supply, sequelize } from "../models/index.js";
import { categories, flashError, flashSuccess, nonNegativeNumber, numericValue, renderPage, withFlash } from "./procurementControllerUtils.js";

export const productsPage = async (req, res, next) => {
  try {
    const [products, suppliers, thresholdSetting] = await Promise.all([
      Supply.findAll({ include: [{ model: Supplier, as: "Suppliers", attributes: ["id", "name"] }], order: [["name", "ASC"]] }),
      Supplier.findAll({ where: { status: "Active" }, order: [["name", "ASC"]] }),
      AppSetting.findByPk("lowStockThreshold")
    ]);
    const defaultThreshold = thresholdSetting ? Number(thresholdSetting.settingValue) : 5;
    await renderPage(res, "products", "Products & Supplies", {
      products: products.map((product) => ({
        ...product.get({ plain: true }),
        productCode: `ITM-${String(product.id).padStart(3, "0")}`,
        initials: product.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        supplierNames: product.Suppliers.map((supplier) => supplier.name).join(", "),
        supplierIds: product.Suppliers.map((supplier) => supplier.id),
        lowStock: Number(product.stockQuantity) <= (Number(product.reorderLevel) || defaultThreshold),
        isActive: product.status === "Active"
      })),
      suppliers: suppliers.map((supplier) => supplier.get({ plain: true })),
      totalSuppliers: suppliers.length,
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

const supplyInput = (body) => {
  const supplierValues = Array.isArray(body.supplierIds)
    ? body.supplierIds
    : body.supplierIds ? [body.supplierIds] : body.supplierId ? [body.supplierId] : [];
  return {
    name: body.name?.trim(),
    category: body.category,
    unit: body.unit?.trim(),
    unitCost: numericValue(body.unitCost),
    stockQuantity: numericValue(body.stockQuantity),
    reorderLevel: numericValue(body.reorderLevel),
    supplierIds: [...new Set(supplierValues.map((value) => Number(value)))]
  };
};

const hasValidSupplierIds = (supplierIds) => supplierIds.every((id) => Number.isInteger(id) && id > 0);

const activeSuppliersFor = async (supplierIds) => {
  if (!supplierIds.length) return [];
  return Supplier.findAll({
    where: { id: supplierIds, status: "Active" },
    attributes: ["id"]
  });
};

const saveSupplySuppliers = async (supply, supplierIds, transaction) => {
  await SupplierSupply.destroy({ where: { supplyId: supply.id }, transaction });
  if (supplierIds.length) {
    await SupplierSupply.bulkCreate(supplierIds.map((supplierId) => ({
      supplyId: supply.id,
      supplierId
    })), { transaction });
  }
};

export const createSupply = async (req, res, next) => {
  try {
    const data = supplyInput(req.body);
    if (!data.name || !data.unit || !categories.includes(data.category) || !hasValidSupplierIds(data.supplierIds)
      || !nonNegativeNumber(data.unitCost) || !nonNegativeNumber(data.stockQuantity)
      || !nonNegativeNumber(data.reorderLevel)) {
      return flashError(req, res, "Check the product details, category, price, and quantities.", "/products?create=1");
    }
    const suppliers = await activeSuppliersFor(data.supplierIds);
    if (suppliers.length !== data.supplierIds.length) {
      return flashError(req, res, "Choose an active supplier.", "/products?create=1");
    }
    await sequelize.transaction(async (transaction) => {
      const { supplierIds, ...supplyData } = data;
      const supply = await Supply.create(supplyData, { transaction });
      await saveSupplySuppliers(supply, supplierIds, transaction);
    });
    flashSuccess(req, res, "Product or supply added.", "/products");
  } catch (error) {
    next(error);
  }
};

export const updateSupply = async (req, res, next) => {
  try {
    const product = await Supply.findByPk(req.params.id);
    if (!product) return flashError(req, res, "Product not found.", "/products");
    const data = supplyInput(req.body);
    if (!data.name || !data.unit || !categories.includes(data.category) || !hasValidSupplierIds(data.supplierIds)
      || !nonNegativeNumber(data.unitCost) || !nonNegativeNumber(data.stockQuantity)
      || !nonNegativeNumber(data.reorderLevel)) {
      return flashError(req, res, "Check the product details, category, price, and quantities.", "/products");
    }
    const suppliers = await activeSuppliersFor(data.supplierIds);
    if (suppliers.length !== data.supplierIds.length) {
      return flashError(req, res, "Choose active suppliers only.", "/products");
    }
    await sequelize.transaction(async (transaction) => {
      const { supplierIds, ...supplyData } = data;
      await product.update(supplyData, { transaction });
      await saveSupplySuppliers(product, supplierIds, transaction);
    });
    flashSuccess(req, res, "Product or supply updated.", "/products");
  } catch (error) {
    next(error);
  }
};

export const setSupplyStatus = async (req, res, next) => {
  try {
    if (!["Active", "Inactive"].includes(req.body.status)) return flashError(req, res, "Choose a valid product status.", "/products");
    const product = await Supply.findByPk(req.params.id);
    if (!product) return flashError(req, res, "Product not found.", "/products");
    await product.update({ status: req.body.status });
    flashSuccess(req, res, `Product ${req.body.status === "Active" ? "activated" : "archived"}.`, "/products");
  } catch (error) {
    next(error);
  }
};
