import { Op } from "sequelize";
import { sequelize } from "../models/db.js";
import { AppSetting, Delivery, DeliveryItem, PurchaseOrder, PurchaseOrderItem, Supplier, SupplierSupply, SupplierTransaction, Supply } from "../models/index.js";
import { flashError, flashSuccess, money, nonNegativeNumber, numericValue, paymentMethods, positiveNumber, renderPage, validDate, withFlash } from "./procurementControllerUtils.js";

export const transactionsPage = async (req, res, next) => {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const formatDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
    };
    const [transactions, suppliers, orders] = await Promise.all([
      SupplierTransaction.findAll({
        include: [{ model: Supplier }, { model: PurchaseOrder }],
        order: [["transactionDate", "DESC"], ["createdAt", "DESC"]]
      }),
      Supplier.findAll({ where: { status: "Active" }, order: [["name", "ASC"]] }),
      PurchaseOrder.findAll({
        where: { status: { [Op.notIn]: ["Draft", "Cancelled"] } },
        include: [{ model: Supplier }],
        order: [["orderDate", "DESC"]]
      })
    ]);
    const paidByOrder = new Map();
    const paidBySupplier = new Map();
    transactions.filter((record) => record.type === "Payment").forEach((record) => {
      const amount = Number(record.amount);
      paidBySupplier.set(record.supplierId, (paidBySupplier.get(record.supplierId) || 0) + amount);
      if (record.purchaseOrderId) paidByOrder.set(record.purchaseOrderId, (paidByOrder.get(record.purchaseOrderId) || 0) + amount);
    });
    const orderOptions = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.Supplier.name,
      totalAmount: Number(order.totalAmount),
      remainingBalance: Math.max(0, money(Number(order.totalAmount) - (paidByOrder.get(order.id) || 0)))
    }));
    const supplierBalances = suppliers.map((supplier) => {
      const balance = orderOptions.filter((order) => Number(order.supplierId) === Number(supplier.id))
        .reduce((sum, order) => sum + order.totalAmount, 0) - (paidBySupplier.get(supplier.id) || 0);
      return { id: supplier.id, name: supplier.name, balance: money(Math.max(0, balance)) };
    });
    const purchaseTransactions = orders.map((order) => {
      const paid = paidByOrder.get(order.id) || 0;
      const remaining = Math.max(0, money(Number(order.totalAmount) - paid));
      const statusLabel = remaining === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
      return {
        id: `order-${order.id}`,
        date: order.orderDate,
        supplierName: order.Supplier?.name || "Supplier",
        type: "Purchase",
        referenceLabel: order.orderNumber,
        orderNumber: order.orderNumber,
        method: "On account",
        amount: Number(order.totalAmount),
        statusLabel,
        statusClass: `transaction-${statusLabel.toLowerCase()}`
      };
    });
    const paymentTransactions = transactions.map((record) => ({
      id: `transaction-${record.id}`,
      date: record.transactionDate,
      supplierName: record.Supplier?.name || "Supplier",
      type: record.type,
      referenceLabel: record.reference || record.PurchaseOrder?.orderNumber || "—",
      orderNumber: record.PurchaseOrder?.orderNumber || "",
      method: record.method,
      amount: Number(record.amount),
      statusLabel: record.type === "Payment" ? "Paid" : "Adjustment",
      statusClass: record.type === "Payment" ? "transaction-paid" : "transaction-adjustment"
    }));
    const transactionRows = [...purchaseTransactions, ...paymentTransactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((transaction, index) => ({
        ...transaction,
        transactionCode: `TXN-${String(index + 1).padStart(4, "0")}`,
        dateLabel: formatDate(transaction.date)
      }));
    const monthlyPurchases = orders.filter((order) =>
      String(order.orderDate).slice(0, 7) === monthKey
    );
    await renderPage(res, "transactions", "Supplier Transactions", {
      transactions: transactionRows,
      suppliers: suppliers.map((supplier) => supplier.get({ plain: true })),
      orders: orderOptions.filter((order) => order.remainingBalance > 0),
      supplierBalances,
      openBalanceCount: supplierBalances.filter((supplier) => supplier.balance > 0).length,
      outstandingBalance: money(supplierBalances.reduce((sum, supplier) => sum + supplier.balance, 0)),
      purchasesThisMonth: money(monthlyPurchases.reduce((sum, order) => sum + Number(order.totalAmount), 0)),
      monthlyPurchaseCount: monthlyPurchases.length,
      paymentsRecorded: money(transactions
        .filter((record) => record.type === "Payment")
        .reduce((sum, record) => sum + Number(record.amount), 0)),
      paymentCount: transactions.filter((record) => record.type === "Payment").length,
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.body.supplierId } });
    const amount = numericValue(req.body.amount);
    if (!supplier) return flashError(req, res, "Choose a valid supplier.", "/transactions?record=payment");
    if (!req.body.purchaseOrderId || !positiveNumber(req.body.amount) || !paymentMethods.includes(req.body.method) || !validDate(req.body.transactionDate)) {
      return flashError(req, res, "Choose an open purchase order and enter a valid payment amount, date, and method.", "/transactions?record=payment");
    }
    let paymentError;
    await sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.findOne({
        where: { id: req.body.purchaseOrderId, supplierId: supplier.id, status: { [Op.notIn]: ["Draft", "Cancelled"] } },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!order) {
        paymentError = "Choose an order that belongs to this supplier.";
        return;
      }
      const payments = await SupplierTransaction.sum("amount", {
        where: { purchaseOrderId: order.id, type: "Payment" },
        transaction
      });
      if (money(amount) > money(Number(order.totalAmount) - Number(payments || 0))) {
        paymentError = "The payment is greater than the order's remaining balance.";
        return;
      }
      await SupplierTransaction.create({
        supplierId: supplier.id,
        purchaseOrderId: order.id,
        transactionDate: req.body.transactionDate,
        type: "Payment",
        amount: money(amount),
        method: req.body.method,
        reference: req.body.reference?.trim() || null,
        notes: req.body.notes?.trim() || null
      }, { transaction });
    });
    if (paymentError) return flashError(req, res, paymentError, "/transactions?record=payment");
    flashSuccess(req, res, "Payment recorded.", "/transactions");
  } catch (error) {
    next(error);
  }
};

