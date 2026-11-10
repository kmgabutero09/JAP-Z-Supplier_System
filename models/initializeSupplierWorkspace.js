import { sequelize } from "./db.js";
import {
  AppSetting,
  Delivery,
  DeliveryItem,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierTransaction,
  Supply,
  SupplierSupply
} from "./index.js";

const starterSuppliers = [
  {
    legacyName: "Northfield Meat & Poultry Trading",
    name: "Balintawak Prime Meats Trading",
    contactPerson: "Sales Department",
    phone: "0917-555-0101",
    email: null,
    address: "Balintawak Market Complex, Quezon City, Metro Manila",
    category: "Meat & Poultry",
    paymentTerms: "COD",
    notes: "Fresh beef, chicken, and bacon deliveries for daily kitchen operations."
  },
  {
    legacyName: "Green Basket Fresh Produce",
    name: "Rizal Valley Fresh Produce",
    contactPerson: "Wholesale Accounts",
    phone: "0917-555-0102",
    email: null,
    address: "Pasig Mega Market, Pasig City, Metro Manila",
    category: "Produce",
    paymentTerms: "7 days",
    notes: "Regular delivery of vegetables and fresh produce."
  },
  {
    legacyName: "Daily Dough Bakery Supply",
    name: "Marikina Bakehouse Foodservice",
    contactPerson: "Foodservice Sales",
    phone: "0917-555-0103",
    email: null,
    address: "Shoe Avenue, Marikina City, Metro Manila",
    category: "Dry Goods",
    paymentTerms: "15 days",
    notes: "Burger buns, pasta, and dry kitchen ingredients."
  },
  {
    legacyName: "Isla Beverage & Pantry Depot",
    name: "Metro Pantry & Beverage Supply",
    contactPerson: "Business Accounts",
    phone: "0917-555-0104",
    email: null,
    address: "Mandaluyong Food Terminal, Mandaluyong City, Metro Manila",
    category: "Beverages",
    paymentTerms: "COD",
    notes: "Beverage concentrates, cooking oil, and pantry essentials."
  }
];

const stockCatalog = [
  { key: "ground-beef", name: "Ground Beef", category: "Meat & Poultry", unit: "kg", unitCost: 380, reorderLevel: 8, supplier: 0 },
  { key: "chicken-breast", name: "Chicken Breast", category: "Meat & Poultry", unit: "kg", unitCost: 255, reorderLevel: 8, supplier: 0 },
  { key: "smoked-bacon", name: "Smoked Bacon", category: "Meat & Poultry", unit: "kg", unitCost: 420, reorderLevel: 4, supplier: 0 },
  { key: "lettuce", name: "Iceberg Lettuce", category: "Produce", unit: "kg", unitCost: 145, reorderLevel: 5, supplier: 1 },
  { key: "tomatoes", name: "Fresh Tomatoes", category: "Produce", unit: "kg", unitCost: 110, reorderLevel: 5, supplier: 1 },
  { key: "potatoes", name: "Fresh Potatoes", category: "Produce", unit: "kg", unitCost: 82, reorderLevel: 10, supplier: 1 },
  { key: "burger-buns", name: "Burger Buns", category: "Dry Goods", unit: "pcs", unitCost: 9.5, reorderLevel: 40, supplier: 2 },
  { key: "spaghetti", name: "Spaghetti Pasta", category: "Dry Goods", unit: "kg", unitCost: 118, reorderLevel: 4, supplier: 2 },
  { key: "cheddar", name: "Cheddar Cheese", category: "Dairy", unit: "kg", unitCost: 345, reorderLevel: 3, supplier: 2 },
  { key: "cooking-oil", name: "Cooking Oil", category: "Dry Goods", unit: "L", unitCost: 168, reorderLevel: 5, supplier: 3 },
  { key: "iced-tea-concentrate", name: "Iced Tea Concentrate", category: "Beverages", unit: "bottle", unitCost: 285, reorderLevel: 4, supplier: 3 },
  { key: "burger-boxes", name: "Burger Takeout Boxes", category: "Packaging", unit: "pcs", unitCost: 4.25, reorderLevel: 100, supplier: 3 }
];

