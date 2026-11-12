const supplierDialog = document.querySelector("#supplier-dialog");
const detailsDialog = document.querySelector("#details-dialog");
const supplierForm = document.querySelector("#supplier-form");

document.querySelectorAll("[data-print-page]").forEach((button) => {
  button.addEventListener("click", () => window.print());
});

const notificationToggle = document.querySelector("#notification-toggle");
const notificationPanel = document.querySelector("#notification-panel");
if (notificationToggle && notificationPanel) {
  const setNotificationPanelOpen = (isOpen) => {
    notificationPanel.hidden = !isOpen;
    notificationToggle.setAttribute("aria-expanded", String(isOpen));
  };

  notificationToggle.addEventListener("click", () => {
    setNotificationPanelOpen(notificationPanel.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".notification-wrap")) setNotificationPanelOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNotificationPanelOpen(false);
  });

  if (new URLSearchParams(window.location.search).get("notifications") === "1") {
    setNotificationPanelOpen(true);
    window.history.replaceState(null, "", window.location.pathname);
  }
}

const dashboardGreeting = document.querySelector("#dashboard-greeting");
if (dashboardGreeting) {
  const updateDashboardGreeting = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    dashboardGreeting.textContent = `${greeting}, Japz team`;
  };

  updateDashboardGreeting();
  setInterval(updateDashboardGreeting, 60_000);
}

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
}).format(new Date());

const resetSupplierForm = () => {
  supplierForm.reset();
  supplierForm.action = "/suppliers";
  document.querySelector("#dialog-title").textContent = "Add supplier";
  supplierForm.querySelector('button[type="submit"]').textContent = "Save supplier";
};

document.querySelectorAll("[data-open-add]").forEach((button) => {
  button.addEventListener("click", () => {
    resetSupplierForm();
    supplierDialog.showModal();
  });
});

document.querySelectorAll(".edit-supplier").forEach((button) => {
  button.addEventListener("click", () => {
    resetSupplierForm();
    supplierForm.action = `/suppliers/${button.dataset.id}/update`;
    document.querySelector("#dialog-title").textContent = "Edit supplier";
    supplierForm.querySelector('button[type="submit"]').textContent = "Save changes";
    const fields = {
      name: "name",
      contact: "contactPerson",
      phone: "phone",
      email: "email",
      address: "address",
      category: "category",
      terms: "paymentTerms",
      notes: "notes"
    };
    Object.entries(fields).forEach(([dataKey, fieldName]) => {
      supplierForm.elements[fieldName].value = button.dataset[dataKey] || "";
    });
    supplierDialog.showModal();
  });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll(".archive-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    const nextStatus = form.elements.status.value;
    const action = nextStatus === "Inactive" ? "Archive" : "Reactivate";
    if (!window.confirm(`${action} this supplier?`)) event.preventDefault();
  });
});

const searchInput = document.querySelector("#supplier-search");
const categoryFilter = document.querySelector("#category-filter");
const statusFilter = document.querySelector("#status-filter");
const supplierRows = [...document.querySelectorAll("#supplier-rows tr[data-search]")];
const noResults = document.querySelector("#no-results");

