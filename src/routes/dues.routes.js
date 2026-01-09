import { Router } from "express";
import {
    getAllDues,
    getDuesById,
    updateDuesStatus,
    getDuesStatistics,
    getOverdueDues,
    updateDuesCustomerDetails
} from "../controllers/dues.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();    

router.use(verifyJWT); // All routes require authentication

// Get all dues with filters and pagination
router.get("/", authorizeRoles("OWNER", "STAFF"), getAllDues);

// Get dues statistics
router.get("/statistics", authorizeRoles("OWNER", "STAFF"), getDuesStatistics);

// Get overdue dues
router.get("/overdue", authorizeRoles("OWNER", "STAFF"), getOverdueDues);

// Get dues by ID
router.get("/:duesId", authorizeRoles("OWNER", "STAFF"), getDuesById);

// Update dues status
router.patch("/:duesId/status", authorizeRoles("OWNER", "STAFF"), updateDuesStatus);

// Update customer details
router.patch("/:duesId/customer-details", authorizeRoles("OWNER", "STAFF"), updateDuesCustomerDetails);

export default router;