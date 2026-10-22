# Emart - Hệ Thống Quản Lý Cửa Hàng Tiện Lợi & Quầy Bán Hàng POS (HTML/CSS/JS Thuần)

Dự án đã được chuyển đổi hoàn toàn sang **HTML5 + CSS3 + Vanilla JavaScript thuần**, tối ưu tuyệt đối cho **Visual Studio Code** và sẵn sàng 100% để nộp bài hoặc chạy trực tiếp.

Toàn bộ các file `.tsx` không cần thiết đã được loại bỏ. Giờ đây bạn có thể mở dự án và chạy ngay lập tức mà không gặp bất kỳ lỗi trình duyệt nào!

---

## 🚀 Hướng Dẫn Chạy Dự Án Trên Visual Studio Code

### 👉 Cách 1: Chạy bằng tiện ích "Live Server" (Nhanh nhất & Khuyên dùng)
1. Khởi động **Visual Studio Code**.
2. Chọn menu **File** > **Open Folder...** -> Chọn thư mục đồ án này.
3. Trong danh sách file bên trái, click chuột phải vào **`index.html`** (hoặc `pos.html`, `dashboard.html`).
4. Chọn **"Open with Live Server"** (hoặc nhấn phím tắt `Alt + L, Alt + O`).
5. Trình duyệt sẽ mở ngay lập tức và chạy mượt mà tất cả tính năng!

---

### 👉 Cách 2: Mở trực tiếp bằng trình duyệt (Không cần cài bất kỳ phần mềm nào)
- Mở thư mục đồ án trong **File Explorer** (Windows) hoặc **Finder** (Mac).
- Bấm đúp chuột vào file **`index.html`** hoặc **`pos.html`**.
- Trình duyệt Chrome / Cốc Cốc / Edge sẽ mở và sử dụng ngay lập tức!

---

### 👉 Cách 3: Chạy bằng Terminal (Tùy chọn)
Nếu bạn muốn chạy server:
```bash
npm run dev
```
Truy cập địa chỉ: **`http://localhost:3000`**

---

## 📁 Cấu Trúc File Dự Án Thuần HTML/CSS/JS

```text
├── index.html           # Trang chủ giới thiệu, xem nhanh danh mục và sản phẩm Emart
├── login.html           # Trang đăng nhập phân quyền (Quản lý & Thu ngân)
├── pos.html             # Quầy thu ngân bán hàng POS (F1-F8, quét barcode, tính tiền thừa, in bill)
├── dashboard.html       # Quản trị trung tâm: Doanh thu, Hạn dùng FEFO date, Nhân viên, CRM
├── css/
│   └── style.css        # Định dạng giao diện màu Emart, hiệu ứng và khổ in bill 80mm
├── js/
│   ├── data.js          # Dữ liệu sản phẩm mẫu, lưu trữ LocalStorage, tính ngày cận date FEFO
│   ├── auth.js          # Quản lý phiên đăng nhập và phân quyền người dùng
│   ├── pos.js           # Xử lý logic quầy POS: giỏ hàng, tiếng bíp quét mã vạch, thanh toán, in bill
│   └── dashboard.js     # Xử lý logic bảng quản trị, biểu đồ doanh thu Chart.js, thêm/sửa/xóa sản phẩm
├── .vscode/             # Cấu hình tự động cho Visual Studio Code (tasks, launch, settings)
├── README.md            # Tài liệu hướng dẫn sử dụng và nộp bài
├── package.json         # Cấu hình scripts
└── server.ts            # Máy chủ phục vụ static files
```

---

## 🔑 Tài Khoản Đăng Nhập Mẫu

Tại trang `login.html`, bạn có thể bấm nút chọn nhanh hoặc nhập:

| Vai Trò | Email / Tài khoản | Mật khẩu | Quyền Hạn |
| :--- | :--- | :--- | :--- |
| **Quản lý / Chủ cửa hàng** | `admin@emart.vn` | `123` | Toàn quyền: Báo cáo doanh thu, Thêm/Sửa/Xóa hàng hóa, Cảnh báo FEFO date, Quản lý nhân viên |
| **Thu ngân POS** | `cashier@emart.vn` | `123` | Bán hàng quầy POS, quét mã vạch barcode, tích điểm khách hàng CRM, in hóa đơn |

*(Tại màn hình đăng nhập, bạn cũng có thể bấm nút **"Mở trực tiếp Quầy POS không cần đăng nhập"** để vào thẳng quầy bán hàng).*

---

## 🌟 Các Tính Năng Đã Hoàn Thiện Bằng JavaScript Thuần

1. **Quầy POS Bán Hàng Tốc Độ Cao (`pos.html`)**:
   - Quét mã vạch barcode hoặc gõ tên sản phẩm tìm kiếm tức thời.
   - Phát âm thanh "bíp" mô phỏng máy quét quầy thu ngân thực tế (Web Audio API).
   - Tăng, giảm số lượng, tự động cảnh báo khi vượt quá số lượng tồn kho.
   - Tra cứu SĐT khách hàng thân thiết CRM để tích lũy điểm và giảm giá trừ tiền trực tiếp trên hóa đơn.
   - Modal thanh toán hỗ trợ Tiền mặt (với các nút bấm nhanh 20k, 50k, 100k, 200k, 500k), Chuyển khoản QR, Ví điện tử.
   - Tự động tính tiền thừa thối lại và **hỗ trợ in hóa đơn bán lẻ chuẩn khổ 80mm (`window.print()`)**.
   - Hỗ trợ phím tắt bàn phím tiện lợi: **F2** (Tìm kiếm), **F4** (Nhập SĐT khách), **F8** (Thanh toán), **Esc** (Đóng cửa sổ).

2. **Quản Lý Hạn Sử Dụng FEFO (`dashboard.html` -> Tab FEFO)**:
   - Tự động tính toán số ngày còn lại đến hạn sử dụng của từng lô hàng theo nguyên tắc *First Expired, First Out*.
   - Phân loại mức độ cảnh báo: *Nguy cấp (1 ngày)*, *Cận date (2-7 ngày)*, *An toàn*.
   - Nút bấm **"Xả hàng giảm 30%"** hoặc **"Xả hàng giảm 50%"** lập tức cập nhật giá bán mới vào giỏ hàng POS để giải phóng hàng cận hạn.

3. **Lưu Trữ Dữ Liệu Tự Động (`localStorage`)**:
   - Mọi thao tác thêm sản phẩm mới, sửa giá, số lượng tồn kho bị trừ sau khi bán ở quầy POS đều được tự động lưu vào `localStorage` của trình duyệt. Dù bạn tải lại trang (F5) hay tắt trình duyệt mở lại, dữ liệu vẫn được bảo lưu trọn vẹn.
