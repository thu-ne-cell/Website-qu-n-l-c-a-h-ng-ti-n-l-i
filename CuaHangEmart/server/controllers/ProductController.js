const { connectDB } = require("../database/connection");


// ========================================
// LẤY DANH SÁCH SẢN PHẨM
// ========================================
exports.getAll = async (req, res) => {

    try {

        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                p.ProductID,
                p.Barcode,
                p.ProductCode,
                p.ProductName,

                p.CategoryID,
                c.CategoryName,

                p.SupplierID,
                s.SupplierName,

                p.Unit,
                p.PurchasePrice,
                p.SellingPrice,

                p.MinStock,
                p.CurrentStock,

                p.ImageURL,
                p.IsActive,

                p.ExpiryDate,

                p.CreatedAt,
                p.UpdatedAt

            FROM Products p

            LEFT JOIN Categories c
                ON p.CategoryID = c.CategoryID

            LEFT JOIN Suppliers s
                ON p.SupplierID = s.SupplierID

            ORDER BY p.ProductID DESC
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (err) {

        console.error("Lỗi lấy danh sách sản phẩm:", err);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách sản phẩm."
        });

    }

};

/**
 * THÊM SẢN PHẨM MỚI VÀO SQL SERVER
 */
exports.create = async (req, res) => {
    try {
        const {
            ProductName,
            Barcode,
            CategoryID,
            SellingPrice,
            CurrentStock,
            MinStock,
            ExpiryDate,
            ImageURL,
            PurchasePrice,
            SupplierID,
            Unit,
            ProductCode
        } = req.body;

        // Kiểm tra dữ liệu bắt buộc
        if (
            !ProductName ||
            !Barcode ||
            !CategoryID ||
            SellingPrice === undefined ||
            CurrentStock === undefined ||
            MinStock === undefined ||
            !ExpiryDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin sản phẩm."
            });
        }

        const pool = await connectDB();

        // Kiểm tra mã barcode đã tồn tại chưa
        const duplicate = await pool.request()
            .input("Barcode", require("mssql").NVarChar, Barcode)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE Barcode = @Barcode
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Mã barcode đã tồn tại."
            });
        }

        const result = await pool.request()
            .input("Barcode", require("mssql").NVarChar, Barcode)
            .input("ProductCode", require("mssql").NVarChar, ProductCode || null)
            .input("ProductName", require("mssql").NVarChar, ProductName)
            .input("CategoryID", require("mssql").Int, Number(CategoryID))
            .input("SupplierID", require("mssql").Int, SupplierID ? Number(SupplierID) : null)
            .input("Unit", require("mssql").NVarChar, Unit || "Cái")
            .input("PurchasePrice", require("mssql").Decimal(18, 2), Number(PurchasePrice) || 0)
            .input("SellingPrice", require("mssql").Decimal(18, 2), Number(SellingPrice))
            .input("CurrentStock", require("mssql").Int, Number(CurrentStock))
            .input("MinStock", require("mssql").Int, Number(MinStock))
            .input("ImageURL", require("mssql").NVarChar, ImageURL || null)
            .input("ExpiryDate", require("mssql").Date, ExpiryDate)
            .query(`
                INSERT INTO Products (
                    Barcode, ProductCode, ProductName, CategoryID,
                    SupplierID, Unit, PurchasePrice, SellingPrice,
                    CurrentStock, MinStock, ImageURL, ExpiryDate, IsActive
                )
                OUTPUT INSERTED.ProductID
                VALUES (
                    @Barcode, @ProductCode, @ProductName, @CategoryID,
                    @SupplierID, @Unit, @PurchasePrice, @SellingPrice,
                    @CurrentStock, @MinStock, @ImageURL, @ExpiryDate, 1
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công.",
            data: {
                ProductID: result.recordset[0].ProductID
            }
        });

    } catch (err) {
        console.error("Lỗi thêm sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể thêm sản phẩm vào SQL Server.",
            error: err.message
        });
    }
};

/**
 * CẬP NHẬT SẢN PHẨM TRONG SQL SERVER
 */
exports.update = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);

        const {
            ProductName,
            Barcode,
            ProductCode,
            CategoryID,
            SupplierID,
            Unit,
            PurchasePrice,
            SellingPrice,
            CurrentStock,
            MinStock,
            ImageURL,
            ExpiryDate
        } = req.body;

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        if (
            !ProductName?.trim() ||
            !Barcode?.trim() ||
            !Number.isInteger(Number(CategoryID)) ||
            Number(CategoryID) <= 0 ||
            !Number.isFinite(Number(SellingPrice)) ||
            Number(SellingPrice) < 0 ||
            !Number.isInteger(Number(CurrentStock)) ||
            Number(CurrentStock) < 0 ||
            !Number.isInteger(Number(MinStock)) ||
            Number(MinStock) < 0 ||
            !ExpiryDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Thông tin sản phẩm không hợp lệ."
            });
        }

        const pool = await connectDB();

        // Kiểm tra sản phẩm có tồn tại
        const existing = await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE ProductID = @ProductID
            `);

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm."
            });
        }

        // Không cho trùng barcode với sản phẩm khác
        const duplicate = await pool.request()
            .input("Barcode", sql.NVarChar, Barcode.trim())
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE Barcode = @Barcode
                  AND ProductID <> @ProductID
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Barcode đã được sử dụng bởi sản phẩm khác."
            });
        }

        await pool.request()
            .input("ProductID", sql.Int, productId)
            .input("ProductName", sql.NVarChar, ProductName.trim())
            .input("Barcode", sql.NVarChar, Barcode.trim())
            .input("ProductCode", sql.NVarChar, ProductCode || null)
            .input("CategoryID", sql.Int, Number(CategoryID))
            .input("SupplierID", sql.Int,
                SupplierID ? Number(SupplierID) : null)
            .input("Unit", sql.NVarChar, Unit || "Cái")
            .input("PurchasePrice", sql.Decimal(18, 2),
                Number(PurchasePrice) || 0)
            .input("SellingPrice", sql.Decimal(18, 2),
                Number(SellingPrice))
            .input("CurrentStock", sql.Int, Number(CurrentStock))
            .input("MinStock", sql.Int, Number(MinStock))
            .input("ImageURL", sql.NVarChar, ImageURL || null)
            .input("ExpiryDate", sql.Date, ExpiryDate)
            .query(`
                UPDATE Products
                SET
                    ProductName = @ProductName,
                    Barcode = @Barcode,
                    ProductCode = @ProductCode,
                    CategoryID = @CategoryID,
                    SupplierID = @SupplierID,
                    Unit = @Unit,
                    PurchasePrice = @PurchasePrice,
                    SellingPrice = @SellingPrice,
                    CurrentStock = @CurrentStock,
                    MinStock = @MinStock,
                    ImageURL = @ImageURL,
                    ExpiryDate = @ExpiryDate,
                    UpdatedAt = GETDATE()
                WHERE ProductID = @ProductID
            `);

        return res.json({
            success: true,
            message: "Cập nhật sản phẩm thành công.",
            data: { ProductID: productId }
        });

    } catch (err) {
        console.error("Lỗi cập nhật sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật sản phẩm trong SQL Server.",
            error: err.message
        });
    }
};
