import { Router } from "express";
import {
  getAllDues,
  getDuesById,
  collectDuePayment,
  getDuesStatistics,
  getOverdueDues
} from "../controllers/dues.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // All routes require authentication

// Get all dues (transactions with pending amount)
router.get(
  "/",
  authorizeRoles("OWNER", "STAFF"),
  getAllDues
);

// Get dues statistics (total pending, counts, etc.)
router.get(
  "/statistics",
  authorizeRoles("OWNER", "STAFF"),
  getDuesStatistics
);

// Get overdue dues (based on dueDate < today)
router.get(
  "/overdue",
  authorizeRoles("OWNER", "STAFF"),
  getOverdueDues
);

// Get a single due by TRANSACTION ID
router.get(
  "/:transactionId",
  authorizeRoles("OWNER", "STAFF"),
  getDuesById
);

// Collect payment for a due (partial or full)
router.post(
  "/:transactionId/collect",
  authorizeRoles("OWNER", "STAFF"),
  collectDuePayment
);

export default router;
