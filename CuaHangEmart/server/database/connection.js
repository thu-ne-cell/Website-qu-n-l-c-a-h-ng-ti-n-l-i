const sql = require("mssql");
require("dotenv").config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function connectDB() {
    try {

        console.log("===== CONFIG =====");
        console.log(config);
        console.log("==================");

        const pool = await sql.connect(config);

        console.log("====================================");
        console.log("✅ Đã kết nối SQL Server thành công!");
        console.log("====================================");

        return pool;

    } catch (err) {

        console.log("===== ERROR =====");
        console.log("Name:", err.name);
        console.log("Code:", err.code);
        console.log("Message:", err.message);

        if (err.originalError) {
            console.log("Original Error:");
            console.log(err.originalError);
        }

        console.log("=================");

    }
}

module.exports = {
    sql,
    connectDB
};