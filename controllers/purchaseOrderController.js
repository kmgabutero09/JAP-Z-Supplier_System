import { sequelize } from "../models/db.js";
import { PurchaseOrder, PurchaseOrderItem, Supplier, SupplierSupply, SupplierTransaction, Supply } from "../models/index.js";
import { flashError, flashSuccess, money, nextNumber, nonNegativeNumber, numericValue, positiveNumber, renderPage, validDate, withFlash } from "./procurementControllerUtils.js";

export const purchaseOrdersPage = async (req, res, next) => {
  try {
    const formatDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
    };
    const [orders, suppliers, supplies] = await Promise.all([
      PurchaseOrder.findAll({
        include: [{ model: Supplier }, { model: PurchaseOrderItem, as: "items", include: [Supply] }],
        order: [["createdAt", "DESC"]]
      }),
      Supplier.findAll({ where: { status: "Active" }, order: [["name", "ASC"]] }),
      Supply.findAll({
        where: { status: "Active" },
        include: [{ model: Supplier, as: "Suppliers", attributes: ["id"] }],
        order: [["name", "ASC"]]
      })
    ]);
    await renderPage(res, "orders", "Purchase Orders", {
      orders: orders.map((order) => ({
        ...order.get({ plain: true }),
        isDraft: order.status === "Draft",
        isPending: order.status === "Pending",
        isApprovable: order.status === "Pending" || order.status === "Approved",
        isCancellable: ["Draft", "Pending", "Approved", "Sent to Supplier"].includes(order.status),
        isDeliverable: ["Sent to Supplier", "Partially Delivered"].includes(order.status),
        itemsLabel: order.items.map((item) => `${item.Supply?.name || "Supply"} × ${item.quantity} ${item.unit}`).join(", "),
        itemCount: order.items.length,
        createdDateLabel: formatDate(order.createdAt || order.orderDate),
        expectedDateLabel: order.expectedDate ? formatDate(order.expectedDate) : "—",
        statusClass: `status-${order.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      })),
      totalSuppliers: suppliers.length,
      suppliers: suppliers.map((supplier) => supplier.get({ plain: true })),
      supplies: supplies.map((supply) => ({
        ...supply.get({ plain: true }),
        supplierIds: supply.Suppliers.map((supplier) => supplier.id)
      })),
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.body.supplierId, status: "Active" } });
    if (!supplier) return flashError(req, res, "Choose an active supplier.", "/orders?create=1");
    if (!validDate(req.body.orderDate) || !validDate(req.body.expectedDate)
      || (req.body.expectedDate && req.body.expectedDate < req.body.orderDate)) {
      return flashError(req, res, "Enter a valid expected delivery date that is not before the order date.", "/orders?create=1");
    }
    const supplyIds = Array.isArray(req.body.supplyId) ? req.body.supplyId : [req.body.supplyId];
    const quantities = Array.isArray(req.body.quantity) ? req.body.quantity : [req.body.quantity];
    const prices = Array.isArray(req.body.unitPrice) ? req.body.unitPrice : [req.body.unitPrice];
    if (!supplyIds.length || supplyIds.length !== quantities.length || supplyIds.length !== prices.length) {
      return flashError(req, res, "Add at least one complete order item.", "/orders?create=1");
    }
    const lines = [];
    for (let index = 0; index < supplyIds.length; index += 1) {
      if (!positiveNumber(quantities[index]) || !nonNegativeNumber(prices[index])) {
        return flashError(req, res, "Order quantities must be positive and prices cannot be negative.", "/orders?create=1");
      }
      const supply = await Supply.findOne({ where: { id: supplyIds[index], status: "Active" } });
      if (!supply || !await SupplierSupply.findOne({ where: { supplierId: supplier.id, supplyId: supply.id } })) {
        return flashError(req, res, "Each item must be active and offered by the selected supplier.", "/orders?create=1");
      }
      lines.push({
        supplyId: supply.id,
        quantity: numericValue(quantities[index]),
        unit: supply.unit,
        unitPrice: money(numericValue(prices[index])),
        lineTotal: money(numericValue(quantities[index]) * numericValue(prices[index]))
      });
    }
    const initialStatus = req.body.status || "Pending";
    if (!["Draft", "Pending"].includes(initialStatus)) {
      return flashError(req, res, "Choose a valid initial status for the purchase order.", "/orders?create=1");
    }
    const totalAmount = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    await sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.create({
        orderNumber: `PO-${nextNumber()}`,
        supplierId: supplier.id,
        orderDate: req.body.orderDate,
        expectedDate: req.body.expectedDate || null,
        status: initialStatus,
        totalAmount,
        notes: req.body.notes?.trim() || null
      }, { transaction });
      await PurchaseOrderItem.bulkCreate(lines.map((line) => ({ ...line, purchaseOrderId: order.id })), { transaction });
    });
    flashSuccess(req, res, `Purchase order saved as ${initialStatus}.`, "/orders");
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByPk(req.params.id);
    if (!order) return flashError(req, res, "Purchase order not found.", "/orders");
    const transitions = {
      Draft: ["Pending", "Cancelled"],
      Pending: ["Approved", "Cancelled"],
      Approved: ["Sent to Supplier", "Cancelled"],
      "Sent to Supplier": ["Cancelled"]
    };
    if (!transitions[order.status]?.includes(req.body.status)) {
      return flashError(req, res, "That purchase order status change is not allowed.", "/orders");
    }
    if (req.body.status === "Cancelled") {
      const payments = await SupplierTransaction.sum("amount", {
        where: { purchaseOrderId: order.id, type: "Payment" }
      });
      if (Number(payments || 0) > 0) {
        return flashError(req, res, "A purchase order with recorded payments cannot be cancelled.", "/orders");
      }
    }
    await order.update({ status: req.body.status });
    flashSuccess(req, res, `Purchase order ${req.body.status.toLowerCase()}.`, "/orders");
  } catch (error) {
    next(error);
  }
};
