const express = require("express");

const router = express.Router();

const productController = require("../controllers/ProductController");

router.get("/", productController.getAll);
router.post("/", productController.create);
router.put("/:id", productController.update);

module.exports = router;