import { Op } from "sequelize";
import { sequelize } from "../models/db.js";
import { Delivery, DeliveryItem, PurchaseOrder, PurchaseOrderItem, Supplier, Supply } from "../models/index.js";
import { flashError, flashSuccess, nonNegativeNumber, numericValue, positiveNumber, renderPage, today, validDate, withFlash } from "./procurementControllerUtils.js";

export const deliveriesPage = async (req, res, next) => {
  try {
    const formatDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
    };
    const [deliveries, openOrders] = await Promise.all([
      Delivery.findAll({
        include: [
          { model: PurchaseOrder, include: [Supplier] },
          { model: DeliveryItem, as: "items", include: [{ model: PurchaseOrderItem, include: [Supply] }] }
        ],
        order: [["deliveryDate", "DESC"], ["createdAt", "DESC"]]
      }),
      PurchaseOrder.findAll({
        where: { status: { [Op.in]: ["Sent to Supplier", "Partially Delivered"] } },
        include: [{ model: Supplier }, { model: PurchaseOrderItem, as: "items", include: [Supply] }],
        order: [["expectedDate", "ASC"]]
      })
    ]);
    const openOrderData = await Promise.all(openOrders.map(async (order) => ({
      ...order.get({ plain: true }),
      supplierName: order.Supplier.name,
      items: await Promise.all(order.items.map(async (item) => {
        const receivedToDate = Number(await DeliveryItem.sum("quantityReceived", {
          where: { purchaseOrderItemId: item.id }
        }) || 0);
        return {
          ...item.get({ plain: true }),
          supplyName: item.Supply?.name,
          receivedToDate,
          remainingQuantity: Math.max(0, Number(item.quantity) - receivedToDate)
        };
      }))
    })));
    await renderPage(res, "deliveries", "Deliveries", {
      deliveries: deliveries.map((delivery) => {
        const isPartial = delivery.items.some((item) =>
          Number(item.quantityReceived) < Number(item.PurchaseOrderItem?.quantity || 0)
        );
        return {
          ...delivery.get({ plain: true }),
          deliveryCode: `DLV-${String(delivery.id).padStart(3, "0")}`,
          orderNumber: delivery.PurchaseOrder?.orderNumber,
          supplierName: delivery.PurchaseOrder?.Supplier?.name,
          deliveredDateLabel: formatDate(delivery.deliveryDate),
          statusLabel: isPartial ? "Partial" : "Received",
          statusClass: isPartial ? "status-partial" : "status-received",
          itemsLabel: delivery.items.map((item) => {
          const orderItem = item.PurchaseOrderItem;
          const itemName = orderItem?.Supply?.name || "Supply";
          return `${itemName} (${item.quantityReceived}/${orderItem?.quantity || "?"})`;
          }).join(", ")
        };
      }),
      openOrders: openOrderData,
      ...withFlash(req)
    });
  } catch (error) {
    next(error);
  }
};

