/**
 * Emart Management Dashboard Logic (Pure Vanilla JS)
 * Đầy đủ tính năng phân quyền Chủ cửa hàng:
 * 1. Danh mục hàng hóa: Dropdown 3 chấm (Sửa/Xóa), Thêm mới cạnh ô tìm kiếm, Upload/Dán ảnh, Cảnh báo tồn kho tối thiểu.
 * 2. Hạn dùng FEFO: UI/UX hiện đại, Tự set % xả hàng tùy chỉnh, Trả hàng cho Nhà cung cấp.
 * 3. Lịch sử hóa đơn: Xem chi tiết toàn diện hóa đơn bán lẻ, in lại bill.
 * 4. Quản lý nhân viên: Thêm nhân viên, đổi trạng thái; Chủ cửa hàng không bị đổi trạng thái/không bị xóa.
 * 5. CRM Khách hàng thân thiết: 1 điểm = 1 đồng, xem chi tiết chi tiêu để xét duyệt nâng hạng.
 */

let activeTab = "overview";
let salesChart = null;
let currentFefoFilter = "all";
let currentUploadedImageBase64 = "";

// Close dropdowns on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-container")) {
    hideAllDropdowns();
  }
});

function hideAllDropdowns() {
  document.querySelectorAll(".action-dropdown").forEach(d => d.classList.add("hidden"));
}

function toggleActionDropdown(event, id) {
  event.stopPropagation();
  const dropdown = document.getElementById("dropdown-" + id);
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  hideAllDropdowns();
  if (isHidden) {
    dropdown.classList.remove("hidden");
  }
}

// TAB SWITCHER
function switchTab(tabId) {
  const user = getCurrentUser();
  const isOwner = user && user.role === "Chủ cửa hàng";
  const staffAllowedTabs = ["products", "fefo"];

  if (!isOwner && !staffAllowedTabs.includes(tabId)) {
    tabId = "products";
  }

  activeTab = tabId;

  // Update sidebar buttons
  document.querySelectorAll(".sidebar-tab-btn").forEach(btn => {
    if (!isOwner && btn.dataset.ownerOnly === "true") {
      btn.classList.add("hidden");
      return;
    }
    if (btn.dataset.tab === tabId) {
      btn.className = "sidebar-tab-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#FFD700] text-[#005A2B] shadow-xs";
    } else {
      btn.className = "sidebar-tab-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition";
    }
  });

  // Hide all sections
  document.querySelectorAll(".dashboard-section").forEach(sec => sec.classList.add("hidden"));

  // Show active section
  const target = document.getElementById("section-" + tabId);
  if (target) {
    target.classList.remove("hidden");
  }

  // Refresh tab content
  if (tabId === "overview") renderOverview();
  else if (tabId === "products") renderProductsTable();
  else if (tabId === "fefo") renderFefoAlerts();
  else if (tabId === "invoices") renderInvoicesTable();
  else if (tabId === "staff") renderStaffTable();
  else if (tabId === "crm") renderCrmTable();
  else if (tabId === "reports") renderReportsSection();
  else if (tabId === "payment-settings") renderPaymentSettingsSection();
  else if (tabId === "shift-reports") renderShiftReportsSection();

  // Check low stock push alerts & pending report notifications on every tab switch
  checkLowStockPushNotification();
  if (isOwner) {
    checkPendingReportsNotification();
    checkPendingShiftReportsNotification();
  }

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 1. RENDER OVERVIEW
// ==========================================
function renderOverview() {
  const products = getProducts();
  const invoices = getInvoices();

  const totalRev = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalOrders = invoices.length;
  const fefoAlertCount = products.filter(p => getDaysUntilExpiry(p.expiryDate) <= 7).length;
  const lowStockCount = products.filter(p => p.stock <= (p.minStockAlert || 5)).length;

  document.getElementById("stat-revenue").innerText = formatVND(totalRev);
  document.getElementById("stat-orders").innerText = totalOrders + " đơn";
  document.getElementById("stat-fefo").innerText = fefoAlertCount + " mặt hàng";
  document.getElementById("stat-lowstock").innerText = lowStockCount + " mặt hàng";

  renderRevenueChart(invoices);
}

function renderRevenueChart(invoices) {
  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  if (salesChart) {
    salesChart.destroy();
  }

  const hours = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];
  const revenueData = [120000, 245000, 480000, 310000, 290000, 620000, 540000, 180000];

  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: hours,
      datasets: [{
        label: "Doanh thu theo giờ (VND)",
        data: revenueData,
        borderColor: "#005A2B",
        backgroundColor: "rgba(0, 90, 43, 0.1)",
        tension: 0.35,
        fill: true,
        pointBackgroundColor: "#FFA500",
        pointBorderColor: "#FFFFFF",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: (v) => v / 1000 + "k"
          }
        }
      }
    }
  });
}

