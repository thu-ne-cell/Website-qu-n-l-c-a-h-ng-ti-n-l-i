
console.log("=== Bắt đầu chạy app.js ===");

const express = require("express");
const path = require("path");

const { connectDB } = require("./database/connection");
const categoryRoutes = require("./routes/categories");
const productRoutes = require("./routes/products");
const supplierRoutes = require("./routes/suppliers");
const salesRoutes = require("./routes/sales");
const invoicesRoutes = require("./routes/invoices");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/invoices", invoicesRoutes);

(async () => {
    try {
        console.log("Đang kết nối SQL Server...");
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server đang chạy tại http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Không thể khởi động server:", error);
    }
})();