const filterSuppliers = () => {
  const search = searchInput?.value.trim().toLocaleLowerCase() || "";
  const category = categoryFilter?.value || "";
  const status = statusFilter?.value || "";
  let visibleCount = 0;

  supplierRows.forEach((row) => {
    const matchesSearch = (row.dataset.search || "").toLocaleLowerCase().includes(search);
    const matchesCategory = !category || row.dataset.category === category;
    const matchesStatus = !status || row.dataset.status === status;
    const isVisible = matchesSearch && matchesCategory && matchesStatus;
    row.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  if (noResults) noResults.hidden = visibleCount > 0 || supplierRows.length === 0;
  const count = document.querySelector("#visible-count");
  if (count) count.textContent = visibleCount;
};

searchInput?.addEventListener("input", filterSuppliers);
categoryFilter?.addEventListener("change", filterSuppliers);
statusFilter?.addEventListener("change", filterSuppliers);

document.querySelector("#export-suppliers")?.addEventListener("click", () => {
  const headers = ["Supplier", "Category", "Contact person", "Phone", "Email", "Payment terms", "Status"];
  const csvValue = (value) => `"${value.replaceAll('"', '""')}"`;
  const rows = supplierRows
    .filter((row) => !row.hidden)
    .map((row) => {
      const cells = row.querySelectorAll("td");
      const supplierName = cells[0].querySelector(".supplier-identity strong")?.textContent.trim() || "";
      const supplierCode = cells[0].querySelector(".supplier-identity small")?.textContent.trim() || "";
      return [
        `${supplierName} (${supplierCode})`,
        cells[1].textContent.trim(),
        cells[2].textContent.trim(),
        cells[3].querySelector(".contact-name")?.textContent.trim() || "",
        cells[3].querySelector(".contact-phone")?.textContent.trim() || "",
        cells[4].textContent.trim(),
        cells[5].textContent.trim()
      ];
    });
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "suppliers.csv";
  link.click();
  URL.revokeObjectURL(url);
});


document.querySelector("#today-label")?.replaceChildren(
  document.createTextNode(new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date()))
);

document.querySelectorAll("[data-table-search]").forEach((input) => {
  const table = document.querySelector(input.dataset.tableSearch);
  if (!table) return;
  const categoryFilter = table.id === "products-table" ? document.querySelector("#products-category-filter") : null;
  const statusFilter = table.id === "orders-table"
    ? document.querySelector("#orders-status-filter")
    : table.id === "deliveries-table"
      ? document.querySelector("#deliveries-status-filter")
      : table.id === "transactions-table" ? document.querySelector("#transactions-type-filter") : null;
  const filterRows = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const category = categoryFilter?.value || "";
    const status = statusFilter?.value || "";
    let visibleCount = 0;
    table.querySelectorAll("tbody tr[data-search]").forEach((row) => {
      const isVisible = row.dataset.search.toLocaleLowerCase().includes(query)
        && (!category || row.cells[1]?.textContent.trim() === category)
        && (!status || (table.id === "transactions-table" ? row.dataset.type : row.dataset.status) === status);
      row.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });
    const countId = {
      "orders-table": "#visible-orders-count",
      "deliveries-table": "#visible-deliveries-count",
      "products-table": "#visible-products-count",
      "transactions-table": "#visible-transactions-count"
    }[table.id];
    const count = countId ? document.querySelector(countId) : null;
    if (count) count.textContent = visibleCount;
    const noResultsId = {
      "orders-table": "#no-orders-results",
      "deliveries-table": "#no-deliveries-results",
      "products-table": "#no-results",
      "transactions-table": "#no-transactions-results"
    }[table.id];
    const noResults = noResultsId ? document.querySelector(noResultsId) : null;
    if (noResults) noResults.hidden = visibleCount > 0;
  };
  input.addEventListener("input", filterRows);
  categoryFilter?.addEventListener("change", filterRows);
  statusFilter?.addEventListener("change", filterRows);
});

