/**
 * Emart Authentication & Session Management
 */

function getCurrentUser() {
  return getStorage("emart_current_user", null);
}

function login(email, password, role) {
  if (!email || !password || !role) {
    return { success: false, message: "Vui lòng nhập đầy đủ tài khoản, mật khẩu và chọn vai trò!" };
  }
  const staff = getStaffList();
  const user = staff.find(s => s.email.toLowerCase() === email.trim().toLowerCase() && s.password === password.trim());
  if (!user) {
    return { success: false, message: "Tài khoản hoặc mật khẩu không chính xác! Vui lòng thử lại." };
  }
  if (user.role !== role) {
    return { success: false, message: `Tài khoản này không khớp với vai trò "${role}" đã chọn!` };
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    shift: user.shift
  };
  setStorage("emart_current_user", sessionUser);
  return { success: true, user: sessionUser };
}

function logout() {
  localStorage.removeItem("emart_current_user");
  window.location.href = "login.html";
}

function requireAuth(redirectUrl = "login.html") {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

function requireRole(allowedRole, redirectUrl = "pos.html") {
  const user = requireAuth("login.html");
  if (!user) return null;
  if (user.role !== allowedRole) {
    window.location.replace(redirectUrl);
    return null;
  }
  return user;
}

function updateHeaderUserUI() {
  const user = getCurrentUser();
  const userContainer = document.getElementById("header-user-section");
  const adminNav = document.getElementById("header-nav-admin");
  const adminLinks = document.querySelectorAll("a[href='dashboard.html']");

  // Nhân viên không cần chức năng quản trị: Ẩn hoàn toàn nút và link quản trị nếu là nhân viên
  if (adminNav) {
    if (user && user.role === "Chủ cửa hàng") {
      adminNav.classList.remove("hidden");
    } else {
      adminNav.classList.add("hidden");
    }
  }

  adminLinks.forEach(link => {
    if (link.id !== "header-nav-admin") {
      if (user && user.role === "Nhân viên thu ngân") {
        link.classList.add("hidden");
      } else if (user && user.role === "Chủ cửa hàng") {
        link.classList.remove("hidden");
      }
    }
  });

  if (!userContainer) return;

  if (user) {
    const isOwner = user.role === "Chủ cửa hàng";
    
    // Giao diện thẻ nhân viên thu ngân / chủ cửa hàng được thiết kế lại:
    // Cực kỳ rõ ràng, độ tương phản cao, phông chữ đậm nét, sang trọng và chuẩn mực quầy POS
    userContainer.innerHTML = `
      <div class="flex items-center gap-2.5 sm:gap-3 bg-white text-slate-900 px-3 py-1.5 sm:py-2 rounded-2xl shadow-sm border border-slate-200/90 transition select-none hover:shadow-md">
        <!-- Avatar với trạng thái ca làm việc -->
        <div class="relative shrink-0">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${isOwner ? 'bg-gradient-to-br from-[#FFA500] to-[#E68A00] text-slate-950' : 'bg-gradient-to-br from-[#005A2B] to-[#0B6A36] text-[#FFD700]'} font-black flex items-center justify-center text-xs sm:text-sm shadow-xs border border-white">
            ${isOwner ? '👑' : 'TM'}
          </div>
          <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" title="Đang trong ca trực"></span>
        </div>

        <!-- Chi tiết Họ Tên & Chức Danh Nhân Viên: Nổi bật, sắc nét, dễ nhìn -->
        <div class="leading-tight min-w-0 pr-1 text-left">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate max-w-[140px] sm:max-w-[180px]">${user.name}</span>
            <span class="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">${user.id || 'NV'}</span>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
            <span class="inline-flex items-center gap-1 font-bold ${isOwner ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-[#005A2B] bg-emerald-50 border-emerald-200'} text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md border">
              <i data-lucide="${isOwner ? 'shield-check' : 'user-check'}" class="w-3 h-3 ${isOwner ? 'text-[#FFA500]' : 'text-[#005A2B]'}"></i>
              <span>${user.role}</span>
            </span>
            <span class="text-slate-300 hidden md:inline">•</span>
            <span class="text-slate-500 text-[10px] sm:text-[11px] font-medium hidden md:inline truncate">${user.shift || 'Ca Sáng (06:00 - 14:00)'}</span>
          </div>
        </div>

        <!-- Nút Đăng Xuất -->
        <button onclick="logout()" title="Đăng xuất khỏi quầy" class="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer border border-transparent hover:border-red-100 ml-0.5 shrink-0">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  } else {
    userContainer.innerHTML = `
      <a href="login.html" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#005A2B] text-xs font-bold transition shadow-xs border border-emerald-200">
        <i data-lucide="log-in" class="w-3.5 h-3.5 text-[#005A2B]"></i>
        <span>Đăng nhập</span>
      </a>
    `;
  }
  if (window.lucide) {
    lucide.createIcons();
  }
}
