import { Router } from "express";
import  MerchantController  from "../controllers/merchant.controller.js";
import { authenticateJWT, isAdmin } from "../middleware/globalerrorhandler.js";

const router = Router();

router.get("/sync",authenticateJWT,isAdmin, MerchantController.SyncProducts);

export default router;