document.querySelector("#export-products")?.addEventListener("click", () => {
  const headers = ["Product / supply", "Category", "Supplier", "Unit cost", "On hand", "Reorder point", "Stock status"];
  const csvValue = (value) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...document.querySelectorAll("#products-table tbody tr[data-search]")]
    .filter((row) => !row.hidden)
    .map((row) => [...row.cells].slice(0, 7).map((cell) => cell.textContent.trim()));
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "products-and-supplies.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelector("#export-orders")?.addEventListener("click", () => {
  const headers = ["Order number", "Supplier", "Created", "Expected delivery", "Items", "Total", "Status"];
  const csvValue = (value) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...document.querySelectorAll("#orders-table tbody tr[data-search]")]
    .filter((row) => !row.hidden)
    .map((row) => [...row.cells].slice(0, 7).map((cell) => cell.textContent.trim()));
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "purchase-orders.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelector("#export-transactions")?.addEventListener("click", () => {
  const headers = ["Transaction", "Date", "Supplier", "Type", "Reference", "Method", "Amount", "Status"];
  const csvValue = (value) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...document.querySelectorAll("#transactions-table tbody tr[data-search]")]
    .filter((row) => !row.hidden)
    .map((row) => [...row.cells].map((cell) => cell.textContent.trim()));
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "supplier-transactions.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelector("#export-report-summary")?.addEventListener("click", () => {
  const rows = [
    ["Supplier report summary"],
    ["Metric", "Value"],
    ...[...document.querySelectorAll(".report-summary-card")].map((card) => [
      card.querySelector("span")?.textContent.trim() || "",
      card.querySelector("strong")?.textContent.trim() || ""
    ]),
    [],
    ["Purchasing by supplier category"],
    ["Category", "Spend"],
    ...[...document.querySelectorAll(".report-category-row")].map((row) => [
      row.querySelector("span")?.textContent.trim() || "",
      row.querySelector("strong")?.textContent.trim() || ""
    ]),
    [],
    ["Supplier balances"],
    ["Supplier", "Payment terms", "Total purchases", "Balance due"],
    ...[...document.querySelectorAll("#report-balances-table tbody tr[data-supplier]")].map((row) => [
      row.cells[0].textContent.trim(),
      row.cells[1].textContent.trim(),
      row.cells[2].textContent.trim(),
      row.cells[3].textContent.trim()
    ])
  ];
  const csvValue = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "supplier-report-summary.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

const supplyDialog = document.querySelector("#supply-dialog");
document.querySelectorAll("[data-open-supply-dialog]").forEach((button) => {
  button.addEventListener("click", () => supplyDialog?.showModal());
});
if (supplyDialog && new URLSearchParams(window.location.search).get("create") === "1") {
  supplyDialog.showModal();
  supplyDialog.querySelector('input[name="name"]')?.focus();
}

const editProductDialog = document.querySelector("#edit-product-dialog");
const editProductForm = document.querySelector("#edit-product-form");
document.querySelectorAll(".edit-product").forEach((button) => {
  button.addEventListener("click", () => {
    editProductForm.action = `/products/${button.dataset.id}/update`;
    for (const [field, key] of Object.entries({
      name: "name",
      category: "category",
      unit: "unit",
      unitCost: "cost",
      stockQuantity: "stock",
      reorderLevel: "reorder"
    })) {
      editProductForm.elements[field].value = button.dataset[key] || "";
    }
    let supplierIds;
    try {
      supplierIds = JSON.parse(button.dataset.suppliers || "[]");
    } catch (error) {
      console.error("Could not read product suppliers.", error);
      supplierIds = [];
    }
    [...editProductForm.elements.supplierIds.options].forEach((option) => {
      option.selected = supplierIds.includes(Number(option.value));
    });
    editProductDialog.showModal();
  });
});

