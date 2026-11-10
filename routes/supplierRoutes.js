import express from "express";
import {
  createSupplier,
  dashboardPage,
  setSupplierStatus,
  supplierDetailsPage,
  suppliersPage,
  updateSupplier
} from "../controllers/supplierController.js";
import { createDelivery, deliveriesPage } from "../controllers/deliveryController.js";
import { createPurchaseOrder, purchaseOrdersPage, updatePurchaseOrderStatus } from "../controllers/purchaseOrderController.js";
import {
  reportsPage,
  exportSettingsData,
  settingsPage,
  transactionsPage,
  updateSettings,
  createTransaction
} from "../controllers/transactionController.js";
import { createSupply, productsPage, setSupplyStatus, updateSupply } from "../controllers/supplyController.js";

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

router.get("/dashboard", requireAuth, dashboardPage);
router.get("/suppliers", requireAuth, suppliersPage);
router.get("/suppliers/:id", requireAuth, supplierDetailsPage);
router.post("/suppliers", requireAuth, createSupplier);
router.post("/suppliers/:id/update", requireAuth, updateSupplier);
router.post("/suppliers/:id/status", requireAuth, setSupplierStatus);

router.get("/products", requireAuth, productsPage);
router.post("/products", requireAuth, createSupply);
router.post("/products/:id/update", requireAuth, updateSupply);
router.post("/products/:id/status", requireAuth, setSupplyStatus);

router.get("/orders", requireAuth, purchaseOrdersPage);
router.post("/orders", requireAuth, createPurchaseOrder);
router.post("/orders/:id/status", requireAuth, updatePurchaseOrderStatus);

router.get("/deliveries", requireAuth, deliveriesPage);
router.post("/deliveries", requireAuth, createDelivery);

router.get("/transactions", requireAuth, transactionsPage);
router.post("/transactions", requireAuth, createTransaction);
router.get("/reports", requireAuth, reportsPage);
router.get("/settings", requireAuth, settingsPage);
router.get("/settings/export", requireAuth, exportSettingsData);
router.post("/settings", requireAuth, updateSettings);

export default router;
