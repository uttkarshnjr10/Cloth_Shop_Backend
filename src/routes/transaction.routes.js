import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { recordSale, recordExpense, getTransactionHistory } from "../controllers/transaction.controller.js"; 

const router = Router();
router.use(verifyJWT);

router.route("/sale").post(authorizeRoles("OWNER", "STAFF"), recordSale);
router.route("/expense").post(authorizeRoles("OWNER", "STAFF"), recordExpense);

router.route("/history").get(authorizeRoles("OWNER", "STAFF"), getTransactionHistory);

export default router;