const orderRows = document.querySelector("#order-item-rows");
const orderSupplier = document.querySelector("#order-supplier");
const orderDialog = document.querySelector("#order-dialog");
const openOrderDialog = () => {
  if (!orderDialog || orderDialog.open) return;
  orderDialog.showModal();
  filterOrderSupplies();
};
document.querySelectorAll("[data-open-order-dialog]").forEach((button) => {
  button.addEventListener("click", openOrderDialog);
});
const syncOrderItem = (row) => {
  const product = row.querySelector('select[name="supplyId"]');
  const unitSelect = row.querySelector(".order-item-unit-select");
  const priceInput = row.querySelector('input[name="unitPrice"]');
  const selectedOption = product.selectedOptions[0];
  const unit = selectedOption?.dataset.unit || "unit";
  const unitOption = document.createElement("option");
  unitOption.value = unit;
  unitOption.textContent = unit;
  unitSelect.replaceChildren(unitOption);
  priceInput.value = selectedOption?.dataset.cost || "0";
};
const updateOrderItemRemoveButtons = () => {
  if (!orderRows) return;
  const rows = [...orderRows.querySelectorAll(".order-item-row")];
  rows.forEach((row, index) => {
    const removable = index > 0;
    row.classList.toggle("is-removable", removable);
    row.querySelector(".remove-row").disabled = !removable;
  });
};
const filterOrderSupplies = () => {
  if (!orderRows) return;
  const supplierId = orderSupplier.value;
  orderRows.querySelectorAll('select[name="supplyId"]').forEach((product) => {
    [...product.options].forEach((option) => {
      if (!option.value) return;
      let supplierIds;
      try {
        supplierIds = JSON.parse(option.dataset.suppliers || "[]").map(String);
      } catch (error) {
        console.error("Could not read supplier availability for a product.", error);
        supplierIds = [];
      }
      option.disabled = Boolean(supplierId && !supplierIds.includes(supplierId));
    });
    if (product.selectedOptions[0]?.disabled) product.value = "";
    syncOrderItem(product.closest(".order-item-row"));
  });
};
if (orderDialog && new URLSearchParams(window.location.search).get("create") === "1") {
  openOrderDialog();
}
orderSupplier?.addEventListener("change", filterOrderSupplies);
orderRows?.addEventListener("change", (event) => {
  if (event.target.matches('select[name="supplyId"]')) syncOrderItem(event.target.closest(".order-item-row"));
});
document.querySelector("#add-order-item")?.addEventListener("click", () => {
  const template = orderRows.querySelector(".order-item-row");
  const row = template.cloneNode(true);
  row.querySelectorAll('input[name="quantity"]').forEach((input) => { input.value = ""; });
  row.querySelector('input[name="unitPrice"]').value = "0";
  row.querySelector("select").selectedIndex = 0;
  syncOrderItem(row);
  orderRows.append(row);
  updateOrderItemRemoveButtons();
  filterOrderSupplies();
});
orderRows?.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-row");
  if (!button || orderRows.querySelectorAll(".order-item-row").length <= 1) return;
  button.closest(".order-item-row").remove();
  updateOrderItemRemoveButtons();
});

document.querySelectorAll(".cancel-order-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm("Cancel this purchase order? This cannot be undone.")) event.preventDefault();
  });
});

