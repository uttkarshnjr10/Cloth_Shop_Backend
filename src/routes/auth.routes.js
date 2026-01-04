import { Router } from "express";

import { login, logout, refreshAccessToken, registerStaff } from "../controllers/auth.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/login").post(login);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").post(verifyJWT, logout);

// This line was crashing because authorizeRoles wasn't imported above
router.route("/register-staff").post(verifyJWT, authorizeRoles("OWNER"), registerStaff);

export default router;