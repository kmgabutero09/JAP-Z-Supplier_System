import { Op } from "sequelize";
import {
  AppSetting,
  Delivery,
  DeliveryItem,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierTransaction,
  Supply,
  Supplier
} from "../models/index.js";
import { supplyCategories } from "../models/SupplyCategory.js";

const supplierFields = [
  "name",
  "contactPerson",
  "phone",
  "email",
  "address",
  "category",
  "paymentTerms",
  "notes"
];

const supplierData = (body) => Object.fromEntries(
  supplierFields.map((field) => [field, body[field]?.trim() || null])
);

export const dashboardPage = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
    const nextMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)).toISOString().slice(0, 10);
    const firstMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1));
    const purchasingWindowStart = firstMonth.toISOString().slice(0, 10);
    const [suppliers, pendingOrders, deliveriesThisMonth, purchases, payments, recentOrders, upcomingOrders, recentSuppliers, recentDeliveries, recentPayments, monthlyOrders, lowStockRecords, currency, businessNameSetting] = await Promise.all([
      Supplier.findAll({ attributes: ["id", "name", "status", "category"] }),
      PurchaseOrder.count({ where: { status: { [Op.in]: ["Pending", "Approved", "Sent to Supplier", "Partially Delivered"] } } }),
      Delivery.count({ where: { deliveryDate: { [Op.gte]: monthStart, [Op.lt]: nextMonthStart } } }),
      PurchaseOrder.sum("totalAmount", { where: { status: { [Op.notIn]: ["Draft", "Cancelled"] } } }),
      SupplierTransaction.sum("amount", { where: { type: "Payment" } }),
      PurchaseOrder.findAll({ include: [Supplier], order: [["createdAt", "DESC"]], limit: 4 }),
      PurchaseOrder.findAll({
        where: {
          status: { [Op.in]: ["Sent to Supplier", "Partially Delivered"] },
          expectedDate: { [Op.gte]: now.toISOString().slice(0, 10) }
        },
        include: [Supplier],
        order: [["expectedDate", "ASC"]],
        limit: 5
      }),
      Supplier.findAll({ order: [["createdAt", "DESC"]], limit: 5 }),
      Delivery.findAll({ include: [{ model: PurchaseOrder, include: [Supplier] }], order: [["deliveryDate", "DESC"], ["createdAt", "DESC"]], limit: 8 }),
      SupplierTransaction.findAll({ where: { type: "Payment" }, include: [Supplier], order: [["transactionDate", "DESC"], ["createdAt", "DESC"]], limit: 8 }),
      PurchaseOrder.findAll({
        attributes: ["orderDate", "totalAmount"],
        where: {
          orderDate: { [Op.gte]: purchasingWindowStart, [Op.lt]: nextMonthStart },
          status: { [Op.notIn]: ["Draft", "Cancelled"] }
        }
      }),
      Supply.findAll({
        where: { status: "Active" },
        attributes: ["name", "unit", "stockQuantity", "reorderLevel"],
        include: [{ model: Supplier, as: "Suppliers", attributes: ["name"], through: { attributes: [] } }],
        order: [["name", "ASC"]]
      }),
      AppSetting.findByPk("currency"),
      AppSetting.findByPk("businessName")
    ]);
    const activeCount = suppliers.filter((supplier) => supplier.status === "Active").length;
    const categoryCount = new Set(suppliers.map((supplier) => supplier.category)).size;
    const formatDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date);
    };
    const activities = [
      ...recentSuppliers.map((supplier) => ({
        date: supplier.createdAt,
        label: "Supplier added",
        detail: supplier.name,
        href: `/suppliers/${supplier.id}`,
        kind: "supplier"
      })),
      ...recentOrders.map((order) => ({
        date: order.createdAt,
        label: "Purchase order created",
        detail: `${order.orderNumber} · ${order.Supplier?.name || "Supplier"} · ${order.status}`,
        href: "/orders",
        kind: "order"
      })),
      ...recentDeliveries.map((delivery) => ({
        date: delivery.createdAt,
        label: "Delivery recorded",
        detail: `${delivery.PurchaseOrder?.orderNumber || "Purchase order"} · ${delivery.PurchaseOrder?.Supplier?.name || "Supplier"}`,
        href: "/deliveries",
        kind: "delivery"
      })),
      ...recentPayments.map((payment) => ({
        date: payment.createdAt,
        label: "Supplier payment recorded",
        detail: `${payment.Supplier?.name || "Supplier"} · ${currency?.settingValue === "USD" ? "$" : "₱"}${payment.amount}`,
        href: "/transactions",
        kind: "payment"
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
      .map((activity) => ({ ...activity, dateLabel: formatDate(activity.date) }));

    const monthFormatter = new Intl.DateTimeFormat("en-PH", { month: "short" });
    const monthlyTotals = new Map();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const month = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset, 1));
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      monthlyTotals.set(key, {
        key,
        label: monthFormatter.format(month),
        total: 0
      });
    }
    monthlyOrders.forEach((order) => {
      const key = String(order.orderDate).slice(0, 7);
      const month = monthlyTotals.get(key);
      if (month) month.total += Number(order.totalAmount);
    });
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyPurchasing = [...monthlyTotals.values()].map((month) => ({
      ...month,
      total: Math.round(month.total * 100) / 100,
      isCurrentMonth: month.key === currentMonthKey
    }));
    const highestMonthlyTotal = Math.max(...monthlyPurchasing.map((month) => month.total), 0);
    monthlyPurchasing.forEach((month) => {
      month.barHeight = highestMonthlyTotal ? Math.max(5, Math.round(month.total / highestMonthlyTotal * 100)) : 5;
    });

    const lowStockSupplies = lowStockRecords
      .filter((supply) => Number(supply.reorderLevel) > 0 && Number(supply.stockQuantity) <= Number(supply.reorderLevel))
      .map((supply) => ({
        ...supply.get({ plain: true }),
        supplierName: supply.Suppliers.map((supplier) => supplier.name).join(", ") || "No supplier assigned"
      }))
      .slice(0, 5);

    res.render("supplier/dashboard.xian", {
      title: "Dashboard",
      supplierStyles: true,
      operationsStyles: true,
      currencySymbol: currency?.settingValue === "USD" ? "$" : "₱",
      businessName: businessNameSetting?.settingValue || "JAPZ GRILL & BISTRO",
      navDashboard: true,
      totalSuppliers: suppliers.length,
      activeSuppliers: activeCount,
      inactiveSuppliers: suppliers.length - activeCount,
      categoryCount,
      currentYear: now.getFullYear(),
      pendingOrders,
      deliveriesThisMonth,
      outstandingPayments: Math.max(0, Number(purchases || 0) - Number(payments || 0)),
      recentOrders: recentOrders.map((order) => ({
        ...order.get({ plain: true }),
        supplierName: order.Supplier?.name || "Supplier",
        dueDateLabel: order.expectedDate ? formatDate(order.expectedDate) : "Not scheduled",
        statusClass: `status-${order.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      })),
      upcomingOrders: upcomingOrders.map((order) => ({
        ...order.get({ plain: true }),
        supplierName: order.Supplier?.name || "Supplier"
      })),
      nextDeliveryLabel: upcomingOrders[0]?.expectedDate ? formatDate(upcomingOrders[0].expectedDate) : "",
      recentActivities: activities,
      lowStockSupplies,
      monthlyPurchasing,
      currentMonthPurchases: monthlyPurchasing.at(-1)?.total || 0,
      successMessage: req.flash("success_msg")[0],
      errorMessage: req.flash("error_msg")[0]
    });
  } catch (error) {
    next(error);
  }
};

export const suppliersPage = async (req, res, next) => {
  try {
    const [suppliers, businessNameSetting] = await Promise.all([
      Supplier.findAll({ order: [["createdAt", "DESC"]] }),
      AppSetting.findByPk("businessName")
    ]);
    const activeCount = suppliers.filter((supplier) => supplier.status === "Active").length;

    res.render("supplier/suppliers.xian", {
      title: "Suppliers",
      supplierStyles: true,
      navSuppliers: true,
      businessName: businessNameSetting?.settingValue || "JAPZ GRILL & BISTRO",
      categories: supplyCategories,
      suppliers: suppliers.map((supplier) => ({
        ...supplier.get({ plain: true }),
        supplierCode: `SUP-${String(supplier.id).padStart(4, "0")}`,
        initials: supplier.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        isActive: supplier.status === "Active"
      })),
      totalSuppliers: suppliers.length,
      activeSuppliers: activeCount,
      inactiveSuppliers: suppliers.length - activeCount,
      categoryCount: new Set(suppliers.map((supplier) => supplier.category)).size,
      successMessage: req.flash("success_msg")[0],
      errorMessage: req.flash("error_msg")[0]
    });
  } catch (error) {
    next(error);
  }
};

export const supplierDetailsPage = async (req, res, next) => {
  try {
    const [supplier, currency, businessNameSetting] = await Promise.all([
      Supplier.findByPk(req.params.id, {
        include: [
          { model: Supply, as: "Supplies" },
          {
            model: PurchaseOrder,
            include: [
              { model: PurchaseOrderItem, as: "items", include: [Supply] },
              {
                model: Delivery,
                include: [{
                  model: DeliveryItem,
                  as: "items",
                  include: [{ model: PurchaseOrderItem, include: [Supply] }]
                }]
              }
            ]
          },
          { model: SupplierTransaction }
        ]
      }),
      AppSetting.findByPk("currency"),
      AppSetting.findByPk("businessName")
    ]);
    if (!supplier) {
      req.flash("error_msg", "Supplier not found.");
      return res.redirect("/suppliers");
    }

    const supplierOrders = supplier.PurchaseOrders || [];
    const transactions = supplier.SupplierTransactions || [];
    const paidByOrder = new Map();
    transactions.filter((record) => record.type === "Payment" && record.purchaseOrderId).forEach((record) => {
      paidByOrder.set(record.purchaseOrderId, (paidByOrder.get(record.purchaseOrderId) || 0) + Number(record.amount));
    });
    const orders = supplierOrders.map((order) => ({
      ...order.get({ plain: true }),
      itemsLabel: order.items.map((item) => `${item.Supply?.name || "Supply"} × ${item.quantity} ${item.unit}`).join(", "),
      amountPaid: Number(paidByOrder.get(order.id) || 0),
      balance: ["Draft", "Cancelled"].includes(order.status) ? 0 : Math.max(0, Number(order.totalAmount) - Number(paidByOrder.get(order.id) || 0))
    }));
    const deliveryHistory = supplierOrders.flatMap((order) => (order.Deliveries || []).map((delivery) => ({
      ...delivery.get({ plain: true }),
      orderNumber: order.orderNumber,
      itemsLabel: delivery.items.map((item) => {
        const orderItem = item.PurchaseOrderItem;
        const damage = Number(item.quantityDamaged) > 0 ? ` (${item.quantityDamaged} damaged)` : "";
        const note = item.remarks ? ` — ${item.remarks}` : "";
        return `${orderItem?.Supply?.name || "Supply"}: ${item.quantityReceived} ${orderItem?.unit || ""}${damage}${note}`;
      }).join("; ")
    })));
    const totalPurchases = orders.filter((order) => !["Draft", "Cancelled"].includes(order.status))
      .reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const totalPaid = transactions.filter((record) => record.type === "Payment")
      .reduce((sum, record) => sum + Number(record.amount), 0);

    res.render("supplier/supplier-details.xian", {
      title: supplier.name,
      supplierStyles: true,
      operationsStyles: true,
      currencySymbol: currency?.settingValue === "USD" ? "$" : "₱",
      businessName: businessNameSetting?.settingValue || "JAPZ GRILL & BISTRO",
      supplier: {
        ...supplier.get({ plain: true }),
        supplierCode: `SUP-${String(supplier.id).padStart(4, "0")}`,
        initials: supplier.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        isActive: supplier.status === "Active"
      },
      supplies: supplier.Supplies.map((supply) => supply.get({ plain: true })),
      orders,
      deliveryHistory,
      transactions: transactions.map((record) => ({
        ...record.get({ plain: true }),
        orderNumber: orders.find((order) => order.id === record.purchaseOrderId)?.orderNumber
      })),
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      outstandingBalance: Math.round(Math.max(0, totalPurchases - totalPaid) * 100) / 100,
      successMessage: req.flash("success_msg")[0],
      errorMessage: req.flash("error_msg")[0]
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const data = supplierData(req.body);
    if (req.body.status && !["Active", "Inactive"].includes(req.body.status)) {
      req.flash("error_msg", "Choose a valid supplier status.");
      return res.redirect("/suppliers");
    }
    if (req.body.status) data.status = req.body.status;
    await Supplier.create(data);
    req.flash("success_msg", "Supplier added successfully.");
    res.redirect("/suppliers");
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      req.flash("error_msg", "Please check the supplier details and try again.");
      return res.redirect("/suppliers");
    }
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) {
      req.flash("error_msg", "That supplier could not be found.");
      return res.redirect("/suppliers");
    }
    const updates = supplierData(req.body);
    if (req.body.status) updates.status = req.body.status;
    await supplier.update(updates);
    req.flash("success_msg", "Supplier details updated.");
    res.redirect("/suppliers");
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      req.flash("error_msg", "Please check the supplier details and try again.");
      return res.redirect("/suppliers");
    }
    next(error);
  }
};

export const setSupplierStatus = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) {
      req.flash("error_msg", "That supplier could not be found.");
      return res.redirect("/suppliers");
    }
    if (!["Active", "Inactive"].includes(req.body.status)) {
      req.flash("error_msg", "Choose a valid supplier status.");
      return res.redirect("/suppliers");
    }
    await supplier.update({ status: req.body.status });
    req.flash("success_msg", req.body.status === "Inactive" ? "Supplier archived." : "Supplier reactivated.");
    res.redirect("/suppliers");
  } catch (error) {
    next(error);
  }
};