// Low Stock Alert Push Notification Checker
function checkLowStockPushNotification() {
  const products = getProducts();
  const lowStockItems = products.filter(p => p.stock <= (p.minStockAlert || 5));
  const badge = document.getElementById("header-stock-alert-badge");
  const text = document.getElementById("header-stock-alert-text");

  if (badge && text) {
    if (lowStockItems.length > 0) {
      badge.classList.remove("hidden");
      text.innerText = `Cảnh báo: Có ${lowStockItems.length} sản phẩm chạm ngưỡng tồn kho tối thiểu!`;
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Chuyển trực tiếp đến sản phẩm cảnh báo tồn kho trong mục Hạn Sử Dụng khi bấm thông báo trên Header
function handleHeaderStockAlertClick() {
  const products = getProducts();
  const lowStockItems = products.filter(p => p.stock <= (p.minStockAlert || 5));
  switchTab("fefo");
  setFefoFilter("lowstock");

  if (lowStockItems.length > 0) {
    const firstItem = lowStockItems[0];
    setTimeout(() => {
      const card = document.getElementById("fefo-card-" + firstItem.id);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("ring-4", "ring-red-500", "ring-offset-2");
        setTimeout(() => {
          card.classList.remove("ring-4", "ring-red-500", "ring-offset-2");
        }, 3500);
      }
    }, 120);
    showToast(
      `⚠️ Đã chuyển đến sản phẩm chạm ngưỡng tồn kho: "${firstItem.name}" (Tồn: ${firstItem.stock}/${firstItem.minStockAlert || 5}).\nBạn có thể Giảm giá xả hàng hoặc Trả hàng về NCC ngay tại đây!`,
      "warning"
    );
  }
}

function jumpToFefoProduct(productId) {
  const products = getProducts();
  const targetProd = products.find(p => p.id === productId);
  switchTab("fefo");
  setFefoFilter("all");
  const searchInput = document.getElementById("fefo-search-input");
  if (searchInput) searchInput.value = "";
  renderFefoAlerts();

  setTimeout(() => {
    const card = document.getElementById("fefo-card-" + productId);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("ring-4", "ring-[#FFA500]", "ring-offset-2");
      setTimeout(() => {
        card.classList.remove("ring-4", "ring-[#FFA500]", "ring-offset-2");
      }, 3500);
    }
  }, 120);

  if (targetProd) {
    showToast(`Đã chuyển đến lô hàng "${targetProd.name}" trong mục Hạn Sử Dụng.`, "info");
  }
}

// ==========================================
// 2. RENDER PRODUCTS TABLE & BỘ LỌC ĐA NĂNG ĐẦY MÀU SẮC
// ==========================================
function updateProductCategoryPillUI(selectedCat) {
  document.querySelectorAll(".prod-cat-pill").forEach(btn => {
    const pillCat = btn.getAttribute("data-cat-pill");
    if (pillCat === selectedCat) {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#005A2B] to-emerald-700 text-[#FFD700] shadow-md ring-2 ring-[#FFD700]/60 transition cursor-pointer";
    } else if (pillCat === "Đồ Ăn Nhanh & Ready-to-eat") {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200 transition cursor-pointer";
    } else if (pillCat === "Đồ Uống & Nước Giải Khát") {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 hover:bg-sky-200 transition cursor-pointer";
    } else if (pillCat === "Thực Phẩm & Bánh Kẹo") {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-100 text-pink-800 border border-pink-300 hover:bg-pink-200 transition cursor-pointer";
    } else if (pillCat === "Kem & Đồ Đông Lạnh") {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 hover:bg-cyan-200 transition cursor-pointer";
    } else if (pillCat === "Chăm Sóc Cá Nhân & Gia Dụng") {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition cursor-pointer";
    } else {
      btn.className = "prod-cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition cursor-pointer";
    }
  });
}

function selectProductCategoryPill(category) {
  const select = document.getElementById("product-filter-category");
  if (select) select.value = category;
  updateProductCategoryPillUI(category);
  renderProductsTable();
}

function onProductCategorySelectChange(category) {
  updateProductCategoryPillUI(category);
  renderProductsTable();
}

function setProductQuickFilter(type) {
  const searchEl = document.getElementById("product-search-input");
  const catEl = document.getElementById("product-filter-category");
  const stockEl = document.getElementById("product-filter-stock");
  const statusEl = document.getElementById("product-filter-status");
  const sortEl = document.getElementById("product-filter-sort");

  if (searchEl) searchEl.value = "";
  if (catEl) catEl.value = "all";
  if (sortEl) sortEl.value = "default";
  updateProductCategoryPillUI("all");

  if (type === "lowstock") {
    if (stockEl) stockEl.value = "low";
    if (statusEl) statusEl.value = "all";
  } else if (type === "promo") {
    if (stockEl) stockEl.value = "all";
    if (statusEl) statusEl.value = "promo-or-returned";
  } else {
    if (stockEl) stockEl.value = "all";
    if (statusEl) statusEl.value = "all";
  }
  renderProductsTable();
}

function resetProductFilters() {
  setProductQuickFilter("all");
  showToast("Đã đặt lại toàn bộ bộ lọc danh mục hàng hóa!", "info");
}

function getCategoryStyleMeta(category) {
  switch (category) {
    case "Đồ Ăn Nhanh & Ready-to-eat":
      return {
        emoji: "🍱",
        badgeClass: "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-900 border border-orange-300",
        rowHover: "hover:bg-orange-50/40"
      };
    case "Đồ Uống & Nước Giải Khát":
      return {
        emoji: "🥤",
        badgeClass: "bg-gradient-to-r from-sky-100 to-blue-100 text-sky-900 border border-sky-300",
        rowHover: "hover:bg-sky-50/40"
      };
    case "Thực Phẩm & Bánh Kẹo":
      return {
        emoji: "🍪",
        badgeClass: "bg-gradient-to-r from-pink-100 to-rose-100 text-pink-900 border border-pink-300",
        rowHover: "hover:bg-pink-50/40"
      };
    case "Kem & Đồ Đông Lạnh":
      return {
        emoji: "🍦",
        badgeClass: "bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-900 border border-cyan-300",
        rowHover: "hover:bg-cyan-50/40"
      };
    case "Chăm Sóc Cá Nhân & Gia Dụng":
      return {
        emoji: "🧴",
        badgeClass: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-900 border border-purple-300",
        rowHover: "hover:bg-purple-50/40"
      };
    default:
      return {
        emoji: "📦",
        badgeClass: "bg-emerald-100 text-emerald-900 border border-emerald-300",
        rowHover: "hover:bg-emerald-50/40"
      };
  }
}

function renderProductsTable() {
  const products = getProducts();
  const search = document.getElementById("product-search-input")?.value.trim().toLowerCase() || "";
  const categoryFilter = document.getElementById("product-filter-category")?.value || "all";
  const stockFilter = document.getElementById("product-filter-stock")?.value || "all";
  const statusFilter = document.getElementById("product-filter-status")?.value || "all";
  const sortOrder = document.getElementById("product-filter-sort")?.value || "default";

  // Cập nhật 4 thẻ thống kê màu sắc ở đầu trang Danh Mục Hàng Hóa & Kho
  const totalItems = products.length;
  const totalUnits = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const totalValue = products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0), 0);
  const lowStockCount = products.filter(p => p.stock <= (p.minStockAlert || 5)).length;
  const promoOrReturnedCount = products.filter(p => p.price < p.originalPrice || (p.returnedQty && p.returnedQty > 0)).length;

  const statTotalItemsEl = document.getElementById("prod-stat-total-items");
  const statTotalUnitsEl = document.getElementById("prod-stat-total-units");
  const statTotalValueEl = document.getElementById("prod-stat-total-value");
  const statLowStockEl = document.getElementById("prod-stat-lowstock");
  const statPromoEl = document.getElementById("prod-stat-promo");

  if (statTotalItemsEl) statTotalItemsEl.innerText = `${totalItems} mặt hàng`;
  if (statTotalUnitsEl) statTotalUnitsEl.innerText = `Tổng ${totalUnits.toLocaleString("vi-VN")} sản phẩm trong kho`;
  if (statTotalValueEl) statTotalValueEl.innerText = formatVND(totalValue);
  if (statLowStockEl) statLowStockEl.innerText = `${lowStockCount} mặt hàng`;
  if (statPromoEl) statPromoEl.innerText = `${promoOrReturnedCount} mặt hàng`;

  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  let filtered = products.filter(p => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search) ||
      p.barcode.includes(search) ||
      (p.batchCode && p.batchCode.toLowerCase().includes(search));
    if (!matchSearch) return false;

    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

    const minAlert = p.minStockAlert || 5;
    if (stockFilter === "low" && p.stock > minAlert) return false;
    if (stockFilter === "out" && p.stock > 0) return false;
    if (stockFilter === "safe" && p.stock <= minAlert) return false;

    const days = getDaysUntilExpiry(p.expiryDate);
    const isDiscounted = p.price < p.originalPrice;
    const isReturned = p.returnedQty && p.returnedQty > 0;

    if (statusFilter === "near-expiry" && days > 7) return false;
    if (statusFilter === "discounted" && !isDiscounted) return false;
    if (statusFilter === "returned" && !isReturned) return false;
    if (statusFilter === "promo-or-returned" && !isDiscounted && !isReturned) return false;

    return true;
  });

  if (sortOrder === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortOrder === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortOrder === "stock-asc") {
    filtered.sort((a, b) => a.stock - b.stock);
  } else if (sortOrder === "stock-desc") {
    filtered.sort((a, b) => b.stock - a.stock);
  } else if (sortOrder === "expiry-asc") {
    filtered.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }

  const resultTextEl = document.getElementById("product-filter-result-text");
  if (resultTextEl) {
    resultTextEl.innerHTML = `Đang hiển thị <strong class="text-[#005A2B] font-black">${filtered.length}</strong> / ${totalItems} mặt hàng`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-10 text-center text-slate-500">
          <div class="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-500">
            <i data-lucide="search-x" class="w-7 h-7"></i>
          </div>
          <p class="font-black text-sm text-slate-700">Không tìm thấy sản phẩm nào phù hợp với bộ lọc</p>
          <p class="text-xs text-slate-400 mt-1">Hãy thử từ khóa khác hoặc bấm nút Đặt lại bộ lọc</p>
          <button onclick="resetProductFilters()" class="mt-3 px-4 py-1.5 rounded-xl bg-[#005A2B] text-[#FFD700] font-bold text-xs cursor-pointer">
            Hiển thị tất cả sản phẩm
          </button>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const days = getDaysUntilExpiry(p.expiryDate);
    const minAlert = p.minStockAlert || 5;
    const isLowStock = p.stock <= minAlert;
    const isOutStock = p.stock <= 0;
    const discountRate = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const catMeta = getCategoryStyleMeta(p.category);
    const stockPercent = Math.min(100, Math.max(8, Math.round((p.stock / Math.max(minAlert * 3, 20)) * 100)));

    let stockStatusBadge = '';
    let stockBarColor = 'bg-emerald-500';
    if (isOutStock) {
      stockStatusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-2xs inline-flex items-center gap-1"><i data-lucide="x-circle" class="w-3 h-3"></i> Hết hàng (0)</span>`;
      stockBarColor = 'bg-red-600';
    } else if (isLowStock) {
      stockStatusBadge = `<span onclick="jumpToFefoProduct('${p.id}')" title="Bấm để xử lý sản phẩm chạm ngưỡng tồn" class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-100 to-orange-100 text-orange-800 border border-orange-300 cursor-pointer hover:brightness-95 inline-flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3 text-orange-600"></i> Chạm ngưỡng (${p.stock} / Min: ${minAlert})</span>`;
      stockBarColor = 'bg-orange-500';
    } else {
      stockStatusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600"></i> ${p.stock} cái <span class="font-normal text-slate-500">(Min: ${minAlert})</span></span>`;
    }

    let expiryBadge = '';
    if (days <= 1) {
      expiryBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-2xs inline-block mt-1">🚨 Nguy cấp: ${days}d</span>`;
    } else if (days <= 7) {
      expiryBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-block mt-1">⏳ Cận hạn: ${days} ngày</span>`;
    } else {
      expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 inline-block mt-1">✅ Còn ${days} ngày</span>`;
    }

    return `
      <tr class="border-b border-slate-100 ${catMeta.rowHover} transition text-xs">
        <td class="p-3.5">
          <span class="font-mono font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg inline-block">#${p.barcode}</span>
          <span class="block text-[10px] font-mono font-bold text-slate-400 mt-1">Lô: ${p.batchCode || 'LOT-2026'}</span>
        </td>
        <td class="p-3.5">
          <div class="flex items-center gap-3">
            <div class="relative shrink-0">
              <img src="${p.image}" class="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-2xl object-cover bg-slate-100 border-2 border-emerald-200 shadow-xs">
              ${discountRate > 0 ? `<span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[9px] shadow">-${discountRate}%</span>` : ''}
            </div>
            <div class="min-w-0">
              <span class="font-black text-slate-900 block text-xs sm:text-sm leading-snug">${p.name}</span>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                ${discountRate > 0 ? `<span class="px-2 py-0.5 rounded-md bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-[10px] shadow-2xs">🏷️ Đang giảm -${discountRate}%</span>` : ''}
                ${p.returnedQty ? `<span class="px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[10px] shadow-2xs">🚛 Đã trả NCC (${p.returnedQty} cái)</span>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-2xs ${catMeta.badgeClass}">
            <span>${catMeta.emoji}</span>
            <span>${p.category}</span>
          </span>
        </td>
        <td class="p-3.5">
          <span class="font-black text-[#005A2B] text-sm block">${formatVND(p.price)}</span>
          ${p.price < p.originalPrice ? `<span class="block text-[10px] text-rose-500 line-through font-bold">${formatVND(p.originalPrice)}</span>` : `<span class="block text-[10px] text-emerald-600 font-semibold">Giá chuẩn niêm yết</span>`}
        </td>
        <td class="p-3.5">
          ${stockStatusBadge}
          <div class="w-28 bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div class="${stockBarColor} h-1.5 rounded-full" style="width: ${stockPercent}%"></div>
          </div>
        </td>
        <td class="p-3.5">
          <div class="font-mono font-bold text-slate-800">${p.expiryDate}</div>
          ${expiryBadge}
        </td>
        <td class="p-3.5 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button 
              type="button" 
              onclick="jumpToFefoProduct('${p.id}')" 
              class="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
              title="Chuyển sang xử lý Hạn Sử Dụng (Giảm giá / Trả NCC)"
            >
              <i data-lucide="calendar-clock" class="w-3.5 h-3.5 text-amber-700"></i>
              <span class="hidden xl:inline">Xử lý HSD</span>
            </button>
            <div class="relative inline-block text-left dropdown-container">
              <button 
                type="button" 
                onclick="toggleActionDropdown(event, '${p.id}')" 
                class="p-2 rounded-xl bg-slate-100 hover:bg-[#005A2B] text-slate-700 hover:text-[#FFD700] transition cursor-pointer border border-slate-200"
                title="Thao tác Sửa / Xóa"
              >
                <i data-lucide="more-vertical" class="w-4 h-4"></i>
              </button>
              <div id="dropdown-${p.id}" class="action-dropdown hidden absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fade-in text-left">
                <button 
                  type="button" 
                  onclick="editProduct('${p.id}'); hideAllDropdowns();" 
                  class="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#005A2B] flex items-center gap-2 cursor-pointer"
                >
                  <i data-lucide="edit-3" class="w-3.5 h-3.5 text-[#005A2B]"></i>
                  <span>Cập nhật kho / Sửa</span>
                </button>
                <button 
                  type="button" 
                  onclick="jumpToFefoProduct('${p.id}'); hideAllDropdowns();" 
                  class="w-full text-left px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                >
                  <i data-lucide="tag" class="w-3.5 h-3.5 text-amber-600"></i>
                  <span>Giảm giá / Trả NCC</span>
                </button>
                ${getCurrentUser()?.role === 'Chủ cửa hàng' ? `
                <button 
                  type="button" 
                  onclick="deleteProduct('${p.id}'); hideAllDropdowns();" 
                  class="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
                  <span>Xóa sản phẩm</span>
                </button>
                ` : ''}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Add/Edit Product Modal Controls
function openAddProductModal() {
  document.getElementById("modal-product-title").innerText = "Thêm Sản Phẩm Mới Vào Hệ Thống";
  document.getElementById("modal-product-id").value = "";
  document.getElementById("prod-name").value = "";
  document.getElementById("prod-barcode").value = "893" + Math.floor(1000000 + Math.random() * 9000000);
  document.getElementById("prod-price").value = "";
  document.getElementById("prod-stock").value = "15";
  document.getElementById("prod-min-stock").value = "5";
  document.getElementById("prod-date").value = "2026-10-20";
  document.getElementById("prod-category").value = "Đồ Ăn Nhanh & Ready-to-eat";
  document.getElementById("prod-image-url").value = "";
  document.getElementById("prod-image-file").value = "";
  currentUploadedImageBase64 = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";
  document.getElementById("prod-image-preview").src = currentUploadedImageBase64;

  const modal = document.getElementById("product-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function generateRandomBarcode() {
  document.getElementById("prod-barcode").value = "893" + Math.floor(1000000 + Math.random() * 9000000);
}

function handleImageUrlInput(url) {
  if (url && url.trim().length > 5) {
    currentUploadedImageBase64 = url.trim();
    document.getElementById("prod-image-preview").src = currentUploadedImageBase64;
  }
}

function handleImageFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentUploadedImageBase64 = e.target.result;
      document.getElementById("prod-image-preview").src = currentUploadedImageBase64;
    };
    reader.readAsDataURL(file);
  }
}

function closeProductModal() {
  const modal = document.getElementById("product-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function saveProductFromModal(e) {
  e.preventDefault();
  const id = document.getElementById("modal-product-id").value;
  const name = document.getElementById("prod-name").value.trim();
  const barcode = document.getElementById("prod-barcode").value.trim();
  const category = document.getElementById("prod-category").value;
  const price = Number(document.getElementById("prod-price").value);
  const stock = Number(document.getElementById("prod-stock").value);
  const minStockAlert = Number(document.getElementById("prod-min-stock").value) || 5;
  const expiryDate = document.getElementById("prod-date").value;
  const image = currentUploadedImageBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";

  const products = getProducts();

  if (id) {
    // Edit existing product
    const p = products.find(prod => prod.id === id);
    if (p) {
      p.name = name;
      p.barcode = barcode;
      p.category = category;
      p.price = price;
      if (price > (p.originalPrice || 0)) {
        p.originalPrice = price;
      }
      p.stock = stock;
      p.minStockAlert = minStockAlert;
      p.expiryDate = expiryDate;
      if (image) p.image = image;
    }
  } else {
    // Add new product
    const newProd = {
      id: "p" + Date.now(),
      name,
      barcode,
      category,
      price,
      originalPrice: price,
      stock,
      minStockAlert,
      expiryDate,
      batchCode: "LOT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(10 + Math.random() * 90),
      image
    };
    products.unshift(newProd);
  }

  saveProducts(products);
  closeProductModal();
  renderProductsTable();
  renderFefoAlerts();
  checkLowStockPushNotification();
  showToast("Lưu sản phẩm thành công!", "success");
}

function editProduct(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) return;

  document.getElementById("modal-product-title").innerText = "Chỉnh Sửa Thông Tin Sản Phẩm";
  document.getElementById("modal-product-id").value = p.id;
  document.getElementById("prod-name").value = p.name;
  document.getElementById("prod-barcode").value = p.barcode;
  document.getElementById("prod-price").value = p.price;
  document.getElementById("prod-stock").value = p.stock;
  document.getElementById("prod-min-stock").value = p.minStockAlert || 5;
  document.getElementById("prod-date").value = p.expiryDate;
  document.getElementById("prod-category").value = p.category;
  document.getElementById("prod-image-url").value = p.image.startsWith("data:") ? "" : p.image;
  currentUploadedImageBase64 = p.image;
  document.getElementById("prod-image-preview").src = p.image;

  const modal = document.getElementById("product-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function deleteProduct(productId) {
  if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi hệ thống Emart?")) {
    let products = getProducts();
    products = products.filter(p => p.id !== productId);
    saveProducts(products);
    renderProductsTable();
    renderFefoAlerts();
    checkLowStockPushNotification();
  }
}

// ==========================================
// 3. RENDER HẠN SỬ DỤNG (Nhãn góc trên bên phải Giảm giá / Trả về NCC)
// ==========================================
function setFefoFilter(filterType) {
  currentFefoFilter = filterType;
  document.querySelectorAll(".fefo-filter-btn").forEach(btn => {
    btn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1";
  });
  const activeBtn = document.getElementById("fefo-filter-" + filterType);
  if (activeBtn) {
    activeBtn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#005A2B] text-white shadow-xs flex items-center gap-1";
  }
  renderFefoAlerts();
}

function renderFefoAlerts() {
  const products = getProducts();
  const container = document.getElementById("fefo-cards-container");
  const search = document.getElementById("fefo-search-input")?.value.trim().toLowerCase() || "";
  if (!container) return;

  let sorted = [...products].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // Filter by category urgency or low stock
  if (currentFefoFilter === "lowstock") {
    sorted = sorted.filter(p => p.stock <= (p.minStockAlert || 5));
  } else if (currentFefoFilter === "urgent") {
    sorted = sorted.filter(p => getDaysUntilExpiry(p.expiryDate) <= 1);
  } else if (currentFefoFilter === "warning") {
    sorted = sorted.filter(p => {
      const d = getDaysUntilExpiry(p.expiryDate);
      return d > 1 && d <= 7;
    });
  } else if (currentFefoFilter === "safe") {
    sorted = sorted.filter(p => getDaysUntilExpiry(p.expiryDate) > 7);
  }

  // Filter by search
  if (search) {
    sorted = sorted.filter(p => p.name.toLowerCase().includes(search) || (p.batchCode && p.batchCode.toLowerCase().includes(search)));
  }

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
        <i data-lucide="check-circle" class="w-10 h-10 mx-auto text-emerald-500 mb-2"></i>
        <p class="font-bold text-slate-700">Không có lô hàng nào phù hợp với bộ lọc hiện tại</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = sorted.map(p => {
    const days = getDaysUntilExpiry(p.expiryDate);
    const minAlert = p.minStockAlert || 5;
    const isLowStock = p.stock <= minAlert;
    let riskBadge = '';
    let cardBorder = 'border-slate-200';
    let progressColor = 'bg-emerald-500';
    let progressPercent = Math.min(100, Math.max(10, days * 10));

    if (days <= 1) {
      riskBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-300 flex items-center gap-1"><i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i> Cực kỳ nguy cấp: Hạn hôm nay / mai (${days}d)</span>`;
      cardBorder = 'border-red-300 bg-red-50/20';
      progressColor = 'bg-red-600';
      progressPercent = 10;
    } else if (days <= 7) {
      riskBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Cận date: Còn ${days} ngày</span>`;
      cardBorder = 'border-amber-300 bg-amber-50/20';
      progressColor = 'bg-amber-500';
      progressPercent = 35;
    } else {
      riskBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> An toàn (${days} ngày nữa)</span>`;
      progressPercent = 85;
    }

    const lowStockBadge = isLowStock
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1"><i data-lucide="package-alert" class="w-3.5 h-3.5 text-orange-600"></i> Chạm ngưỡng tồn kho (${p.stock}/${minAlert})</span>`
      : '';

    const discountRate = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const hasReturned = p.returnedQty && p.returnedQty > 0;

    // Nhãn ở góc trên bên phải (Giảm giá hoặc Trả về NCC)
    let topRightCornerBadges = '';
    if (discountRate > 0 || hasReturned) {
      topRightCornerBadges = `
        <div class="absolute top-0 right-0 z-10 flex flex-wrap items-center justify-end gap-1">
          ${discountRate > 0 ? `
            <span class="px-3.5 py-1.5 rounded-bl-2xl bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white font-black text-xs shadow-md flex items-center gap-1.5">
              <i data-lucide="tag" class="w-3.5 h-3.5"></i>
              <span>NHÃN GIẢM GIÁ -${discountRate}% (${formatVND(p.price)})</span>
            </span>
          ` : ''}
          ${hasReturned ? `
            <span class="px-3.5 py-1.5 rounded-bl-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-700 text-white font-black text-xs shadow-md flex items-center gap-1.5">
              <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
              <span>TRẢ VỀ NCC (${p.returnedQty} cái)</span>
            </span>
          ` : ''}
        </div>
      `;
    } else {
      topRightCornerBadges = `
        <div class="absolute top-0 right-0 z-10 flex items-center">
          <span class="px-3 py-1 rounded-bl-2xl bg-slate-100 text-slate-600 border-b border-l border-slate-200 font-bold text-[11px] flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-3 h-3 text-[#FFA500]"></i>
            <span>Chưa áp dụng Giảm giá / Trả về NCC</span>
          </span>
        </div>
      `;
    }

    return `
      <div id="fefo-card-${p.id}" class="relative overflow-hidden bg-white rounded-3xl border-2 ${cardBorder} pt-9 pb-4 px-4 sm:px-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-xs transition-all duration-300 hover:shadow-md">
        
        <!-- Góc trên bên phải: Nhãn Giảm Giá hoặc Trả Về NCC -->
        ${topRightCornerBadges}

        <!-- Left Product & Batch Info -->
        <div class="flex items-start gap-3.5 min-w-0 flex-1">
          <div class="relative shrink-0">
            <img src="${p.image}" class="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-2xl object-cover bg-slate-100 border border-slate-200">
            ${discountRate > 0 ? `<span class="absolute -top-2 -left-2 px-1.5 py-0.5 rounded-lg bg-red-600 text-white font-black text-[10px] shadow">-${discountRate}%</span>` : ''}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              ${riskBadge}
              ${lowStockBadge}
              <span class="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">Lô: ${p.batchCode || 'LOT-2026'}</span>
              <span class="text-xs font-mono text-slate-400">#${p.barcode}</span>
            </div>
            
            <h4 class="font-black text-sm text-slate-900 truncate">${p.name}</h4>
            
            <!-- Progress shelf life bar -->
            <div class="w-full bg-slate-100 rounded-full h-1.5 my-2 overflow-hidden max-w-sm">
              <div class="${progressColor} h-1.5 rounded-full" style="width: ${progressPercent}%"></div>
            </div>

            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>HSD: <strong class="text-slate-800 font-mono">${p.expiryDate}</strong></span>
              <span>•</span>
              <span>Tồn kho lô: <strong class="${isLowStock ? 'text-red-600 font-black' : 'text-slate-800'}">${p.stock}</strong> cái (Ngưỡng: ${minAlert})</span>
              <span>•</span>
              <span>Giá niêm yết: <strong class="text-slate-700">${formatVND(p.originalPrice)}</strong></span>
              ${discountRate > 0 ? `<span>• Giá sau giảm: <strong class="text-red-600 font-black">${formatVND(p.price)}</strong></span>` : ''}
            </div>
          </div>
        </div>

        <!-- Right: Custom % Discount & Return to Supplier Actions -->
        <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2.5 shrink-0 w-full lg:w-auto">
          
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-700">Thiết lập % xả hàng:</span>
            ${discountRate > 0 ? `
              <span class="px-2 py-0.5 rounded-lg bg-red-600 text-white font-black text-[10px]">
                Đang giảm -${discountRate}%
              </span>
            ` : ''}
          </div>

          <!-- Custom Percentage Input & Apply Button -->
          <div class="flex items-center gap-2">
            <div class="relative flex items-center">
              <input 
                type="number" 
                id="fefo-rate-${p.id}" 
                min="1" 
                max="95" 
                value="${discountRate > 0 ? discountRate : 30}" 
                class="w-16 px-2.5 py-1.5 text-center font-black rounded-xl border border-slate-300 text-xs bg-white outline-hidden focus:border-[#005A2B]"
              >
              <span class="ml-1 text-xs font-black text-slate-600">%</span>
            </div>

            <!-- Quick pick buttons -->
            <div class="flex items-center gap-1">
              <button onclick="setFefoInputRate('${p.id}', 20)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">20%</button>
              <button onclick="setFefoInputRate('${p.id}', 35)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">35%</button>
              <button onclick="setFefoInputRate('${p.id}', 50)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">50%</button>
            </div>

            <button 
              onclick="applyCustomFefoDiscount('${p.id}')" 
              class="px-3 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-xs shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              <i data-lucide="tag" class="w-3.5 h-3.5"></i>
              <span>Giảm Giá</span>
            </button>
          </div>

          <!-- Bottom Action Buttons: Restore Price & Return to Supplier -->
          <div class="flex items-center gap-2 pt-1 border-t border-slate-200">
            <button 
              onclick="restoreFefoPrice('${p.id}')" 
              class="flex-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] transition text-center cursor-pointer"
            >
              Khôi phục giá
            </button>

            <!-- Bấm trả hàng của lô hàng đó cho nhà cung cấp -->
            <button 
              onclick="openReturnBatchModal('${p.id}')" 
              class="flex-1 py-1.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <i data-lucide="undo-2" class="w-3 h-3 text-red-600"></i>
              <span>Trả Về NCC</span>
            </button>
          </div>

        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function setFefoInputRate(productId, percent) {
  const input = document.getElementById("fefo-rate-" + productId);
  if (input) input.value = percent;
}

function applyCustomFefoDiscount(productId) {
  const input = document.getElementById("fefo-rate-" + productId);
  const percent = Number(input?.value);
  if (!percent || percent <= 0 || percent >= 100) {
    showToast("Vui lòng nhập phần trăm giảm giá hợp lệ từ 1% đến 99%!", "warning");
    return;
  }

  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) return;

  const discountFraction = percent / 100;
  p.price = Math.round(p.originalPrice * (1 - discountFraction));
  saveProducts(products);
  renderFefoAlerts();
  renderProductsTable();
  showToast(`🏷️ Đã gắn nhãn GIẢM GIÁ -${percent}% ở góc trên bên phải cho "${p.name}". Giá mới: ${formatVND(p.price)}`, "success");
}

function restoreFefoPrice(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) return;

  p.price = p.originalPrice;
  saveProducts(products);
  renderFefoAlerts();
  renderProductsTable();
  showToast(`Đã khôi phục giá niêm yết cho "${p.name}": ${formatVND(p.originalPrice)}`, "info");
}

// Modal Trả hàng cho Nhà Cung Cấp
function openReturnBatchModal(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    showToast("Không tìm thấy sản phẩm này trong kho!", "error");
    return;
  }

  document.getElementById("return-modal-prod-id").value = p.id;
  document.getElementById("return-modal-product-name").innerText = p.name;
  document.getElementById("return-modal-batch-code").innerText = p.batchCode || 'LOT-2026';
  document.getElementById("return-modal-current-stock").innerText = p.stock + " sản phẩm";
  document.getElementById("return-modal-quantity").value = p.stock > 0 ? p.stock : 1;
  document.getElementById("return-modal-quantity").max = Math.max(1, p.stock);

  const modal = document.getElementById("return-batch-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();

  showToast(`📋 Đã mở phiếu xuất trả Nhà cung cấp cho "${p.name}". Vui lòng kiểm tra số lượng và bấm "Xác Nhận Xuất Trả".`, "info");
}

function closeReturnBatchModal() {
  const modal = document.getElementById("return-batch-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function confirmReturnBatch() {
  const prodId = document.getElementById("return-modal-prod-id").value;
  const returnQty = Number(document.getElementById("return-modal-quantity").value);
  const reason = document.getElementById("return-modal-reason").value;

  const products = getProducts();
  const p = products.find(prod => prod.id === prodId);
  if (!p) return;

  if (returnQty <= 0 || returnQty > p.stock) {
    showToast("Số lượng xuất trả không hợp lệ hoặc vượt quá tồn kho hiện tại!", "warning");
    return;
  }

  p.stock -= returnQty;
  p.returnedQty = (p.returnedQty || 0) + returnQty;
  p.returnReason = reason;
  saveProducts(products);

  // Đồng bộ tồn kho & trạng thái đã xuất trả vào báo cáo nhân viên
  const reports = getInventoryReports();
  reports.forEach(r => {
    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        if (it.id === prodId) {
          it.stock = p.stock;
          it.returnedQty = (it.returnedQty || 0) + returnQty;
        }
      });
    }
  });
  saveInventoryReports(reports);

  closeReturnBatchModal();
  renderReportsSection();
  renderFefoAlerts();
  renderProductsTable();
  checkLowStockPushNotification();

  showToast(`✅ ĐÃ TRẢ HÀNG VỀ NCC THÀNH CÔNG!\n• Đã gắn nhãn "TRẢ VỀ NCC (${p.returnedQty} cái)" ở góc trên bên phải sản phẩm "${p.name}"\n• Tồn kho còn lại: ${p.stock} cái\n• Lý do: ${reason}`, "success");
}

// ==========================================
// BỘ CÔNG CỤ XUẤT BẢNG TÍNH EXCEL (.XLS) ĐỊNH DẠNG CHUẨN:
// - Cột ngang số 1: bôi màu da trời nhạt (#BAE6FD), chữ in đậm, cỡ 14, kiểu Arial
// - Các cột ngang/dòng còn lại: chữ kiểu Arial, kích thước 12
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function exportStyledExcelTable({ filename, sheetName, columns, rows, summaryRow }) {
  const safeSheetName = (sheetName || "Sheet1").replace(/[/\\?*:[\]]/g, "_");

  // Cột ngang số 1 (Header row 1): bôi màu da trời nhạt (#BAE6FD), chữ in đậm, cỡ 14, kiểu Arial
  const headerCells = columns.map(col => {
    return `<th style="background-color: #BAE6FD !important; color: #0F172A !important; font-family: Arial, sans-serif !important; font-size: 14pt !important; font-weight: bold !important; text-align: center !important; vertical-align: middle !important; border: 1px solid #7DD3FC !important; padding: 10px 14px !important; white-space: nowrap !important;">${escapeHtml(col.header)}</th>`;
  }).join("");

  // Các dòng dữ liệu bên dưới: chữ kiểu Arial, kích thước 12
  const dataRowsHtml = rows.map((row, rIdx) => {
    const cells = columns.map(col => {
      let val = row[col.key];
      if (val === undefined || val === null) val = "";
      const align = col.align || (col.isNumber ? "right" : (col.alignCenter ? "center" : "left"));
      const numFormat = col.isNumber 
        ? 'mso-number-format:"\\#\\,\\#\\#0";' 
        : (col.isText || col.key === "phone" || col.key === "customerPhone" || col.key === "barcode" || col.key === "id" ? 'mso-number-format:"\\@";' : '');

      let displayVal = val;
      if (col.format) {
        displayVal = col.format(val, row, rIdx);
      } else if (typeof val === "number") {
        displayVal = val.toLocaleString("vi-VN");
      } else {
        displayVal = escapeHtml(String(val));
      }

      return `<td style="font-family: Arial, sans-serif !important; font-size: 12pt !important; color: #1E293B !important; border: 1px solid #CBD5E1 !important; padding: 7px 10px !important; text-align: ${align} !important; vertical-align: middle !important; ${numFormat}">${displayVal}</td>`;
    }).join("");

    return `<tr>${cells}</tr>`;
  }).join("");

  // Dòng tổng cộng ở cuối bảng nếu có (chữ kiểu Arial cỡ 12, in đậm)
  let summaryRowHtml = "";
  if (summaryRow) {
    const summaryCells = columns.map(col => {
      let val = summaryRow[col.key];
      if (val === undefined || val === null) val = "";
      const align = col.align || (col.isNumber ? "right" : (col.alignCenter ? "center" : "left"));
      const numFormat = col.isNumber 
        ? 'mso-number-format:"\\#\\,\\#\\#0";' 
        : 'mso-number-format:"\\@";';

      let displayVal = val;
      if (col.formatSummary) {
        displayVal = col.formatSummary(val, summaryRow);
      } else if (typeof val === "number") {
        displayVal = val.toLocaleString("vi-VN");
      } else {
        displayVal = escapeHtml(String(val));
      }

      return `<td style="font-family: Arial, sans-serif !important; font-size: 12pt !important; font-weight: bold !important; color: #005A2B !important; background-color: #F0FDF4 !important; border-top: 2px solid #005A2B !important; border-bottom: 2px solid #005A2B !important; border-left: 1px solid #CBD5E1 !important; border-right: 1px solid #CBD5E1 !important; padding: 9px 10px !important; text-align: ${align} !important; vertical-align: middle !important; ${numFormat}">${displayVal}</td>`;
    }).join("");

    summaryRowHtml = `<tr>${summaryCells}</tr>`;
  }

  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${safeSheetName}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body, table { font-family: Arial, sans-serif !important; font-size: 12pt !important; border-collapse: collapse !important; }
        th {
          background-color: #BAE6FD !important;
          color: #0F172A !important;
          font-family: Arial, sans-serif !important;
          font-size: 14pt !important;
          font-weight: bold !important;
          text-align: center !important;
          vertical-align: middle !important;
          border: 1px solid #7DD3FC !important;
          padding: 10px 14px !important;
        }
        td {
          font-family: Arial, sans-serif !important;
          font-size: 12pt !important;
          border: 1px solid #CBD5E1 !important;
          padding: 7px 10px !important;
          vertical-align: middle !important;
        }
      </style>
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; border: 1px solid #CBD5E1;">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${dataRowsHtml}
          ${summaryRowHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\uFEFF" + tableHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const finalFilename = filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename : filename + '.xls';
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 4. RENDER INVOICES TABLE & LỌC THEO NGÀY, TUẦN, THÁNG, NĂM & XUẤT EXCEL
// ==========================================
let currentInvoiceFilterMode = "all"; // 'all' | 'day' | 'week' | 'month' | 'year'

function getISOWeekNumber(d) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: target.getUTCFullYear() };
}

function extractInvoiceDateParts(inv) {
  const raw = inv.time || "";
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    const weekInfo = getISOWeekNumber(d);
    const weekStr = `${weekInfo.year}-W${weekInfo.week.toString().padStart(2, '0')}`;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      week: weekStr,
      dateFormatted: `${dd}/${mm}/${yyyy}`,
      dateObj: d
    };
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear().toString();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const weekInfo = getISOWeekNumber(d);
    const weekStr = `${weekInfo.year}-W${weekInfo.week.toString().padStart(2, '0')}`;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      week: weekStr,
      dateFormatted: `${dd}/${mm}/${yyyy}`,
      dateObj: d
    };
  }
  return { isoDate: "", yearMonth: "", year: "", week: "", dateFormatted: "", dateObj: null };
}

function onInvoiceFilterModeChange(mode) {
  currentInvoiceFilterMode = mode;
  const select = document.getElementById("invoice-filter-mode");
  if (select && select.value !== mode) select.value = mode;

  const dayWrap = document.getElementById("invoice-filter-day-wrap");
  const weekWrap = document.getElementById("invoice-filter-week-wrap");
  const monthWrap = document.getElementById("invoice-filter-month-wrap");
  const yearWrap = document.getElementById("invoice-filter-year-wrap");

  if (dayWrap) {
    dayWrap.classList.toggle("hidden", mode !== "day");
    dayWrap.classList.toggle("flex", mode === "day");
  }
  if (weekWrap) {
    weekWrap.classList.toggle("hidden", mode !== "week");
    weekWrap.classList.toggle("flex", mode === "week");
  }
  if (monthWrap) {
    monthWrap.classList.toggle("hidden", mode !== "month");
    monthWrap.classList.toggle("flex", mode === "month");
  }
  if (yearWrap) {
    yearWrap.classList.toggle("hidden", mode !== "year");
    yearWrap.classList.toggle("flex", mode === "year");
  }

  renderInvoicesTable();
}

function getFilteredInvoices() {
  const invoices = getInvoices();
  const search = document.getElementById("invoice-search-input")?.value.trim().toLowerCase() || "";

  // Populate dynamic years in select
  const yearSelect = document.getElementById("invoice-filter-year");
  if (yearSelect) {
    const existingYears = new Set(["2026", "2025", "2024"]);
    invoices.forEach(inv => {
      const { year } = extractInvoiceDateParts(inv);
      if (year) existingYears.add(year);
    });
    const currVal = yearSelect.value || "2026";
    const sorted = Array.from(existingYears).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = sorted.map(y => `<option value="${y}" ${y === currVal ? "selected" : ""}>Năm ${y}</option>`).join("");
  }

  let filtered = invoices;
  let filterLabel = "Tất cả thời gian";
  let fileSuffix = "Tat_Ca";

  if (currentInvoiceFilterMode === "day") {
    const dayVal = document.getElementById("invoice-filter-date")?.value || "";
    if (dayVal) {
      const [yyyy, mm, dd] = dayVal.split("-");
      filterLabel = `ngày ${dd}/${mm}/${yyyy}`;
      fileSuffix = `Ngay_${dayVal}`;
      filtered = filtered.filter(inv => extractInvoiceDateParts(inv).isoDate === dayVal);
    }
  } else if (currentInvoiceFilterMode === "week") {
    const weekVal = document.getElementById("invoice-filter-week")?.value || "";
    if (weekVal) {
      filterLabel = `tuần ${weekVal}`;
      fileSuffix = `Tuan_${weekVal}`;
      filtered = filtered.filter(inv => extractInvoiceDateParts(inv).week === weekVal);
    }
  } else if (currentInvoiceFilterMode === "month") {
    const monthVal = document.getElementById("invoice-filter-month")?.value || "";
    if (monthVal) {
      const [yyyy, mm] = monthVal.split("-");
      filterLabel = `tháng ${mm}/${yyyy}`;
      fileSuffix = `Thang_${monthVal}`;
      filtered = filtered.filter(inv => extractInvoiceDateParts(inv).yearMonth === monthVal);
    }
  } else if (currentInvoiceFilterMode === "year") {
    const yearVal = document.getElementById("invoice-filter-year")?.value || "2026";
    filterLabel = `năm ${yearVal}`;
    fileSuffix = `Nam_${yearVal}`;
    filtered = filtered.filter(inv => extractInvoiceDateParts(inv).year === yearVal);
  }

  if (search) {
    filtered = filtered.filter(inv => 
      (inv.id && inv.id.toLowerCase().includes(search)) ||
      (inv.cashier && inv.cashier.toLowerCase().includes(search)) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(search)) ||
      (inv.customerPhone && inv.customerPhone.includes(search))
    );
  }

  return { filtered, filterLabel, fileSuffix };
}

function renderInvoicesTable() {
  const { filtered, filterLabel } = getFilteredInvoices();
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;

  // Cập nhật thẻ tóm tắt doanh số đang lọc
  let totalRev = 0;
  let totalCash = 0;
  let totalTransfer = 0;

  filtered.forEach(inv => {
    totalRev += (inv.totalAmount || 0);
    if (inv.paymentMethod === "Tiền mặt") {
      totalCash += (inv.totalAmount || 0);
    } else {
      totalTransfer += (inv.totalAmount || 0);
    }
  });

  const revEl = document.getElementById("inv-summary-total-revenue");
  const ordEl = document.getElementById("inv-summary-total-orders");
  const cashEl = document.getElementById("inv-summary-cash");
  const transferEl = document.getElementById("inv-summary-transfer");
  const labelEl = document.getElementById("inv-summary-scope-label");

  if (revEl) revEl.innerText = formatVND(totalRev);
  if (ordEl) ordEl.innerText = `${filtered.length} đơn bán`;
  if (cashEl) cashEl.innerText = formatVND(totalCash);
  if (transferEl) transferEl.innerText = formatVND(totalTransfer);
  if (labelEl) labelEl.innerText = `Phạm vi: ${filterLabel}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <span>Không tìm thấy hóa đơn nào trong ${filterLabel}.</span>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(inv => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
      <td class="p-3 font-mono font-bold text-slate-900">${inv.id}</td>
      <td class="p-3 text-slate-600">${inv.time}</td>
      <td class="p-3 font-semibold text-slate-800">${inv.cashier}</td>
      <td class="p-3 font-black text-[#005A2B]">${formatVND(inv.totalAmount)}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${inv.paymentMethod === 'Tiền mặt' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
          ${inv.paymentMethod}
        </span>
      </td>
      <td class="p-3 font-mono text-slate-500">${inv.customerPhone ? `${inv.customerName || 'Khách'} (${inv.customerPhone})` : "Khách vãng lai"}</td>
      <td class="p-3 text-center">
        <!-- Nút Xem chi tiết hóa đơn -->
        <button 
          onclick="openInvoiceDetailModal('${inv.id}')" 
          class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
          title="Xem chi tiết hóa đơn"
        >
          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          <span>Chi tiết</span>
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function exportFilteredInvoicesToExcel() {
  const { filtered, filterLabel, fileSuffix } = getFilteredInvoices();

  if (!filtered || filtered.length === 0) {
    showToast(`Không có hóa đơn nào trong phạm vi lọc (${filterLabel}) để xuất file Excel!`, "warning");
    return;
  }

  const columns = [
    { header: "STT", key: "stt", alignCenter: true, isText: true },
    { header: "Mã Hóa Đơn", key: "id", alignCenter: true, isText: true },
    { header: "Thời Gian", key: "time", alignCenter: true, isText: true },
    { header: "Thu Ngân Bán Hàng", key: "cashier", align: "left" },
    { header: "Khách Hàng", key: "customerName", align: "left" },
    { header: "Số Điện Thoại CRM", key: "customerPhone", alignCenter: true, isText: true },
    { header: "Phương Thức Thanh Toán", key: "paymentMethod", alignCenter: true },
    { header: "Tiền Hàng (VND)", key: "subtotal", isNumber: true },
    { header: "Giảm Giá Hội Viên (VND)", key: "memberDiscount", isNumber: true },
    { header: "Thuế VAT 8% (VND)", key: "vat", isNumber: true },
    { header: "Tổng Tiền Thanh Toán (VND)", key: "totalAmount", isNumber: true },
    { header: "Tiền Khách Đưa (VND)", key: "receivedAmount", isNumber: true },
    { header: "Tiền Thừa Trả Lại (VND)", key: "changeDue", isNumber: true },
    { header: "Chi Tiết Sản Phẩm Đã Mua", key: "itemsDetails", align: "left" }
  ];

  const rows = filtered.map((inv, index) => {
    const itemsText = (inv.items || []).map(it => `${it.name} (SL: ${it.quantity} x ${formatVND(it.price)})`).join("; ");
    return {
      stt: index + 1,
      id: inv.id || "",
      time: inv.time || "",
      cashier: inv.cashier || "",
      customerName: inv.customerName || "Khách vãng lai",
      customerPhone: inv.customerPhone || "",
      paymentMethod: inv.paymentMethod || "Tiền mặt",
      subtotal: Number(inv.subtotal || 0),
      memberDiscount: Number(inv.memberDiscount || 0),
      vat: Number(inv.vat || 0),
      totalAmount: Number(inv.totalAmount || 0),
      receivedAmount: Number(inv.receivedAmount || 0),
      changeDue: Number(inv.changeDue || 0),
      itemsDetails: itemsText
    };
  });

  const sumSubtotal = filtered.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const sumDiscount = filtered.reduce((s, i) => s + Number(i.memberDiscount || 0), 0);
  const sumVat = filtered.reduce((s, i) => s + Number(i.vat || 0), 0);
  const sumTotal = filtered.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const sumReceived = filtered.reduce((s, i) => s + Number(i.receivedAmount || 0), 0);
  const sumChange = filtered.reduce((s, i) => s + Number(i.changeDue || 0), 0);

  const summaryRow = {
    stt: "",
    id: `TỔNG CỘNG (${filtered.length} ĐƠN)`,
    time: filterLabel.toUpperCase(),
    cashier: "",
    customerName: "",
    customerPhone: "",
    paymentMethod: "",
    subtotal: sumSubtotal,
    memberDiscount: sumDiscount,
    vat: sumVat,
    totalAmount: sumTotal,
    receivedAmount: sumReceived,
    changeDue: sumChange,
    itemsDetails: ""
  };

  const fileName = `Lich_Su_Hoa_Don_Emart_${fileSuffix}.xls`;

  exportStyledExcelTable({
    filename: fileName,
    sheetName: "LichSuHoaDon",
    columns,
    rows,
    summaryRow
  });

  showToast(`📊 ĐÃ XUẤT FILE EXCEL HÓA ĐƠN THÀNH CÔNG!\n• Tên file: ${fileName}\n• Phạm vi lọc: ${filterLabel}\n• Số lượng: ${filtered.length} hóa đơn\n• Định dạng: Cột ngang 1 màu da trời nhạt, cỡ 14 in đậm, nội dung cỡ 12 kiểu Arial.`, "success");
}

function openInvoiceDetailModal(invoiceId) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return;

  document.getElementById("inv-modal-id").innerText = inv.id;
  document.getElementById("inv-modal-time").innerText = inv.time;
  document.getElementById("inv-modal-cashier").innerText = inv.cashier;
  document.getElementById("inv-modal-customer").innerText = inv.customerPhone ? `${inv.customerName || 'Hội viên'} (${inv.customerPhone})` : "Khách hàng vãng lai";
  document.getElementById("inv-modal-method").innerText = inv.paymentMethod;

  const itemsContainer = document.getElementById("inv-modal-items");
  if (itemsContainer && inv.items) {
    itemsContainer.innerHTML = inv.items.map(item => `
      <div class="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
        <div>
          <p class="font-bold text-slate-900">${item.name}</p>
          <p class="text-[10px] text-slate-400">${formatVND(item.price)} x ${item.quantity}</p>
        </div>
        <span class="font-black text-[#005A2B]">${formatVND(item.price * item.quantity)}</span>
      </div>
    `).join('');
  }

  const subtotal = inv.subtotal || inv.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const discount = inv.memberDiscount || 0;
  const vat = inv.vat || Math.round((subtotal - discount) * 0.08);

  document.getElementById("inv-modal-subtotal").innerText = formatVND(subtotal);
  document.getElementById("inv-modal-discount").innerText = discount > 0 ? `-${formatVND(discount)}` : "0 ₫";
  document.getElementById("inv-modal-vat").innerText = formatVND(vat);
  document.getElementById("inv-modal-total").innerText = formatVND(inv.totalAmount);

  const modal = document.getElementById("invoice-detail-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeInvoiceDetailModal() {
  const modal = document.getElementById("invoice-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// ==========================================
// 5. RENDER STAFF TABLE (Danh sách đang làm việc & Bảng nghỉ việc/tạm nghỉ việc ở dưới)
// ==========================================
function renderStaffTable() {
  const staff = getStaffList();
  const tbody = document.getElementById("staff-table-body");
  const inactiveTbody = document.getElementById("inactive-staff-table-body");
  const activeCountEl = document.getElementById("active-staff-count");
  const inactiveCountEl = document.getElementById("inactive-staff-count");
  if (!tbody) return;

  const activeStaff = staff.filter(s => s.role === "Chủ cửa hàng" || !s.status || s.status === "Đang làm việc");
  const inactiveStaff = staff.filter(s => s.role !== "Chủ cửa hàng" && s.status && s.status !== "Đang làm việc");

  if (activeCountEl) activeCountEl.innerText = `${activeStaff.length} nhân sự`;
  if (inactiveCountEl) inactiveCountEl.innerText = `${inactiveStaff.length} nhân sự`;

  tbody.innerHTML = activeStaff.map(s => {
    const isOwner = s.role === "Chủ cửa hàng";

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-500">${s.id}</td>
        <td class="p-3">
          <span class="font-bold text-slate-900 block">${s.name}</span>
          <span class="text-[10px] text-slate-400">${s.phone || 'Chưa cập nhật SĐT'}</span>
        </td>
        <td class="p-3 text-slate-600 font-mono">${s.email}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${
            isOwner ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'
          }">
            ${s.role}
          </span>
        </td>
        <td class="p-3 text-slate-600">${s.shift}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button 
              onclick="editStaff('${s.id}')" 
              class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
              title="Xem chi tiết & chỉnh sửa trạng thái nhân viên"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Chi tiết</span>
            </button>
            ${!isOwner ? `
              <button 
                onclick="deleteStaff('${s.id}')" 
                class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                title="Xóa nhân viên"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (inactiveTbody) {
    if (inactiveStaff.length === 0) {
      inactiveTbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-6 text-center text-slate-400 text-xs">
            <span>Hiện không có nhân viên nào trong danh sách nghỉ việc / tạm nghỉ việc.</span>
          </td>
        </tr>
      `;
    } else {
      inactiveTbody.innerHTML = inactiveStaff.map(s => `
        <tr class="border-b border-slate-100 bg-red-50/20 hover:bg-red-50/40 transition text-xs">
          <td class="p-3 font-mono font-bold text-slate-400">${s.id}</td>
          <td class="p-3">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-700 line-through">${s.name}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">Đã khóa TK</span>
            </div>
            <span class="text-[10px] text-slate-400">${s.phone || 'Chưa cập nhật SĐT'}</span>
          </td>
          <td class="p-3 text-slate-500 font-mono">${s.email}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-600">
              ${s.role}
            </span>
          </td>
          <td class="p-3 text-slate-500">${s.shift}</td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button 
                onclick="editStaff('${s.id}')" 
                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                title="Chi tiết nhân viên & mở khóa tài khoản"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                <span>Chi tiết</span>
              </button>
              <button 
                onclick="deleteStaff('${s.id}')" 
                class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                title="Xóa nhân viên"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function openAddStaffModal() {
  document.getElementById("modal-staff-title").innerText = "Thêm Nhân Viên Mới";
  document.getElementById("modal-staff-id").value = "";
  document.getElementById("staff-name").value = "";
  document.getElementById("staff-email").value = "";
  document.getElementById("staff-password").value = "123";
  document.getElementById("staff-phone").value = "";
  document.getElementById("staff-role").value = "Nhân viên thu ngân";
  document.getElementById("staff-role").disabled = false;
  document.getElementById("staff-shift").value = "Ca Sáng (06:00 - 14:00)";
  const statusSelect = document.getElementById("staff-status");
  if (statusSelect) {
    statusSelect.value = "Đang làm việc";
    statusSelect.disabled = false;
  }

  const modal = document.getElementById("staff-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeStaffModal() {
  const modal = document.getElementById("staff-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function saveStaffFromModal(e) {
  e.preventDefault();
  const id = document.getElementById("modal-staff-id").value;
  const name = document.getElementById("staff-name").value.trim();
  const email = document.getElementById("staff-email").value.trim();
  const password = document.getElementById("staff-password").value.trim();
  const phone = document.getElementById("staff-phone").value.trim();
  const role = document.getElementById("staff-role").value;
  const shift = document.getElementById("staff-shift").value;
  const status = document.getElementById("staff-status")?.value || "Đang làm việc";

  const staffList = getStaffList();

  if (id) {
    const s = staffList.find(item => item.id === id);
    if (s) {
      s.name = name;
      s.email = email;
      s.password = password;
      s.phone = phone;
      // Protect owner role & status if modifying owner
      if (s.role !== "Chủ cửa hàng") {
        s.role = role;
        s.status = status;
      } else {
        s.status = "Đang làm việc";
      }
      s.shift = shift;
    }
  } else {
    // Check email uniqueness
    if (staffList.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      showToast("Email này đã được sử dụng cho một nhân viên khác!", "error");
      return;
    }

    const newStaff = {
      id: "st-" + String(staffList.length + 1).padStart(2, "0"),
      name,
      email,
      password,
      phone,
      role,
      shift,
      status: role === "Chủ cửa hàng" ? "Đang làm việc" : status
    };
    staffList.push(newStaff);
  }

  saveStaffList(staffList);
  closeStaffModal();
  renderStaffTable();
  showToast("Lưu thông tin nhân viên thành công!", "success");
}

function editStaff(staffId) {
  const staffList = getStaffList();
  const s = staffList.find(item => item.id === staffId);
  if (!s) return;

  document.getElementById("modal-staff-title").innerText = "Chi Tiết Nhân Viên & Trạng Thái";
  document.getElementById("modal-staff-id").value = s.id;
  document.getElementById("staff-name").value = s.name;
  document.getElementById("staff-email").value = s.email;
  document.getElementById("staff-password").value = s.password;
  document.getElementById("staff-phone").value = s.phone || "";
  document.getElementById("staff-role").value = s.role;
  document.getElementById("staff-shift").value = s.shift;

  const statusSelect = document.getElementById("staff-status");
  if (statusSelect) {
    statusSelect.value = (!s.status || s.status === "Đang làm việc")
      ? "Đang làm việc"
      : "Nghỉ việc (Khóa tài khoản không đăng nhập được)";
  }

  // If editing store owner, disable role & status dropdowns
  const roleSelect = document.getElementById("staff-role");
  if (s.role === "Chủ cửa hàng") {
    roleSelect.disabled = true;
    if (statusSelect) {
      statusSelect.value = "Đang làm việc";
      statusSelect.disabled = true;
    }
  } else {
    roleSelect.disabled = false;
    if (statusSelect) statusSelect.disabled = false;
  }

  const modal = document.getElementById("staff-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function toggleStaffStatus(staffId) {
  const staffList = getStaffList();
  const s = staffList.find(item => item.id === staffId);
  if (!s) return;

  if (s.role === "Chủ cửa hàng") {
    showToast("Tài khoản Chủ cửa hàng là tài khoản quản trị tối cao, không thể thay đổi trạng thái!", "warning");
    return;
  }

  s.status = s.status === "Đang làm việc" ? "Nghỉ việc (Khóa tài khoản không đăng nhập được)" : "Đang làm việc";
  saveStaffList(staffList);
  renderStaffTable();
}

function deleteStaff(staffId) {
  const staffList = getStaffList();
  const s = staffList.find(item => item.id === staffId);
  if (!s) return;

  if (s.role === "Chủ cửa hàng") {
    showToast("Không thể xóa tài khoản Chủ cửa hàng!", "warning");
    return;
  }

  if (confirm(`Bạn có chắc chắn muốn xóa nhân viên "${s.name}"?`)) {
    const updated = staffList.filter(item => item.id !== staffId);
    saveStaffList(updated);
    renderStaffTable();
  }
}

// ==========================================
// 6. RENDER CRM TABLE & LỌC THEO NGÀY THAM GIA, LỚP & XUẤT EXCEL
// ==========================================
let currentSelectedCustomer = null;
let currentCrmDateFilterMode = "all"; // 'all' | 'day' | 'month' | 'year'

function extractCustomerJoinedDateParts(c) {
  const raw = c.joinedDate || "";
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      displayDate: `${dd}/${mm}/${yyyy}`
    };
  }
  const matchIso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    const [, yyyy, mm, dd] = matchIso;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      displayDate: `${dd}/${mm}/${yyyy}`
    };
  }
  return { isoDate: "", yearMonth: "", year: "", displayDate: raw || "Chưa rõ" };
}

function onCrmDateFilterModeChange(mode) {
  currentCrmDateFilterMode = mode;
  const select = document.getElementById("crm-date-filter-mode");
  if (select && select.value !== mode) select.value = mode;

  const dayWrap = document.getElementById("crm-filter-day-wrap");
  const monthWrap = document.getElementById("crm-filter-month-wrap");
  const yearWrap = document.getElementById("crm-filter-year-wrap");

  if (dayWrap) {
    dayWrap.classList.toggle("hidden", mode !== "day");
    dayWrap.classList.toggle("flex", mode === "day");
  }
  if (monthWrap) {
    monthWrap.classList.toggle("hidden", mode !== "month");
    monthWrap.classList.toggle("flex", mode === "month");
  }
  if (yearWrap) {
    yearWrap.classList.toggle("hidden", mode !== "year");
    yearWrap.classList.toggle("flex", mode === "year");
  }

  renderCrmTable();
}

function getFilteredCustomers() {
  const customers = getCustomers();
  const tierFilter = document.getElementById("crm-filter-tier")?.value || "all";
  const search = document.getElementById("crm-search-input")?.value.trim().toLowerCase() || "";

  // Populate dynamic years in select
  const yearSelect = document.getElementById("crm-filter-year");
  if (yearSelect) {
    const existingYears = new Set(["2026", "2025"]);
    customers.forEach(c => {
      const { year } = extractCustomerJoinedDateParts(c);
      if (year) existingYears.add(year);
    });
    const currVal = yearSelect.value || "2026";
    const sorted = Array.from(existingYears).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = sorted.map(y => `<option value="${y}" ${y === currVal ? "selected" : ""}>Năm ${y}</option>`).join("");
  }

  let filtered = customers;
  let dateLabel = "Tất cả ngày tham gia";
  let fileSuffix = "Tat_Ca";

  if (currentCrmDateFilterMode === "day") {
    const dayVal = document.getElementById("crm-filter-date")?.value || "";
    if (dayVal) {
      const [yyyy, mm, dd] = dayVal.split("-");
      dateLabel = `ngày tham gia ${dd}/${mm}/${yyyy}`;
      fileSuffix = `Ngay_${dayVal}`;
      filtered = filtered.filter(c => extractCustomerJoinedDateParts(c).isoDate === dayVal);
    }
  } else if (currentCrmDateFilterMode === "month") {
    const monthVal = document.getElementById("crm-filter-month")?.value || "";
    if (monthVal) {
      const [yyyy, mm] = monthVal.split("-");
      dateLabel = `tháng tham gia ${mm}/${yyyy}`;
      fileSuffix = `Thang_${monthVal}`;
      filtered = filtered.filter(c => extractCustomerJoinedDateParts(c).yearMonth === monthVal);
    }
  } else if (currentCrmDateFilterMode === "year") {
    const yearVal = document.getElementById("crm-filter-year")?.value || "2026";
    dateLabel = `năm tham gia ${yearVal}`;
    fileSuffix = `Nam_${yearVal}`;
    filtered = filtered.filter(c => extractCustomerJoinedDateParts(c).year === yearVal);
  }

  if (tierFilter && tierFilter !== "all") {
    filtered = filtered.filter(c => c.tier === tierFilter);
    fileSuffix += `_Lop_${tierFilter}`;
  }

  if (search) {
    filtered = filtered.filter(c => 
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.phone && c.phone.includes(search))
    );
  }

  const tierLabel = tierFilter && tierFilter !== "all" ? ` • Lớp ${tierFilter}` : "";
  const filterLabel = `${dateLabel}${tierLabel}`;

  return { filtered, filterLabel, fileSuffix, tierFilter };
}

function renderCrmTable() {
  const { filtered, filterLabel, tierFilter } = getFilteredCustomers();
  const invoices = getInvoices();
  const tbody = document.getElementById("crm-table-body");
  if (!tbody) return;

  // Tính metrics
  let totalPoints = 0;
  let totalSpentSum = 0;

  filtered.forEach(c => {
    totalPoints += (c.points || 0);
    const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
    const spent = custInvoices.length > 0 
      ? custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
      : (c.totalSpent || 0);
    totalSpentSum += spent;
  });

  const countEl = document.getElementById("crm-summary-count");
  const pointsEl = document.getElementById("crm-summary-points");
  const spentEl = document.getElementById("crm-summary-spent");
  const scopeEl = document.getElementById("crm-summary-scope-label");

  if (countEl) countEl.innerText = `${filtered.length} thành viên`;
  if (pointsEl) pointsEl.innerText = `${totalPoints.toLocaleString()} điểm (~${formatVND(totalPoints)})`;
  if (spentEl) spentEl.innerText = formatVND(totalSpentSum);
  if (scopeEl) scopeEl.innerText = `Lọc: ${filterLabel}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <span>Không tìm thấy khách hàng nào theo điều kiện lọc (${filterLabel}).</span>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    // Tính tổng chi tiêu chuẩn xác theo lịch sử các hóa đơn thực tế của khách hàng
    const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
    const totalSpent = custInvoices.length > 0
      ? custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
      : (c.totalSpent || 0);
    const { displayDate } = extractCustomerJoinedDateParts(c);

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-900">${c.phone}</td>
        <td class="p-3 font-bold text-slate-800">${c.name}</td>
        <td class="p-3 text-slate-600 font-mono">${displayDate}</td>
        <td class="p-3">
          <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
            c.tier === 'Kim Cương' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
            c.tier === 'Vàng' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
            c.tier === 'Bạc' ? 'bg-slate-100 text-slate-800 border border-slate-300' :
            'bg-orange-100 text-orange-900 border border-orange-200'
          }">
            Lớp ${c.tier}
          </span>
        </td>
        <td class="p-3 font-black text-[#FFA500]">
          ${c.points.toLocaleString()} điểm 
          <span class="text-[10px] text-slate-400 font-normal block">(~${formatVND(c.points)})</span>
        </td>
        <td class="p-3 font-black text-[#005A2B]">${formatVND(totalSpent)}</td>
        <td class="p-3 text-center">
          <!-- Nút xem chi tiết chi tiêu & xét duyệt nâng hạng -->
          <button 
            onclick="openCrmDetailModal('${c.phone}')" 
            class="px-2.5 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs"
            title="Xem chi tiết chi tiêu & Xét duyệt nâng hạng"
          >
            <i data-lucide="award" class="w-3.5 h-3.5"></i>
            <span>Chi tiết & Xét hạng</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function exportFilteredCustomersToExcel() {
  const { filtered, filterLabel, fileSuffix } = getFilteredCustomers();
  const invoices = getInvoices();

  if (!filtered || filtered.length === 0) {
    showToast(`Không có khách hàng nào trong phạm vi lọc (${filterLabel}) để xuất file Excel!`, "warning");
    return;
  }

  const columns = [
    { header: "STT", key: "stt", alignCenter: true, isText: true },
    { header: "Số Điện Thoại", key: "phone", alignCenter: true, isText: true },
    { header: "Tên Khách Hàng", key: "name", align: "left" },
    { header: "Ngày Tham Gia", key: "joinedDate", alignCenter: true, isText: true },
    { header: "Lớp / Hạng Thành Viên", key: "tier", alignCenter: true },
    { header: "Điểm Tích Lũy", key: "points", isNumber: true },
    { header: "Giá Trị Điểm Quy Đổi (VND)", key: "pointsVnd", isNumber: true },
    { header: "Tổng Chi Tiêu Thực Tế (VND)", key: "totalSpent", isNumber: true },
    { header: "Số Đơn Hàng Đã Mua", key: "orderCount", isNumber: true }
  ];

  const rows = filtered.map((c, index) => {
    const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
    const totalSpent = custInvoices.length > 0 
      ? custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
      : (c.totalSpent || 0);
    const { displayDate } = extractCustomerJoinedDateParts(c);

    return {
      stt: index + 1,
      phone: c.phone || "",
      name: c.name || "",
      joinedDate: displayDate,
      tier: `Lớp ${c.tier}`,
      points: Number(c.points || 0),
      pointsVnd: Number(c.points || 0),
      totalSpent: Number(totalSpent || 0),
      orderCount: custInvoices.length
    };
  });

  const sumPoints = filtered.reduce((s, c) => s + Number(c.points || 0), 0);
  const sumSpent = rows.reduce((s, r) => s + Number(r.totalSpent || 0), 0);
  const sumOrders = rows.reduce((s, r) => s + Number(r.orderCount || 0), 0);

  const summaryRow = {
    stt: "",
    phone: `TỔNG CỘNG (${filtered.length} KHÁCH HÀNG)`,
    name: filterLabel.toUpperCase(),
    joinedDate: "",
    tier: "",
    points: sumPoints,
    pointsVnd: sumPoints,
    totalSpent: sumSpent,
    orderCount: sumOrders
  };

  const fileName = `Danh_Sach_Khach_Hang_CRM_Emart_${fileSuffix}.xls`;

  exportStyledExcelTable({
    filename: fileName,
    sheetName: "KhachHangCRM",
    columns,
    rows,
    summaryRow
  });

  showToast(`📊 ĐÃ XUẤT FILE EXCEL KHÁCH HÀNG THÀNH CÔNG!\n• Tên file: ${fileName}\n• Phạm vi lọc: ${filterLabel}\n• Số lượng: ${filtered.length} khách hàng\n• Định dạng: Cột ngang 1 màu da trời nhạt, cỡ 14 in đậm, nội dung cỡ 12 kiểu Arial.`, "success");
}

function openCrmDetailModal(customerPhone) {
  const customers = getCustomers();
  const invoices = getInvoices();
  const c = customers.find(item => item.phone === customerPhone);
  if (!c) return;

  currentSelectedCustomer = c;

  const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
  const totalSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalOrders = custInvoices.length;

  document.getElementById("crm-modal-phone").innerText = c.phone;
  document.getElementById("crm-modal-name").innerText = c.name;
  document.getElementById("crm-modal-joined").innerText = "Ngày tham gia: " + (c.joinedDate || "15/01/2026");
  document.getElementById("crm-modal-points").innerText = `${c.points.toLocaleString()} điểm (= ${formatVND(c.points)})`;
  document.getElementById("crm-modal-total-spent").innerText = formatVND(totalSpent);
  document.getElementById("crm-modal-orders-count").innerText = `${totalOrders} đơn hàng`;
  document.getElementById("crm-modal-current-tier").innerText = "Hạng hiện tại: " + c.tier;
  document.getElementById("crm-modal-tier-select").value = c.tier;

  // Invoices list for this customer
  const listContainer = document.getElementById("crm-modal-invoices-list");
  if (listContainer) {
    if (custInvoices.length > 0) {
      listContainer.innerHTML = custInvoices.map(inv => `
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-800">${inv.id} • ${inv.time}</p>
            <p class="text-[10px] text-slate-400">${inv.items?.length || 1} món • ${inv.paymentMethod}</p>
          </div>
          <span class="font-black text-[#005A2B]">${formatVND(inv.totalAmount)}</span>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
          <p>Khách hàng chưa có hóa đơn mua sắm nào.</p>
        </div>
      `;
    }
  }

  const modal = document.getElementById("crm-detail-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeCrmDetailModal() {
  const modal = document.getElementById("crm-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function saveCrmTierUpgrade() {
  if (!currentSelectedCustomer) return;
  const newTier = document.getElementById("crm-modal-tier-select").value;

  const customers = getCustomers();
  const c = customers.find(item => item.phone === currentSelectedCustomer.phone);
  if (c) {
    c.tier = newTier;
    saveCustomers(customers);
    renderCrmTable();
    closeCrmDetailModal();
    showToast(`Đã nâng hạng thành viên "${c.name}" lên: HẠNG ${newTier} thành công!`, "success");
  }
}

function autoEvaluateTierBySpending() {
  if (!currentSelectedCustomer) return;
  const invoices = getInvoices();
  const custInvoices = invoices.filter(inv => inv.customerPhone === currentSelectedCustomer.phone);
  const totalSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  let suggestedTier = "Đồng";
  if (totalSpent >= 5000000) {
    suggestedTier = "Kim Cương";
  } else if (totalSpent >= 2000000) {
    suggestedTier = "Vàng";
  } else if (totalSpent >= 500000) {
    suggestedTier = "Bạc";
  }

  document.getElementById("crm-modal-tier-select").value = suggestedTier;
  showToast(`Căn cứ vào tổng chi tiêu ${formatVND(totalSpent)}, hệ thống gợi ý xếp khách hàng vào: HẠNG ${suggestedTier}. Vui lòng bấm "Nâng Hạng" để lưu!`, "info");
}

// ==========================================
// 7. DUYỆT BÁO CÁO CẬN DATE & TỒN KHO TỪ NHÂN VIÊN
// (Chủ duyệt -> Kích hoạt Set giảm giá & Set trả hàng)
// ==========================================
function checkPendingReportsNotification() {
  const reports = getInventoryReports();
  const pending = reports.filter(r => r.status === "Chờ duyệt");
  const badge = document.getElementById("header-report-alert-badge");
  const text = document.getElementById("header-report-alert-text");
  const sidebarBadge = document.getElementById("sidebar-report-badge");

  if (sidebarBadge) {
    if (pending.length > 0) {
      sidebarBadge.classList.remove("hidden");
      sidebarBadge.innerText = pending.length;
    } else {
      sidebarBadge.classList.add("hidden");
    }
  }

  if (badge && text) {
    if (pending.length > 0) {
      badge.classList.remove("hidden");
      text.innerText = `Có ${pending.length} báo cáo kiểm kê từ Nhân viên chờ duyệt!`;
    } else {
      badge.classList.add("hidden");
    }
  }
}

function renderReportsSection() {
  const reports = getInventoryReports();
  const container = document.getElementById("reports-container");
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
        <p class="font-bold text-slate-700">Chưa có báo cáo kiểm kê nào được gửi từ nhân viên</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = reports.map(report => {
    const isPending = report.status === "Chờ duyệt";

    return `
      <div class="bg-white rounded-3xl border ${isPending ? 'border-amber-300 shadow-md' : 'border-slate-200 shadow-xs'} p-5 space-y-4 transition">
        
        <!-- Report Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
                isPending ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-emerald-100 text-emerald-800'
              }">
                ● ${report.status}
              </span>
              <h3 class="font-black text-sm text-slate-900 font-mono">${report.id}</h3>
              <span class="text-xs text-slate-400">• ${report.submittedAt}</span>
            </div>
            <p class="text-xs text-slate-600">
              Nhân viên gửi: <strong class="text-slate-800">${report.reporterName}</strong> (Mã NV: <span class="font-mono">${report.reporterId}</span>)
            </p>
          </div>

          <!-- Action Button for Store Owner: Approve Report -->
          <div>
            ${isPending ? `
              <button 
                onclick="approveReport('${report.id}')" 
                class="px-4 py-2 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <i data-lucide="check-check" class="w-4 h-4"></i>
                <span>DUYỆT BÁO CÁO NÀY</span>
              </button>
            ` : `
              <span class="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                <span>Đã phê duyệt (Được quyền Giảm giá & Trả hàng)</span>
              </span>
            `}
          </div>
        </div>

        <!-- Staff Note -->
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700">
          <span class="font-bold text-slate-900 block mb-0.5">Lời nhắn từ nhân viên:</span>
          <p class="italic">"${report.note || 'Không có ghi chú thêm.'}"</p>
        </div>

        <!-- Table of reported products -->
        <div>
          <p class="font-bold text-xs text-slate-800 mb-2 uppercase">
            Danh sách hàng hóa cần can thiệp (${report.items?.length || 0} sản phẩm):
          </p>
          
          <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="p-3">Sản phẩm & Lô</th>
                  <th class="p-3">Tồn kho</th>
                  <th class="p-3">Hạn sử dụng</th>
                  <th class="p-3">Tình trạng rủi ro</th>
                  <th class="p-3 text-center">Thao tác sau duyệt</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${report.items.map(item => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3">
                      <span class="font-bold text-slate-900 block">${item.name}</span>
                      <span class="text-[10px] text-slate-400 font-mono">#${item.barcode} • Lô: ${item.batchCode}</span>
                      <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        ${item.appliedDiscount ? `<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[#005A2B] font-black text-[10px] border border-emerald-300">Đã giảm -${item.appliedDiscount}% (${formatVND(item.newPrice || 0)})</span>` : ''}
                        ${item.returnedQty ? `<span class="px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-black text-[10px] border border-red-300">Đã trả NCC: ${item.returnedQty} cái</span>` : ''}
                      </div>
                    </td>
                    <td class="p-3 font-bold ${item.stock <= (item.minStockAlert || 5) ? 'text-red-600' : 'text-slate-800'}">
                      ${item.stock} cái
                    </td>
                    <td class="p-3 font-mono text-slate-700">
                      ${item.expiryDate} 
                      <span class="font-bold ${item.daysLeft <= 1 ? 'text-red-600' : 'text-amber-600'}">(${item.daysLeft}d)</span>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        item.daysLeft <= 1 ? 'bg-red-100 text-red-700 border border-red-200' :
                        item.daysLeft <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800'
                      }">
                        ${item.type}
                      </span>
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      ${!isPending ? `
                        <div class="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <!-- Khi chủ duyệt thì sẽ được giảm giá -->
                          <button 
                            onclick="quickSetDiscountFromReport('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            title="Chủ cửa hàng thiết lập % giảm giá xả hàng"
                          >
                            <i data-lucide="tag" class="w-3 h-3 shrink-0"></i>
                            <span>Giảm giá</span>
                          </button>
                          
                          <!-- Khi chủ duyệt thì sẽ được trả hàng -->
                          <button 
                            onclick="openReturnBatchModal('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[11px] transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            title="Xuất trả lô hàng cho Nhà cung cấp"
                          >
                            <i data-lucide="undo-2" class="w-3 h-3 text-red-600 shrink-0"></i>
                            <span>Trả hàng</span>
                          </button>
                        </div>
                      ` : `
                        <span class="text-[11px] text-slate-400 italic whitespace-nowrap">Vui lòng bấm duyệt báo cáo trước</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function approveReport(reportId) {
  const reports = getInventoryReports();
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  report.status = "Đã duyệt";
  saveInventoryReports(reports);
  renderReportsSection();
  checkPendingReportsNotification();
  showToast(`Đã duyệt báo cáo ${reportId} thành công!\nHiện tại bạn có thể bấm trực tiếp các nút "Giảm giá" và "Trả hàng" cho từng món trong báo cáo.`, "success");
}

let currentDiscountProduct = null;

function quickSetDiscountFromReport(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    showToast("Không tìm thấy sản phẩm này trong danh mục kho!", "error");
    return;
  }

  currentDiscountProduct = p;
  const currentPercent = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 30;

  document.getElementById("discount-modal-prod-id").value = p.id;
  document.getElementById("discount-modal-product-name").innerText = p.name;
  document.getElementById("discount-modal-original-price").innerText = formatVND(p.originalPrice);
  document.getElementById("discount-modal-percent").value = currentPercent;
  updateReportDiscountPreview();

  const modal = document.getElementById("report-discount-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();

  showToast(`🏷️ Đang mở bảng thiết lập % giảm giá cho "${p.name}". Chọn mức % và bấm "Xác Nhận Giảm Giá".`, "info");
}

function setReportDiscountRate(percent) {
  const input = document.getElementById("discount-modal-percent");
  if (input) {
    input.value = percent;
    updateReportDiscountPreview();
  }
}

function updateReportDiscountPreview() {
  if (!currentDiscountProduct) return;
  const percent = Number(document.getElementById("discount-modal-percent")?.value) || 0;
  const clamped = Math.min(99, Math.max(0, percent));
  const newPrice = Math.round(currentDiscountProduct.originalPrice * (1 - clamped / 100));
  const newPriceEl = document.getElementById("discount-modal-new-price");
  if (newPriceEl) {
    newPriceEl.innerText = `${formatVND(newPrice)} (-${clamped}%)`;
  }
}

function closeReportDiscountModal() {
  const modal = document.getElementById("report-discount-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentDiscountProduct = null;
}

function confirmReportDiscount() {
  const prodId = document.getElementById("discount-modal-prod-id").value;
  const percent = Number(document.getElementById("discount-modal-percent").value);

  if (isNaN(percent) || percent <= 0 || percent >= 100) {
    showToast("Phần trăm giảm giá không hợp lệ! Vui lòng nhập số từ 1% đến 99%.", "warning");
    return;
  }

  const products = getProducts();
  const p = products.find(prod => prod.id === prodId);
  if (!p) return;

  p.price = Math.round(p.originalPrice * (1 - percent / 100));
  saveProducts(products);

  // Đồng bộ trạng thái đã giảm giá vào báo cáo nhân viên
  const reports = getInventoryReports();
  reports.forEach(r => {
    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        if (it.id === prodId) {
          it.appliedDiscount = percent;
          it.newPrice = p.price;
        }
      });
    }
  });
  saveInventoryReports(reports);

  closeReportDiscountModal();
  renderReportsSection();
  renderFefoAlerts();
  renderProductsTable();

  showToast(`✅ ĐÃ ÁP DỤNG GIẢM GIÁ -${percent}% THÀNH CÔNG!\n• Sản phẩm: ${p.name}\n• Giá gốc: ${formatVND(p.originalPrice)} → Giá xả hàng mới: ${formatVND(p.price)}`, "success");
}

// ==========================================
// 8. CẤU HÌNH TÀI KHOẢN NGÂN HÀNG & VÍ HỘ KINH DOANH
// (Dành riêng cho Chủ cửa hàng)
// ==========================================
function renderPaymentSettingsSection() {
  const config = getPaymentConfig();

  const bankCodeEl = document.getElementById("cfg-bank-code");
  const bankNameEl = document.getElementById("cfg-bank-name");
  const accNumEl = document.getElementById("cfg-account-number");
  const accNameEl = document.getElementById("cfg-account-name");
  const momoPhoneEl = document.getElementById("cfg-momo-phone");
  const momoNameEl = document.getElementById("cfg-momo-name");
  const zalopayPhoneEl = document.getElementById("cfg-zalopay-phone");
  const zalopayNameEl = document.getElementById("cfg-zalopay-name");

  if (bankCodeEl) bankCodeEl.value = config.bankCode || "VCB";
  if (bankNameEl) bankNameEl.value = config.bankName || "Vietcombank";
  if (accNumEl) accNumEl.value = config.accountNumber || "0071008899668";
  if (accNameEl) accNameEl.value = config.accountName || "HỘ KINH DOANH CỬA HÀNG EMART - NGUYỄN VĂN AN";
  if (momoPhoneEl) momoPhoneEl.value = config.momoPhone || "0909123456";
  if (momoNameEl) momoNameEl.value = config.momoName || "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)";
  if (zalopayPhoneEl) zalopayPhoneEl.value = config.zalopayPhone || "0909123456";
  if (zalopayNameEl) zalopayNameEl.value = config.zalopayName || "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)";

  updateLiveDashboardQrPreview();
}

function updateBankNameText(selectEl) {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const bankName = selectedOption.getAttribute("data-name") || selectedOption.text;
  document.getElementById("cfg-bank-name").value = bankName;
  updateLiveDashboardQrPreview();
}

function updateLiveDashboardQrPreview() {
  const bankCode = document.getElementById("cfg-bank-code")?.value || "VCB";
  const accNum = document.getElementById("cfg-account-number")?.value || "0071008899668";
  const accName = document.getElementById("cfg-account-name")?.value || "HỘ KINH DOANH CỬA HÀNG EMART - NGUYỄN VĂN AN";
  const bankSelect = document.getElementById("cfg-bank-code");
  const bankName = bankSelect?.options[bankSelect.selectedIndex]?.text || "Vietcombank";

  const qrUrl = `https://api.vietqr.io/image/${bankCode}-${accNum}-compact2.png?amount=50000&addInfo=EMART%20POS&accountName=${encodeURIComponent(accName)}`;

  const imgEl = document.getElementById("dashboard-qr-preview");
  if (imgEl) imgEl.src = qrUrl;

  const prevName = document.getElementById("preview-acc-name");
  const prevNum = document.getElementById("preview-acc-num");
  const prevBank = document.getElementById("preview-bank");

  if (prevName) prevName.innerText = accName;
  if (prevNum) prevNum.innerText = accNum;
  if (prevBank) prevBank.innerText = bankName;
}

function savePaymentSettingsFromDashboard(e) {
  e.preventDefault();

  const bankCode = document.getElementById("cfg-bank-code").value;
  const bankSelect = document.getElementById("cfg-bank-code");
  const bankName = bankSelect.options[bankSelect.selectedIndex].getAttribute("data-name") || bankSelect.options[bankSelect.selectedIndex].text;
  const accountNumber = document.getElementById("cfg-account-number").value.trim();
  const accountName = document.getElementById("cfg-account-name").value.trim();
  const momoPhone = document.getElementById("cfg-momo-phone").value.trim();
  const momoName = document.getElementById("cfg-momo-name").value.trim();
  const zalopayPhone = document.getElementById("cfg-zalopay-phone").value.trim();
  const zalopayName = document.getElementById("cfg-zalopay-name").value.trim();

  const newConfig = {
    bankCode,
    bankName,
    accountNumber,
    accountName,
    momoPhone,
    momoName,
    zalopayPhone,
    zalopayName
  };

  savePaymentConfig(newConfig);
  updateLiveDashboardQrPreview();

  showToast(`Đã lưu cấu hình tài khoản Hộ Kinh Doanh thành công!\nNgân hàng: ${bankName}\nSố TK: ${accountNumber}\nChủ HKD: ${accountName}\n\nTất cả mã quét QR tại Quầy POS sẽ lập tức chuyển tiền về tài khoản này!`, "success");
}

// ==========================================
// 9. BÁO CÁO KẾT CA, KIỂM KÉT & TỒN KHO (LỌC TẤT CẢ / NGÀY / THÁNG / NĂM & XUẤT EXCEL)
// ==========================================
let currentShiftReportToConfirm = null;
let currentShiftFilterMode = "all"; // 'all' | 'day' | 'month' | 'year'

function extractShiftReportDateParts(r) {
  if (r.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(r.dateISO)) {
    return {
      isoDate: r.dateISO,
      yearMonth: r.dateISO.slice(0, 7),
      year: r.dateISO.slice(0, 4)
    };
  }
  const raw = r.date || r.timeSubmitted || "";
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy
    };
  }
  return { isoDate: "", yearMonth: "", year: "" };
}

function onShiftFilterSelectChange(mode) {
  currentShiftFilterMode = mode;
  const select = document.getElementById("shift-mode-select");
  if (select && select.value !== mode) select.value = mode;

  const dayWrap = document.getElementById("shift-filter-day-wrap");
  const monthWrap = document.getElementById("shift-filter-month-wrap");
  const yearWrap = document.getElementById("shift-filter-year-wrap");

  if (dayWrap) {
    dayWrap.classList.toggle("hidden", mode !== "day");
    dayWrap.classList.toggle("flex", mode === "day");
  }
  if (monthWrap) {
    monthWrap.classList.toggle("hidden", mode !== "month");
    monthWrap.classList.toggle("flex", mode === "month");
  }
  if (yearWrap) {
    yearWrap.classList.toggle("hidden", mode !== "year");
    yearWrap.classList.toggle("flex", mode === "year");
  }

  renderShiftReportsSection();
}

function setShiftFilterMode(mode) {
  onShiftFilterSelectChange(mode);
}

function clearShiftDateFilter() {
  onShiftFilterSelectChange("all");
}

function getFilteredShiftReports() {
  const reports = getShiftReports();

  // Đồng bộ danh sách năm trong dropdown nếu có năm mới phát sinh
  const yearSelect = document.getElementById("shift-filter-year");
  if (yearSelect) {
    const existingYears = new Set(["2026", "2025", "2024"]);
    reports.forEach(r => {
      const { year } = extractShiftReportDateParts(r);
      if (year) existingYears.add(year);
    });
    const currentSelectedYear = yearSelect.value || "2026";
    const sortedYears = Array.from(existingYears).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}" ${y === currentSelectedYear ? "selected" : ""}>Năm ${y}</option>`).join("");
  }

  if (currentShiftFilterMode === "day") {
    const dayVal = document.getElementById("shift-filter-date")?.value || "";
    if (!dayVal) {
      return { filtered: reports, filterLabel: "Tất cả các ngày", fileSuffix: "Tat_Ca" };
    }
    const [yyyy, mm, dd] = dayVal.split("-");
    const vnDate = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : dayVal;
    const filtered = reports.filter(r => extractShiftReportDateParts(r).isoDate === dayVal);
    return {
      filtered,
      filterLabel: `ngày ${vnDate}`,
      fileSuffix: `Ngay_${dayVal}`
    };
  }

  if (currentShiftFilterMode === "month") {
    const monthVal = document.getElementById("shift-filter-month")?.value || "";
    if (!monthVal) {
      return { filtered: reports, filterLabel: "Tất cả các tháng", fileSuffix: "Tat_Ca" };
    }
    const [yyyy, mm] = monthVal.split("-");
    const vnMonth = mm && yyyy ? `tháng ${mm}/${yyyy}` : monthVal;
    const filtered = reports.filter(r => extractShiftReportDateParts(r).yearMonth === monthVal);
    return {
      filtered,
      filterLabel: vnMonth,
      fileSuffix: `Thang_${monthVal}`
    };
  }

  if (currentShiftFilterMode === "year") {
    const yearVal = document.getElementById("shift-filter-year")?.value || "2026";
    const filtered = reports.filter(r => extractShiftReportDateParts(r).year === yearVal);
    return {
      filtered,
      filterLabel: `năm ${yearVal}`,
      fileSuffix: `Nam_${yearVal}`
    };
  }

  return {
    filtered: reports,
    filterLabel: "Tất cả thời gian",
    fileSuffix: "Tat_Ca"
  };
}

function exportFilteredShiftReportsToExcel() {
  const { filtered, filterLabel, fileSuffix } = getFilteredShiftReports();

  if (!filtered || filtered.length === 0) {
    showToast(`Không có báo cáo kết ca nào trong phạm vi lọc (${filterLabel}) để xuất file Excel!`, "warning");
    return;
  }

  const columns = [
    { header: "STT", key: "stt", alignCenter: true, isText: true },
    { header: "Mã Báo Cáo", key: "id", alignCenter: true, isText: true },
    { header: "Ngày Báo Cáo", key: "date", alignCenter: true, isText: true },
    { header: "Giờ Nộp Báo Cáo", key: "timeSubmitted", alignCenter: true, isText: true },
    { header: "Ca Làm Việc", key: "shiftName", align: "left" },
    { header: "Mã Nhân Viên", key: "cashierId", alignCenter: true, isText: true },
    { header: "Thu Ngân Bàn Giao", key: "cashierName", align: "left" },
    { header: "Tổng Số Đơn Hàng", key: "totalOrders", isNumber: true },
    { header: "Tổng Doanh Thu (VND)", key: "totalRevenue", isNumber: true },
    { header: "Doanh Thu Tiền Mặt Bill (VND)", key: "systemCash", isNumber: true },
    { header: "Doanh Thu Chuyển Khoản QR (VND)", key: "systemTransfer", isNumber: true },
    { header: "Tiền Lẻ Đầu Ca (VND)", key: "initialDrawerCash", isNumber: true },
    { header: "Tiền Két Lý Thuyết (VND)", key: "expectedDrawerCash", isNumber: true },
    { header: "Tiền Két Thực Tế Đếm Được (VND)", key: "actualDrawerCash", isNumber: true },
    { header: "Chênh Lệch Két (VND)", key: "cashDifference", isNumber: true },
    { header: "Tình Trạng Kiểm Két", key: "differenceStatus", alignCenter: true },
    { header: "SL Hàng Đã Bán", key: "totalSoldItems", isNumber: true },
    { header: "Tồn Kho Cuối Ca", key: "totalStockRemaining", isNumber: true },
    { header: "Trạng Thái Xác Nhận", key: "status", alignCenter: true },
    { header: "Ghi Chú Bàn Giao", key: "note", align: "left" }
  ];

  const rows = filtered.map((r, index) => ({
    stt: index + 1,
    id: r.id || "",
    date: r.date || r.dateISO || "",
    timeSubmitted: r.timeSubmitted || r.date || "",
    shiftName: r.shiftName || "",
    cashierId: r.cashierId || "",
    cashierName: r.cashierName || "",
    totalOrders: Number(r.totalOrders || 0),
    totalRevenue: Number(r.totalRevenue || 0),
    systemCash: Number(r.systemCash || 0),
    systemTransfer: Number(r.systemTransfer || 0),
    initialDrawerCash: Number(r.initialDrawerCash || 0),
    expectedDrawerCash: Number(r.expectedDrawerCash || 0),
    actualDrawerCash: Number(r.actualDrawerCash || 0),
    cashDifference: Number(r.cashDifference || 0),
    differenceStatus: r.differenceStatus || ((r.cashDifference || 0) === 0 ? "Khớp két 100%" : "Có chênh lệch"),
    totalSoldItems: Number(r.inventorySummary?.totalSoldItems || 0),
    totalStockRemaining: Number(r.inventorySummary?.totalStockRemaining || 0),
    status: r.status || "",
    note: r.note || ""
  }));

  const sumOrders = filtered.reduce((s, r) => s + Number(r.totalOrders || 0), 0);
  const sumRev = filtered.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
  const sumCash = filtered.reduce((s, r) => s + Number(r.systemCash || 0), 0);
  const sumTransfer = filtered.reduce((s, r) => s + Number(r.systemTransfer || 0), 0);
  const sumActualDrawer = filtered.reduce((s, r) => s + Number(r.actualDrawerCash || 0), 0);
  const sumDiff = filtered.reduce((s, r) => s + Number(r.cashDifference || 0), 0);
  const sumSold = filtered.reduce((s, r) => s + Number(r.inventorySummary?.totalSoldItems || 0), 0);

  const summaryRow = {
    stt: "",
    id: `TỔNG CỘNG (${filtered.length} CA)`,
    date: filterLabel.toUpperCase(),
    timeSubmitted: "",
    shiftName: "",
    cashierId: "",
    cashierName: "",
    totalOrders: sumOrders,
    totalRevenue: sumRev,
    systemCash: sumCash,
    systemTransfer: sumTransfer,
    initialDrawerCash: "",
    expectedDrawerCash: "",
    actualDrawerCash: sumActualDrawer,
    cashDifference: sumDiff,
    differenceStatus: sumDiff === 0 ? "Khớp két 100%" : `Chênh lệch: ${sumDiff.toLocaleString('vi-VN')} VND`,
    totalSoldItems: sumSold,
    totalStockRemaining: "",
    status: "",
    note: ""
  };

  const fileName = `Bao_Cao_Ket_Ca_Emart_${fileSuffix}.xls`;

  exportStyledExcelTable({
    filename: fileName,
    sheetName: "BaoCaoKetCa",
    columns,
    rows,
    summaryRow
  });

  showToast(`📊 ĐÃ XUẤT FILE EXCEL BÁO CÁO KẾT CA THÀNH CÔNG!\n• Tên file: ${fileName}\n• Phạm vi lọc: ${filterLabel}\n• Số lượng: ${filtered.length} báo cáo kết ca\n• Định dạng: Cột ngang 1 màu da trời nhạt, cỡ 14 in đậm, nội dung cỡ 12 kiểu Arial.`, "success");
}

function checkPendingShiftReportsNotification() {
  const reports = getShiftReports();
  const pending = reports.filter(r => r.status === "Chờ chủ xác nhận");
  const headerBadge = document.getElementById("header-shift-alert-badge");
  const headerText = document.getElementById("header-shift-alert-text");
  const sidebarBadge = document.getElementById("sidebar-shift-badge");

  if (sidebarBadge) {
    if (reports.length > 0) {
      sidebarBadge.classList.remove("hidden");
      sidebarBadge.innerText = reports.length;
    } else {
      sidebarBadge.classList.add("hidden");
    }
  }

  if (pending.length > 0) {
    if (headerBadge) {
      headerBadge.classList.remove("hidden");
      if (headerText) headerText.innerText = `${pending.length} Báo cáo kết ca mới chờ duyệt!`;
    }
  } else {
    if (headerBadge) headerBadge.classList.add("hidden");
  }
}

function renderShiftReportsSection() {
  const { filtered, filterLabel } = getFilteredShiftReports();

  // Thống kê metrics cho phạm vi đang lọc
  let totalRev = 0;
  let totalOrders = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let allMatched = true;

  filtered.forEach(r => {
    totalRev += (r.totalRevenue || 0);
    totalOrders += (r.totalOrders || 0);
    totalCash += (r.actualDrawerCash || r.systemCash || 0);
    totalTransfer += (r.systemTransfer || 0);
    if ((r.cashDifference || 0) !== 0) {
      allMatched = false;
    }
  });

  document.getElementById("shift-summary-total-revenue").innerText = formatVND(totalRev);
  document.getElementById("shift-summary-orders").innerText = `${totalOrders} đơn bán • ${filtered.length} ca kết (${filterLabel})`;
  document.getElementById("shift-summary-cash").innerText = formatVND(totalCash);
  document.getElementById("shift-summary-transfer").innerText = formatVND(totalTransfer);

  const statusEl = document.getElementById("shift-summary-status");
  if (statusEl) {
    if (filtered.length === 0) {
      statusEl.className = "text-sm font-bold text-slate-400 mt-1";
      statusEl.innerText = "Chưa có báo cáo";
    } else if (allMatched) {
      statusEl.className = "text-base font-black text-emerald-700 mt-1";
      statusEl.innerText = "Khớp két 100%";
    } else {
      statusEl.className = "text-base font-black text-amber-600 mt-1";
      statusEl.innerText = "Có ca chênh lệch két";
    }
  }

  // Render bảng danh sách các báo cáo
  const tbody = document.getElementById("shift-reports-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <span>Không có báo cáo kết ca nào trong ${filterLabel}.</span>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const isPending = r.status === "Chờ chủ xác nhận";
    const isDiffZero = (r.cashDifference || 0) === 0;
    const diffText = isDiffZero ? "Khớp 100%" : (r.cashDifference > 0 ? `+${formatVND(r.cashDifference)}` : `${formatVND(r.cashDifference)}`);
    const diffBadge = isDiffZero 
      ? '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Khớp két 100%</span>'
      : (r.cashDifference > 0 
        ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Thừa: ${diffText}</span>`
        : `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">Thiếu: ${diffText}</span>`);

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="p-3">
          <span class="font-mono font-bold text-slate-900 block">${r.id}</span>
          <span class="text-[10px] text-slate-400 font-medium">${r.timeSubmitted || r.date}</span>
        </td>
        <td class="p-3 font-semibold text-slate-800">
          <span>${r.shiftName || 'Ca Sáng'}</span>
        </td>
        <td class="p-3">
          <div class="font-black text-slate-900">${r.cashierName || 'Trần Thị Mai'}</div>
          <span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-bold">${r.cashierId || 'st-02'}</span>
        </td>
        <td class="p-3 font-mono font-bold text-[#005A2B]">
          ${formatVND(r.systemCash || 0)}
        </td>
        <td class="p-3 font-mono font-bold text-blue-700">
          ${formatVND(r.systemTransfer || 0)}
        </td>
        <td class="p-3 font-mono font-black text-slate-900">
          ${formatVND(r.actualDrawerCash || 0)}
        </td>
        <td class="p-3">
          ${diffBadge}
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button 
              onclick="openShiftDetailModal('${r.id}')" 
              class="px-2.5 py-1.5 rounded-xl ${isPending ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black animate-pulse' : 'bg-[#005A2B] hover:bg-[#0B6A36] text-white font-bold'} text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <i data-lucide="${isPending ? 'check-circle' : 'eye'}" class="w-3.5 h-3.5"></i>
              <span>${isPending ? 'Xem & Xác Nhận' : 'Xem Chi Tiết'}</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openShiftDetailModal(reportId) {
  const reports = getShiftReports();
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  currentShiftReportToConfirm = report;

  document.getElementById("shift-detail-id").innerText = report.id;
  document.getElementById("shift-detail-time").innerText = report.timeSubmitted || report.date;
  document.getElementById("shift-detail-shift").innerText = report.shiftName || "Ca Sáng (06:00 - 14:00)";
  document.getElementById("shift-detail-cashier").innerText = `${report.cashierName || 'Trần Thị Mai'} (Mã NV: ${report.cashierId || 'st-02'})`;

  document.getElementById("shift-detail-initial").innerText = formatVND(report.initialDrawerCash || 1000000);
  document.getElementById("shift-detail-cash-rev").innerText = formatVND(report.systemCash || 0);
  document.getElementById("shift-detail-expected").innerText = formatVND(report.expectedDrawerCash || 0);
  document.getElementById("shift-detail-actual").innerText = formatVND(report.actualDrawerCash || 0);

  const diffBadge = document.getElementById("shift-detail-diff-badge");
  if (diffBadge) {
    const isDiffZero = (report.cashDifference || 0) === 0;
    if (isDiffZero) {
      diffBadge.className = "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300";
      diffBadge.innerText = "Khớp két 100% (0 ₫)";
    } else if (report.cashDifference > 0) {
      diffBadge.className = "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-900 border border-amber-300";
      diffBadge.innerText = `Thừa tiền: +${formatVND(report.cashDifference)}`;
    } else {
      diffBadge.className = "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-red-100 text-red-800 border border-red-300";
      diffBadge.innerText = `Thiếu tiền: ${formatVND(report.cashDifference)}`;
    }
  }

  document.getElementById("shift-detail-transfer-rev").innerText = formatVND(report.systemTransfer || 0);

  // Inventory summary
  const inv = report.inventorySummary || {};
  document.getElementById("shift-detail-sold-qty").innerText = (inv.totalSoldItems || 0) + " sản phẩm";
  document.getElementById("shift-detail-remaining-stock").innerText = (inv.totalStockRemaining || 0) + " sản phẩm";

  const itemsListEl = document.getElementById("shift-detail-items-list");
  if (itemsListEl) {
    const items = inv.soldItemsDetails || inv.topSellingItems || [];
    if (items.length > 0) {
      itemsListEl.innerHTML = items.map(it => `
        <div class="flex justify-between items-center py-1 px-1 border-b border-slate-100 last:border-0">
          <span class="text-slate-800 font-medium truncate">${it.name}</span>
          <span class="font-bold text-[#005A2B] shrink-0 ml-2">${it.qty} cái</span>
        </div>
      `).join('');
    } else {
      itemsListEl.innerHTML = `<span class="text-slate-400 italic">Không có mặt hàng nào bán trong ca.</span>`;
    }
  }

  document.getElementById("shift-detail-note").innerText = report.note || "Bàn giao ca đầy đủ, không phát sinh sự cố.";

  // Status banner & Confirm button
  const statusBox = document.getElementById("shift-detail-status-box");
  const confirmContainer = document.getElementById("shift-detail-confirm-container");
  const isPending = report.status === "Chờ chủ xác nhận";

  if (isPending) {
    if (statusBox) {
      statusBox.className = "p-2.5 rounded-xl text-center text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200";
      statusBox.innerHTML = `<i data-lucide="clock" class="w-4 h-4 inline mr-1 text-amber-600"></i> Báo cáo mới nhận từ Thu ngân • Chờ Chủ shop xác nhận đối chiếu`;
    }
    if (confirmContainer) confirmContainer.classList.remove("hidden");
  } else {
    if (statusBox) {
      statusBox.className = "p-2.5 rounded-xl text-center text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200";
      statusBox.innerHTML = `<i data-lucide="check-check" class="w-4 h-4 inline mr-1 text-emerald-600"></i> Đã được Chủ cửa hàng xác nhận & Lưu trữ vào sổ nhật ký ngày`;
    }
    if (confirmContainer) confirmContainer.classList.add("hidden");
  }

  const modal = document.getElementById("shift-detail-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeShiftDetailModal() {
  const modal = document.getElementById("shift-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentShiftReportToConfirm = null;
}

function confirmShiftReportOwner() {
  if (!currentShiftReportToConfirm) return;
  const reports = getShiftReports();
  const r = reports.find(item => item.id === currentShiftReportToConfirm.id);
  if (!r) return;

  r.status = "Chủ shop đã duyệt & lưu";
  saveShiftReports(reports);

  renderShiftReportsSection();
  checkPendingShiftReportsNotification();

  // Update modal state
  openShiftDetailModal(r.id);

  showToast(`✅ ĐÃ XÁC NHẬN & LƯU BÁO CÁO KẾT CA THÀNH CÔNG!\n\n• Mã báo cáo: ${r.id}\n• Thu ngân: ${r.cashierName}\n• Sổ nhật ký ngày ${r.date} đã được cập nhật chuẩn xác.`, "success");
}

