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
  activeTab = tabId;

  // Update sidebar buttons
  document.querySelectorAll(".sidebar-tab-btn").forEach(btn => {
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
  checkPendingReportsNotification();
  checkPendingShiftReportsNotification();

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

// ==========================================
// 2. RENDER PRODUCTS TABLE
// ==========================================
function renderProductsTable() {
  const products = getProducts();
  const search = document.getElementById("product-search-input")?.value.trim().toLowerCase() || "";
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  const filtered = products.filter(p => p.name.toLowerCase().includes(search) || p.barcode.includes(search));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p class="font-bold">Không tìm thấy sản phẩm nào</p>
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

    let stockStatusBadge = '';
    if (isOutStock) {
      stockStatusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white">Hết hàng (0)</span>`;
    } else if (isLowStock) {
      stockStatusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Sắp hết (${p.stock} / Ngưỡng: ${minAlert})</span>`;
    } else {
      stockStatusBadge = `<span class="font-bold text-slate-800">${p.stock} <span class="text-[10px] text-slate-400">cái (Ngưỡng: ${minAlert})</span></span>`;
    }

    let expiryBadge = '';
    if (days <= 1) {
      expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">Hạn ${days}d</span>`;
    } else if (days <= 7) {
      expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Còn ${days}d</span>`;
    } else {
      expiryBadge = `<span class="text-slate-500 font-mono text-xs">${days} ngày</span>`;
    }

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-500">#${p.barcode}</td>
        <td class="p-3">
          <div class="flex items-center gap-2.5">
            <img src="${p.image}" class="w-9 h-9 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0">
            <div>
              <span class="font-bold text-slate-900 block">${p.name}</span>
              ${p.price < p.originalPrice ? `<span class="text-[10px] text-red-600 font-bold">Đang xả hàng giảm giá</span>` : ''}
            </div>
          </div>
        </td>
        <td class="p-3 text-slate-600">${p.category}</td>
        <td class="p-3 font-black text-[#005A2B] text-sm">
          ${formatVND(p.price)}
          ${p.price < p.originalPrice ? `<span class="block text-[10px] text-slate-400 line-through font-normal">${formatVND(p.originalPrice)}</span>` : ''}
        </td>
        <td class="p-3">
          ${stockStatusBadge}
        </td>
        <td class="p-3">
          <div class="font-mono text-slate-700">${p.expiryDate}</div>
          ${expiryBadge}
        </td>
        <td class="p-3 text-center">
          <!-- Button ba gạch / ba chấm sổ xuống thao tác Sửa / Xóa -->
          <div class="relative inline-block text-left dropdown-container">
            <button 
              type="button" 
              onclick="toggleActionDropdown(event, '${p.id}')" 
              class="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer border border-transparent hover:border-slate-200"
              title="Thao tác"
            >
              <i data-lucide="more-vertical" class="w-4 h-4"></i>
            </button>
            <div id="dropdown-${p.id}" class="action-dropdown hidden absolute right-0 mt-1 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fade-in text-left">
              <button 
                type="button" 
                onclick="editProduct('${p.id}'); hideAllDropdowns();" 
                class="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#005A2B] flex items-center gap-2 cursor-pointer"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-[#005A2B]"></i>
                <span>Sửa thông tin</span>
              </button>
              <button 
                type="button" 
                onclick="deleteProduct('${p.id}'); hideAllDropdowns();" 
                class="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
                <span>Xóa sản phẩm</span>
              </button>
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
    checkLowStockPushNotification();
  }
}

// ==========================================
// 3. RENDER FEFO ALERTS (Nâng Cấp UI/UX, Set % Tùy Ý, Trả Hàng NCC)
// ==========================================
function setFefoFilter(filterType) {
  currentFefoFilter = filterType;
  document.querySelectorAll(".fefo-filter-btn").forEach(btn => {
    btn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100";
  });
  const activeBtn = document.getElementById("fefo-filter-" + filterType);
  if (activeBtn) {
    activeBtn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#005A2B] text-white shadow-xs";
  }
  renderFefoAlerts();
}

function renderFefoAlerts() {
  const products = getProducts();
  const container = document.getElementById("fefo-cards-container");
  const search = document.getElementById("fefo-search-input")?.value.trim().toLowerCase() || "";
  if (!container) return;

  let sorted = [...products].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // Filter by category urgency
  if (currentFefoFilter === "urgent") {
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

    const discountRate = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;

    return `
      <div class="bg-white rounded-3xl border ${cardBorder} p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-xs transition hover:shadow-md">
        
        <!-- Left Product & Batch Info -->
        <div class="flex items-start gap-3.5 min-w-0 flex-1">
          <img src="${p.image}" class="w-16 h-16 rounded-2xl object-cover bg-slate-100 border border-slate-200 shrink-0">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              ${riskBadge}
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
              <span>Tồn kho lô: <strong class="${p.stock <= (p.minStockAlert || 5) ? 'text-red-600' : 'text-slate-800'}">${p.stock}</strong> cái</span>
              <span>•</span>
              <span>Giá niêm yết: <strong class="text-slate-700">${formatVND(p.originalPrice)}</strong></span>
            </div>
          </div>
        </div>

        <!-- Right: Custom % Discount & Return to Supplier Actions -->
        <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2.5 shrink-0 w-full lg:w-auto">
          
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-700">Thiết lập % xả hàng:</span>
            ${discountRate > 0 ? `
              <span class="px-2 py-0.5 rounded-lg bg-red-600 text-white font-black text-[10px] animate-pulse">
                Đang xả -${discountRate}% (${formatVND(p.price)})
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
              <button onclick="setFefoInputRate('${p.id}', 20)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700">20%</button>
              <button onclick="setFefoInputRate('${p.id}', 35)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700">35%</button>
              <button onclick="setFefoInputRate('${p.id}', 50)" class="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700">50%</button>
            </div>

            <button 
              onclick="applyCustomFefoDiscount('${p.id}')" 
              class="px-3 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-xs shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              <i data-lucide="tag" class="w-3.5 h-3.5"></i>
              <span>Áp Dụng</span>
            </button>
          </div>

          <!-- Bottom Action Buttons: Restore Price & Return to Supplier -->
          <div class="flex items-center gap-2 pt-1 border-t border-slate-200">
            <button 
              onclick="restoreFefoPrice('${p.id}')" 
              class="flex-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] transition text-center"
            >
              Khôi phục giá
            </button>

            <!-- Bấm trả hàng của lô hàng đó cho nhà cung cấp -->
            <button 
              onclick="openReturnBatchModal('${p.id}')" 
              class="flex-1 py-1.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <i data-lucide="undo-2" class="w-3 h-3 text-red-600"></i>
              <span>Trả Hàng NCC</span>
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
  showToast(`Đã áp dụng xả hàng giảm ${percent}% cho "${p.name}". Giá mới tại quầy POS: ${formatVND(p.price)}`, "success");
}

function restoreFefoPrice(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) return;

  p.price = p.originalPrice;
  saveProducts(products);
  renderFefoAlerts();
  showToast(`Đã khôi phục giá niêm yết cho "${p.name}": ${formatVND(p.originalPrice)}`, "info");
}

// Modal Trả hàng cho Nhà Cung Cấp
function openReturnBatchModal(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) return;

  document.getElementById("return-modal-prod-id").value = p.id;
  document.getElementById("return-modal-product-name").innerText = p.name;
  document.getElementById("return-modal-batch-code").innerText = p.batchCode || 'LOT-2026';
  document.getElementById("return-modal-current-stock").innerText = p.stock + " sản phẩm";
  document.getElementById("return-modal-quantity").value = p.stock;
  document.getElementById("return-modal-quantity").max = p.stock;

  const modal = document.getElementById("return-batch-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
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
    showToast("Số lượng xuất trả không hợp lệ!", "warning");
    return;
  }

  p.stock -= returnQty;
  saveProducts(products);
  closeReturnBatchModal();
  renderFefoAlerts();
  renderProductsTable();
  checkLowStockPushNotification();

  showToast(`Đã hoàn tất xuất trả ${returnQty} sản phẩm của lô "${p.batchCode}" về Nhà Cung Cấp!\nLý do: ${reason}`, "success");
}

// ==========================================
// 4. RENDER INVOICES TABLE & XEM CHI TIẾT
// ==========================================
function renderInvoicesTable() {
  const invoices = getInvoices();
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;

  tbody.innerHTML = invoices.map(inv => `
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
      <td class="p-3 font-mono text-slate-500">${inv.customerPhone || "Khách vãng lai"}</td>
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
// 5. RENDER STAFF TABLE (Thêm nhân viên & đổi trạng thái; Chủ cửa hàng cố định)
// ==========================================
function renderStaffTable() {
  const staff = getStaffList();
  const tbody = document.getElementById("staff-table-body");
  if (!tbody) return;

  tbody.innerHTML = staff.map(s => {
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
        <td class="p-3">
          ${isOwner ? `
            <span class="px-2.5 py-1 rounded-full font-black text-[10px] bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1" title="Chủ cửa hàng không thể bị khóa">
              <i data-lucide="shield-check" class="w-3 h-3 text-amber-600"></i>
              ● Cố định (Chủ shop)
            </span>
          ` : `
            <button 
              onclick="toggleStaffStatus('${s.id}')" 
              class="px-2.5 py-1 rounded-full font-bold text-[10px] transition cursor-pointer flex items-center gap-1 ${
                s.status === 'Đang làm việc' ? 'bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-700' : 'bg-red-100 text-red-800 hover:bg-emerald-50 hover:text-emerald-700'
              }"
              title="Bấm để chuyển trạng thái làm việc"
            >
              <span>● ${s.status}</span>
              <i data-lucide="refresh-cw" class="w-2.5 h-2.5 opacity-60"></i>
            </button>
          `}
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <button 
              onclick="editStaff('${s.id}')" 
              class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Chỉnh sửa thông tin"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            ${!isOwner ? `
              <button 
                onclick="deleteStaff('${s.id}')" 
                class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
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
  document.getElementById("staff-shift").value = "Ca Sáng (06:00 - 14:00)";

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

  const staffList = getStaffList();

  if (id) {
    const s = staffList.find(item => item.id === id);
    if (s) {
      s.name = name;
      s.email = email;
      s.password = password;
      s.phone = phone;
      // Protect owner role if modifying owner
      if (s.role !== "Chủ cửa hàng") {
        s.role = role;
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
      status: "Đang làm việc"
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

  document.getElementById("modal-staff-title").innerText = "Chỉnh Sửa Thông Tin Nhân Viên";
  document.getElementById("modal-staff-id").value = s.id;
  document.getElementById("staff-name").value = s.name;
  document.getElementById("staff-email").value = s.email;
  document.getElementById("staff-password").value = s.password;
  document.getElementById("staff-phone").value = s.phone || "";
  document.getElementById("staff-role").value = s.role;
  document.getElementById("staff-shift").value = s.shift;

  // If editing store owner, disable role dropdown
  const roleSelect = document.getElementById("staff-role");
  if (s.role === "Chủ cửa hàng") {
    roleSelect.disabled = true;
  } else {
    roleSelect.disabled = false;
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

  // Yêu cầu: Chủ cửa hàng không bị thay đổi trạng thái
  if (s.role === "Chủ cửa hàng") {
    showToast("Tài khoản Chủ cửa hàng là tài khoản quản trị tối cao, không thể thay đổi trạng thái!", "warning");
    return;
  }

  s.status = s.status === "Đang làm việc" ? "Tạm khóa / Nghỉ việc" : "Đang làm việc";
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
// 6. RENDER CRM TABLE & XÉT DUYỆT NÂNG HẠNG (1 điểm = 1 đồng)
// ==========================================
let currentSelectedCustomer = null;

function renderCrmTable() {
  const customers = getCustomers();
  const invoices = getInvoices();
  const tbody = document.getElementById("crm-table-body");
  if (!tbody) return;

  tbody.innerHTML = customers.map(c => {
    // Calculate total spent from customer's invoices or initial records
    const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
    const calculatedSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalSpent = (c.totalSpent || 0) + calculatedSpent;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-900">${c.phone}</td>
        <td class="p-3 font-bold text-slate-800">${c.name}</td>
        <td class="p-3 font-black text-[#FFA500]">
          ${c.points.toLocaleString()} điểm 
          <span class="text-[10px] text-slate-400 font-normal block">(~${formatVND(c.points)})</span>
        </td>
        <td class="p-3 font-black text-[#005A2B]">${formatVND(totalSpent)}</td>
        <td class="p-3">
          <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
            c.tier === 'Kim Cương' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
            c.tier === 'Vàng' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
            c.tier === 'Bạc' ? 'bg-slate-100 text-slate-800 border border-slate-300' :
            'bg-orange-100 text-orange-900 border border-orange-200'
          }">
            Hạng ${c.tier}
          </span>
        </td>
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

function openCrmDetailModal(customerPhone) {
  const customers = getCustomers();
  const invoices = getInvoices();
  const c = customers.find(item => item.phone === customerPhone);
  if (!c) return;

  currentSelectedCustomer = c;

  const custInvoices = invoices.filter(inv => inv.customerPhone === c.phone);
  const calculatedSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalSpent = (c.totalSpent || 0) + calculatedSpent;
  const totalOrders = (c.orderCount || 2) + custInvoices.length;

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
          <p>Chưa có giao dịch quầy POS mới trong ca hiện tại (Đã tích lũy ${formatVND(c.totalSpent || 0)} từ trước).</p>
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
  const calculatedSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalSpent = (currentSelectedCustomer.totalSpent || 0) + calculatedSpent;

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
                <span>Đã phê duyệt (Được quyền Set giá & Trả hàng)</span>
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
                    <td class="p-3 text-center">
                      ${!isPending ? `
                        <div class="flex items-center justify-center gap-1.5">
                          <!-- Yêu cầu: Khi chủ duyệt thì sẽ được set giảm giá -->
                          <button 
                            onclick="quickSetDiscountFromReport('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-[11px] shadow-2xs transition flex items-center gap-1 cursor-pointer"
                            title="Chủ cửa hàng tự set % giảm giá xả hàng"
                          >
                            <i data-lucide="tag" class="w-3 h-3"></i>
                            <span>Set Giảm Giá</span>
                          </button>
                          
                          <!-- Yêu cầu: Khi chủ duyệt thì sẽ được set trả hàng -->
                          <button 
                            onclick="openReturnBatchModal('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title="Xuất trả lô hàng cho Nhà cung cấp"
                          >
                            <i data-lucide="undo-2" class="w-3 h-3 text-red-600"></i>
                            <span>Set Trả Hàng</span>
                          </button>
                        </div>
                      ` : `
                        <span class="text-[11px] text-slate-400 italic">Vui lòng bấm duyệt báo cáo trước</span>
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
  showToast(`Đã duyệt báo cáo ${reportId} thành công!\nHiện tại bạn có thể bấm trực tiếp các nút "Set Giảm Giá" và "Set Trả Hàng" cho từng món trong báo cáo.`, "success");
}

function quickSetDiscountFromReport(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    alert("Không tìm thấy sản phẩm này trong kho!");
    return;
  }

  const currentPercent = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 30;
  const input = prompt(`Thiết lập phần trăm giảm giá xả hàng cho "${p.name}":\n(Nhập số từ 1 đến 99, ví dụ 35 là giảm 35%)`, currentPercent);

  if (input !== null) {
    const percent = Number(input.trim());
    if (isNaN(percent) || percent <= 0 || percent >= 100) {
      alert("Phần trăm giảm giá không hợp lệ! Vui lòng nhập số từ 1 đến 99.");
      return;
    }

    p.price = Math.round(p.originalPrice * (1 - percent / 100));
    saveProducts(products);
    renderReportsSection();
    renderFefoAlerts();
    renderProductsTable();
    alert(`Đã áp dụng giảm giá ${percent}% cho "${p.name}". Giá mới tại quầy POS: ${formatVND(p.price)}`);
  }
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
// 9. BÁO CÁO KẾT CA, KIỂM KÉT & TỒN KHO THEO NGÀY (CHỦ CỬA HÀNG NHẬN & LƯU)
// ==========================================
let currentShiftReportToConfirm = null;

function checkPendingShiftReportsNotification() {
  const reports = getShiftReports();
  const pending = reports.filter(r => r.status === "Chờ chủ xác nhận");
  const headerBadge = document.getElementById("header-shift-alert-badge");
  const headerText = document.getElementById("header-shift-alert-text");
  const sidebarBadge = document.getElementById("sidebar-shift-badge");

  if (pending.length > 0) {
    if (headerBadge) {
      headerBadge.classList.remove("hidden");
      if (headerText) headerText.innerText = `${pending.length} Báo cáo kết ca mới!`;
    }
    if (sidebarBadge) {
      sidebarBadge.classList.remove("hidden");
      sidebarBadge.innerText = pending.length;
    }
  } else {
    if (headerBadge) headerBadge.classList.add("hidden");
    if (sidebarBadge) sidebarBadge.classList.add("hidden");
  }
}

function clearShiftDateFilter() {
  const filterInput = document.getElementById("shift-filter-date");
  if (filterInput) filterInput.value = "";
  renderShiftReportsSection();
}

function renderShiftReportsSection() {
  const reports = getShiftReports();
  const filterInput = document.getElementById("shift-filter-date");
  const filterVal = filterInput ? filterInput.value : "";

  // Lọc theo ngày nếu có chọn
  let filtered = reports;
  if (filterVal) {
    // filterVal có dạng YYYY-MM-DD
    const parts = filterVal.split("-");
    const vnDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "";
    filtered = reports.filter(r => (r.dateISO === filterVal || r.date === vnDate || (r.timeSubmitted && r.timeSubmitted.includes(vnDate))));
  }

  // Thống kê metrics cho ngày đang lọc
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
  document.getElementById("shift-summary-orders").innerText = `${totalOrders} đơn bán • ${filtered.length} ca kết`;
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
          <span>Không có báo cáo kết ca nào trong ngày ${filterVal || 'được chọn'}.</span>
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