export const reportsPage = async (req, res, next) => {
  try {
    const [orders, transactions, suppliers] = await Promise.all([
      PurchaseOrder.findAll({
        where: { status: { [Op.notIn]: ["Draft", "Cancelled"] } },
        include: [
          Supplier,
          { model: PurchaseOrderItem, as: "items", include: [Supply] }
        ],
        order: [["orderDate", "DESC"]]
      }),
      SupplierTransaction.findAll({ where: { type: "Payment" }, include: [Supplier] }),
      Supplier.findAll({ where: { status: "Active" }, order: [["name", "ASC"]] })
    ]);
    const paidBySupplier = new Map();
    transactions.forEach((entry) => paidBySupplier.set(entry.supplierId, (paidBySupplier.get(entry.supplierId) || 0) + Number(entry.amount)));
    const supplierTotals = new Map();
    orders.forEach((order) => supplierTotals.set(order.supplierId, (supplierTotals.get(order.supplierId) || 0) + Number(order.totalAmount)));
    const balances = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      purchases: money(supplierTotals.get(supplier.id) || 0),
      paid: money(paidBySupplier.get(supplier.id) || 0),
      balance: money(Math.max(0, (supplierTotals.get(supplier.id) || 0) - (paidBySupplier.get(supplier.id) || 0))),
      paymentTerms: supplier.paymentTerms
    }));
    const categoryTotals = new Map();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const category = item.Supply?.category || "Other";
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + Number(item.lineTotal));
      });
    });
    const categorySpend = [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount: money(amount) }))
      .sort((left, right) => right.amount - left.amount);
    const maximumCategorySpend = Math.max(...categorySpend.map((entry) => entry.amount), 0);
    const formatAmount = (amount) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(amount);
    const openOrderCount = orders.filter((order) =>
      !["Completed", "Cancelled"].includes(order.status)
    ).length;
    await renderPage(res, "reports", "Supplier Reports", {
      totalPurchasesLabel: formatAmount(orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)),
      openOrderCount,
      activeSupplierCount: suppliers.length,
      categorySpend: categorySpend.map((entry) => ({
        ...entry,
        amountLabel: formatAmount(entry.amount),
        barWidth: maximumCategorySpend ? `${Math.max(3, entry.amount / maximumCategorySpend * 100)}%` : "0%"
      })),
      balances: balances.map((entry) => ({
        ...entry,
        purchasesLabel: formatAmount(entry.purchases),
        balanceLabel: formatAmount(entry.balance)
      })),
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

export const settingsPage = async (req, res, next) => {
  try {
    const entries = await AppSetting.findAll();
    const settings = Object.fromEntries(entries.map((entry) => [entry.settingKey, entry.settingValue]));
    await renderPage(res, "settings", "Settings", {
      workspaceSettings: {
        businessName: settings.businessName || "JAPZ GRILL & BISTRO",
        currency: settings.currency || "PHP",
        currencyLabel: (settings.currency || "PHP") === "USD" ? "US Dollar" : "Philippine Peso",
        currencySymbol: (settings.currency || "PHP") === "USD" ? "$" : "₱",
        isPHP: (settings.currency || "PHP") === "PHP",
        isUSD: (settings.currency || "PHP") === "USD",
        lowStockThreshold: settings.lowStockThreshold || "5",
        contactEmail: settings.contactEmail || "",
        profileDescription: settings.contactEmail || "Supplier management workspace"
      },
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

export const exportSettingsData = async (req, res, next) => {
  try {
    const [settings, suppliers, supplies, supplierSupplies, orders, deliveries, transactions] = await Promise.all([
      AppSetting.findAll({ order: [["settingKey", "ASC"]] }),
      Supplier.findAll({ order: [["id", "ASC"]] }),
      Supply.findAll({ order: [["id", "ASC"]] }),
      SupplierSupply.findAll({ order: [["supplierId", "ASC"], ["supplyId", "ASC"]] }),
      PurchaseOrder.findAll({
        include: [
          Supplier,
          { model: PurchaseOrderItem, as: "items", include: [Supply] }
        ],
        order: [["id", "ASC"]]
      }),
      Delivery.findAll({
        include: [
          PurchaseOrder,
          { model: DeliveryItem, as: "items", include: [PurchaseOrderItem] }
        ],
        order: [["id", "ASC"]]
      }),
      SupplierTransaction.findAll({
        include: [Supplier, PurchaseOrder],
        order: [["id", "ASC"]]
      })
    ]);
    const toPlain = (records) => records.map((record) => record.get({ plain: true }));
    const filename = `supplier-system-export-${today()}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.type("application/json").send(JSON.stringify({
      exportedAt: new Date().toISOString(),
      settings: toPlain(settings),
      suppliers: toPlain(suppliers),
      supplies: toPlain(supplies),
      supplierSupplies: toPlain(supplierSupplies),
      purchaseOrders: toPlain(orders),
      deliveries: toPlain(deliveries),
      transactions: toPlain(transactions)
    }, null, 2));
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const businessName = req.body.businessName?.trim();
    const currency = req.body.currency?.trim();
    const contactEmail = req.body.contactEmail?.trim() || "";
    const lowStockThreshold = numericValue(req.body.lowStockThreshold);
    if (!businessName || businessName.length > 120 || !["PHP", "USD"].includes(currency)
      || !nonNegativeNumber(lowStockThreshold) || lowStockThreshold > 100000
      || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
      return flashError(req, res, "Check the business name, currency, email, and stock threshold.", "/settings");
    }
    await sequelize.transaction(async (transaction) => {
      for (const [settingKey, settingValue] of Object.entries({
        businessName,
        currency,
        contactEmail,
        lowStockThreshold: String(lowStockThreshold)
      })) {
        await AppSetting.upsert({ settingKey, settingValue }, { transaction });
      }
    });
    flashSuccess(req, res, "Settings saved.", "/settings");
  } catch (error) {
    next(error);
  }
};