const deliveryOrder = document.querySelector("#delivery-order");
const deliveryItems = document.querySelector("#delivery-items");
const deliveryDialog = document.querySelector("#delivery-dialog");
const deliveryStatus = document.querySelector("#delivery-status");
const updateDeliveryStatus = () => {
  if (!deliveryItems || !deliveryStatus) return;
  const rows = [...deliveryItems.querySelectorAll(".delivery-line")];
  const complete = rows.length > 0 && rows.every((row) => {
    const received = Number(row.querySelector('[name="quantityReceived"]').value) || 0;
    return received >= Number(row.dataset.remaining || 0);
  });
  deliveryStatus.value = complete ? "Received" : "Partial";
};
const openDeliveryDialog = () => {
  if (!deliveryDialog || deliveryDialog.open) return;
  deliveryDialog.showModal();
  const requestedOrder = new URLSearchParams(window.location.search).get("order");
  if (requestedOrder && deliveryOrder) {
    deliveryOrder.value = requestedOrder;
    deliveryOrder.dispatchEvent(new Event("change"));
  }
};
document.querySelectorAll("[data-open-delivery-dialog]").forEach((button) => {
  button.addEventListener("click", openDeliveryDialog);
});
deliveryOrder?.addEventListener("change", () => {
  deliveryItems.replaceChildren();
  const selected = deliveryOrder.selectedOptions[0];
  if (!selected?.value) {
    const empty = document.createElement("p");
    empty.className = "inline-empty";
    empty.textContent = "Choose an order to enter delivered quantities.";
    deliveryItems.append(empty);
    deliveryStatus.value = "Received";
    return;
  }

  let items;
  try {
    items = JSON.parse(selected.dataset.items);
  } catch (error) {
    console.error("Could not read purchase order items.", error);
    const message = document.createElement("p");
    message.className = "inline-empty";
    message.textContent = "Could not load this order's items. Refresh and try again.";
    deliveryItems.append(message);
    deliveryStatus.value = "Partial";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "delivery-line";
    row.dataset.remaining = String(item.remainingQuantity);
    const identity = document.createElement("div");
    identity.className = "delivery-line-name";
    const name = document.createElement("strong");
    name.textContent = item.supplyName || "Supply";
    identity.append(name);

    const quantitySummary = document.createElement("div");
    quantitySummary.className = "delivery-quantity-summary";
    const expected = document.createElement("small");
    expected.textContent = `Expected: ${item.quantity} ${item.unit}`;
    const previouslyReceived = document.createElement("small");
    previouslyReceived.textContent = `Received before: ${item.receivedToDate} ${item.unit}`;
    const missing = document.createElement("small");
    missing.className = "delivery-missing";
    missing.textContent = `Still missing: ${item.remainingQuantity} ${item.unit}`;
    quantitySummary.append(expected, previouslyReceived, missing);

    const id = document.createElement("input");
    id.type = "hidden";
    id.name = "itemId";
    id.value = item.id;

    const received = document.createElement("input");
    received.type = "number";
    received.name = "quantityReceived";
    received.min = "0";
    received.max = String(item.remainingQuantity);
    received.step = "0.01";
    received.placeholder = "Received";
    received.setAttribute("aria-label", `Quantity received for ${item.supplyName}`);
    received.addEventListener("input", () => {
      const currentReceipt = Number(received.value) || 0;
      const remaining = Math.max(0, Number(item.remainingQuantity) - currentReceipt);
      missing.textContent = `Still missing: ${remaining} ${item.unit}`;
      damaged.max = String(currentReceipt);
      updateDeliveryStatus();
    });

    const damaged = document.createElement("input");
    damaged.type = "number";
    damaged.name = "quantityDamaged";
    damaged.min = "0";
    damaged.max = String(item.remainingQuantity);
    damaged.step = "0.01";
    damaged.value = "0";
    damaged.setAttribute("aria-label", `Damaged quantity for ${item.supplyName}`);
    damaged.placeholder = "Damaged";

    const remarks = document.createElement("input");
    remarks.type = "text";
    remarks.name = "itemRemarks";
    remarks.maxLength = 255;
    remarks.placeholder = "Item note";
    remarks.setAttribute("aria-label", `Note for ${item.supplyName}`);
    row.append(identity, quantitySummary, id, received, damaged, remarks);
    deliveryItems.append(row);
  });
  updateDeliveryStatus();
});
if (deliveryDialog && new URLSearchParams(window.location.search).get("record") === "1") {
  openDeliveryDialog();
}

const paymentSupplier = document.querySelector("#payment-supplier");
const paymentOrder = document.querySelector("#payment-order");
const paymentDialog = document.querySelector("#payment-dialog");
const paymentForm = document.querySelector("#payment-form");
const openPaymentDialog = () => {
  if (!paymentDialog || paymentDialog.open) return;
  paymentDialog.showModal();
  paymentForm?.elements.supplierId.focus();
  syncPaymentOrders();
};
document.querySelectorAll("[data-open-payment-dialog]").forEach((button) => {
  button.addEventListener("click", openPaymentDialog);
});
const syncPaymentOrders = () => {
  if (!paymentSupplier || !paymentOrder) return;
  const supplierId = paymentSupplier.value;
  for (const option of paymentOrder.options) {
    if (!option.value) {
      option.hidden = false;
      continue;
    }
    option.hidden = option.dataset.supplier !== supplierId;
  }
  if (paymentOrder.selectedOptions[0]?.hidden) paymentOrder.value = "";
};
paymentSupplier?.addEventListener("change", () => {
  syncPaymentOrders();
});
if (paymentDialog && new URLSearchParams(window.location.search).get("record") === "payment") {
  openPaymentDialog();
}
