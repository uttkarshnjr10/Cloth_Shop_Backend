import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getUploadSignature } from "../controllers/image.controller.js";

const router = Router();

// Apply auth middleware to all routes in this file
router.use(verifyJWT);

router.route("/sign-upload").get(getUploadSignature);

export default router;