export const createDelivery = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByPk(req.body.purchaseOrderId, {
      include: [{ model: PurchaseOrderItem, as: "items", include: [Supply] }]
    });
    if (!order || !["Sent to Supplier", "Partially Delivered"].includes(order.status)) {
      return flashError(req, res, "Choose an order that has been sent and is still awaiting items.", "/deliveries?record=1");
    }
    if (!validDate(req.body.deliveryDate) || !req.body.receivedBy?.trim()) {
      return flashError(req, res, "Enter the delivery date and the name of the receiver.", "/deliveries?record=1");
    }
    const itemIds = Array.isArray(req.body.itemId) ? req.body.itemId : [req.body.itemId];
    const received = Array.isArray(req.body.quantityReceived) ? req.body.quantityReceived : [req.body.quantityReceived];
    const damaged = Array.isArray(req.body.quantityDamaged) ? req.body.quantityDamaged : [req.body.quantityDamaged];
    const lineRemarks = Array.isArray(req.body.itemRemarks) ? req.body.itemRemarks : [req.body.itemRemarks];
    const lines = [];
    for (let index = 0; index < itemIds.length; index += 1) {
      if (!itemIds[index] || !positiveNumber(received[index])) continue;
      const damagedQuantity = damaged[index] === "" || damaged[index] === undefined ? 0 : numericValue(damaged[index]);
      if (!nonNegativeNumber(damagedQuantity) || damagedQuantity > numericValue(received[index])) {
        return flashError(req, res, "Damaged quantity must be zero or less than the quantity received.", "/deliveries?record=1");
      }
      const orderItem = order.items.find((item) => Number(item.id) === Number(itemIds[index]));
      if (!orderItem) return flashError(req, res, "A delivered item does not belong to this purchase order.", "/deliveries?record=1");
      lines.push({ orderItem, quantityReceived: numericValue(received[index]), quantityDamaged: damagedQuantity, remarks: lineRemarks[index]?.trim() || null });
    }
    if (!lines.length) return flashError(req, res, "Enter at least one delivered quantity.", "/deliveries?record=1");

    await sequelize.transaction(async (transaction) => {
      const lockedOrder = await PurchaseOrder.findByPk(order.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!lockedOrder || !["Sent to Supplier", "Partially Delivered"].includes(lockedOrder.status)) {
        throw new Error("DELIVERY_ORDER_CLOSED");
      }
      const orderItems = await PurchaseOrderItem.findAll({
        where: { purchaseOrderId: lockedOrder.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const delivery = await Delivery.create({
        purchaseOrderId: lockedOrder.id,
        deliveryDate: req.body.deliveryDate,
        receivedBy: req.body.receivedBy.trim(),
        remarks: req.body.remarks?.trim() || null
      }, { transaction });
      for (const line of lines) {
        const orderItem = orderItems.find((item) => Number(item.id) === Number(line.orderItem.id));
        if (!orderItem) throw new Error("DELIVERY_ITEM_NOT_IN_ORDER");
        const previous = await DeliveryItem.sum("quantityReceived", {
          where: { purchaseOrderItemId: orderItem.id },
          transaction
        });
        if (Number(previous || 0) + line.quantityReceived > Number(orderItem.quantity)) {
          throw new Error("DELIVERY_EXCEEDS_ORDER");
        }
        await DeliveryItem.create({
          deliveryId: delivery.id,
          purchaseOrderItemId: orderItem.id,
          quantityReceived: line.quantityReceived,
          quantityDamaged: line.quantityDamaged,
          remarks: line.remarks
        }, { transaction });
        const stockSupply = await Supply.findByPk(orderItem.supplyId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!stockSupply) throw new Error("DELIVERY_SUPPLY_NOT_FOUND");
        await stockSupply.increment({ stockQuantity: line.quantityReceived - line.quantityDamaged }, { transaction });
      }
      const itemTotals = await Promise.all(orderItems.map(async (item) => ({
        ordered: Number(item.quantity),
        received: Number(await DeliveryItem.sum("quantityReceived", { where: { purchaseOrderItemId: item.id }, transaction }) || 0)
      })));
      const completed = itemTotals.every((item) => item.received >= item.ordered);
      const partiallyDelivered = itemTotals.some((item) => item.received > 0);
      await lockedOrder.update({
        status: completed ? "Completed" : partiallyDelivered ? "Partially Delivered" : "Sent to Supplier"
      }, { transaction });
    });
    flashSuccess(req, res, "Delivery recorded. Stock and order progress updated.", "/deliveries");
  } catch (error) {
    if (error.message === "DELIVERY_EXCEEDS_ORDER") {
      return flashError(req, res, "The received quantity exceeds the remaining quantity on the order.", "/deliveries?record=1");
    }
    if (error.message === "DELIVERY_ORDER_CLOSED") {
      return flashError(req, res, "This purchase order is no longer awaiting delivery.", "/deliveries?record=1");
    }
    if (error.message === "DELIVERY_ITEM_NOT_IN_ORDER") {
      return flashError(req, res, "A delivered item does not belong to this purchase order.", "/deliveries?record=1");
    }
    next(error);
  }
};