const dateOffset = (offset) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const orderPlans = [
  {
    suffix: "MEAT-01",
    supplier: 0,
    orderOffset: -8,
    expectedOffset: -7,
    status: "Completed",
    notes: "Weekly meat replenishment.",
    items: [{ key: "ground-beef", quantity: 8 }, { key: "chicken-breast", quantity: 6 }, { key: "smoked-bacon", quantity: 3 }],
    delivery: { offset: -7, receivedBy: "Kitchen Receiving", lines: [{ key: "ground-beef", quantity: 8 }, { key: "chicken-breast", quantity: 6 }, { key: "smoked-bacon", quantity: 3 }] },
    payment: { fraction: 1, method: "Bank Transfer", suffix: "001", offset: -7 }
  },
  {
    suffix: "PROD-01",
    supplier: 1,
    orderOffset: -6,
    expectedOffset: -5,
    status: "Completed",
    notes: "Fresh vegetables for burger and side-dish preparation.",
    items: [{ key: "lettuce", quantity: 12 }, { key: "tomatoes", quantity: 8 }, { key: "potatoes", quantity: 20 }],
    delivery: { offset: -5, receivedBy: "Kitchen Receiving", lines: [{ key: "lettuce", quantity: 12 }, { key: "tomatoes", quantity: 8 }, { key: "potatoes", quantity: 20 }] },
    payment: { fraction: 1, method: "GCash", suffix: "002", offset: -5 }
  },
  {
    suffix: "PANTRY-01",
    supplier: 2,
    orderOffset: -4,
    expectedOffset: -3,
    status: "Completed",
    notes: "Bakery and pasta stock replenishment.",
    items: [{ key: "burger-buns", quantity: 100 }, { key: "spaghetti", quantity: 5 }, { key: "cheddar", quantity: 3 }],
    delivery: { offset: -3, receivedBy: "Kitchen Receiving", lines: [{ key: "burger-buns", quantity: 100 }, { key: "spaghetti", quantity: 5 }, { key: "cheddar", quantity: 3 }] },
    payment: { fraction: 0.75, method: "Bank Transfer", suffix: "003", offset: -3 }
  },
  {
    suffix: "MEAT-02",
    supplier: 0,
    orderOffset: -2,
    expectedOffset: 2,
    status: "Partially Delivered",
    notes: "Midweek meat order; balance quantity expected on scheduled delivery.",
    items: [{ key: "ground-beef", quantity: 10 }, { key: "chicken-breast", quantity: 10 }],
    delivery: { offset: -1, receivedBy: "Kitchen Receiving", remarks: "Partial delivery; remaining quantities are still expected.", lines: [{ key: "ground-beef", quantity: 4 }, { key: "chicken-breast", quantity: 5, damaged: 0.5, remarks: "One pack had damaged packaging." }] }
  },
  {
    suffix: "PROD-02",
    supplier: 1,
    orderOffset: -1,
    expectedOffset: 3,
    status: "Sent to Supplier",
    notes: "Scheduled fresh produce replenishment.",
    items: [{ key: "lettuce", quantity: 10 }, { key: "potatoes", quantity: 15 }]
  },
  {
    suffix: "PANTRY-02",
    supplier: 3,
    orderOffset: 0,
    expectedOffset: 5,
    status: "Approved",
    notes: "Pantry and beverage stock replenishment.",
    items: [{ key: "cooking-oil", quantity: 8 }, { key: "iced-tea-concentrate", quantity: 6 }, { key: "burger-boxes", quantity: 200 }]
  }
];

const legacySupplierNames = starterSuppliers.map(({ legacyName }) => legacyName);

