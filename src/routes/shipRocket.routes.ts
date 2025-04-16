import { Router } from "express";
import shipRocketController from "../controllers/shiprocket.controller.js";

const router = Router();

router.post("/", shipRocketController.createShiprocketOrder);

router.post("/cancel", shipRocketController.cancelShiprocketOrder);

router.post("/return", shipRocketController.returnShiprocketOrder);

export default router;