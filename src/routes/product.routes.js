import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { getProducts, createProduct, deleteProduct } from "../controllers/product.controller.js";

const router = Router();

// Public Routes (For Customers)
router.route("/").get(getProducts);

// Protected Routes (For Staff/Owner)
router.route("/").post(verifyJWT, authorizeRoles("OWNER", "STAFF"), createProduct);
router.route("/:id").delete(verifyJWT, authorizeRoles("OWNER", "STAFF"), deleteProduct);

export default router;