export const initializeSupplierWorkspace = async () => {
  const currentSuppliers = await Supplier.findAll({ attributes: ["id", "name"] });
  const isEmptyWorkspace = currentSuppliers.length === 0;
  const isLegacyStarterWorkspace = currentSuppliers.length === starterSuppliers.length
    && currentSuppliers.every((supplier) => legacySupplierNames.includes(supplier.name));
  if (!isEmptyWorkspace && !isLegacyStarterWorkspace) return 0;

  const [supplyCount, orderCount, deliveryCount, transactionCount] = await Promise.all([
    Supply.count(),
    PurchaseOrder.count(),
    Delivery.count(),
    SupplierTransaction.count()
  ]);
  if (supplyCount || orderCount || deliveryCount || transactionCount) return 0;

  return sequelize.transaction(async (transaction) => {
    const suppliersByName = new Map(currentSuppliers.map((supplier) => [supplier.name, supplier]));
    const suppliers = [];
    for (const data of starterSuppliers) {
      const { legacyName, ...supplierData } = data;
      const existing = suppliersByName.get(legacyName);
      if (existing) {
        await existing.update(supplierData, { transaction });
        suppliers.push(existing);
      } else {
        suppliers.push(await Supplier.create(supplierData, { transaction }));
      }
    }

    const suppliesByKey = new Map();
    for (const { key, name, category, unit, unitCost, reorderLevel, supplier } of stockCatalog) {
      const supply = await Supply.create({
        name,
        category,
        unit,
        unitCost,
        stockQuantity: 0,
        reorderLevel
      }, { transaction });
      await SupplierSupply.create({
        supplierId: suppliers[supplier].id,
        supplyId: supply.id
      }, { transaction });
      suppliesByKey.set(key, supply);
    }

    const createdOrders = [];
    const createdOrderItems = new Map();
    for (const plan of orderPlans) {
      const orderDate = dateOffset(plan.orderOffset);
      const orderItems = plan.items.map(({ key, quantity }) => {
        const supply = suppliesByKey.get(key);
        const unitPrice = Number(supply.unitCost);
        return {
          supplyId: supply.id,
          quantity,
          unit: supply.unit,
          unitPrice,
          lineTotal: Math.round(quantity * unitPrice * 100) / 100
        };
      });
      const totalAmount = Math.round(orderItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
      const order = await PurchaseOrder.create({
        orderNumber: `JG-${orderDate.replaceAll("-", "")}-${plan.suffix}`,
        supplierId: suppliers[plan.supplier].id,
        orderDate,
        expectedDate: dateOffset(plan.expectedOffset),
        status: plan.status,
        totalAmount,
        notes: plan.notes
      }, { transaction });
      const savedItems = [];
      for (const item of orderItems) {
        savedItems.push(await PurchaseOrderItem.create({ ...item, purchaseOrderId: order.id }, { transaction }));
      }
      createdOrders.push({ order, plan, totalAmount });
      createdOrderItems.set(order.id, new Map(savedItems.map((item) => [item.supplyId, item])));
    }

    const stockReceived = new Map();
    for (const { order, plan, totalAmount } of createdOrders) {
      if (plan.delivery) {
        const delivery = await Delivery.create({
          purchaseOrderId: order.id,
          deliveryDate: dateOffset(plan.delivery.offset),
          receivedBy: plan.delivery.receivedBy,
          remarks: plan.delivery.remarks || null
        }, { transaction });
        const itemsBySupply = createdOrderItems.get(order.id);
        for (const line of plan.delivery.lines) {
          const supply = suppliesByKey.get(line.key);
          const orderItem = itemsBySupply.get(supply.id);
          await DeliveryItem.create({
            deliveryId: delivery.id,
            purchaseOrderItemId: orderItem.id,
            quantityReceived: line.quantity,
            quantityDamaged: line.damaged || 0,
            remarks: line.remarks || null
          }, { transaction });
          stockReceived.set(supply.id, (stockReceived.get(supply.id) || 0) + line.quantity - (line.damaged || 0));
        }
      }

      if (plan.payment) {
        const transactionDate = dateOffset(plan.payment.offset ?? Math.min(plan.orderOffset + 1, 0));
        await SupplierTransaction.create({
          supplierId: suppliers[plan.supplier].id,
          purchaseOrderId: order.id,
          transactionDate,
          type: "Payment",
          amount: Math.round(totalAmount * plan.payment.fraction * 100) / 100,
          method: plan.payment.method,
          reference: `JG-PAY-${transactionDate.replaceAll("-", "")}-${plan.payment.suffix}`,
          notes: plan.payment.fraction === 1 ? "Order settled." : "Partial payment; remaining balance is payable under agreed terms."
        }, { transaction });
      }
    }

    for (const supply of suppliesByKey.values()) {
      await supply.update({ stockQuantity: stockReceived.get(supply.id) || 0 }, { transaction });
    }

    await AppSetting.bulkCreate([
      { settingKey: "businessName", settingValue: "JAPZ GRILL & BISTRO" },
      { settingKey: "currency", settingValue: "PHP" },
      { settingKey: "lowStockThreshold", settingValue: "5" }
    ], { transaction, ignoreDuplicates: true });

    return suppliers.length;
  });
};
