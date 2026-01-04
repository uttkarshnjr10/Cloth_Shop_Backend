import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { getStats, getSalesChart, getCategoryChart } from "../controllers/dashboard.controller.js";

const router = Router();

// Apply Global Dashboard Security
router.use(verifyJWT);
router.use(authorizeRoles("OWNER")); // Only Owner can access these

router.route("/stats").get(getStats);           // ?filter=today|week|month
router.route("/sales-chart").get(getSalesChart); // Last 7 days
router.route("/category-chart").get(getCategoryChart); // ?filter=month

export default router;