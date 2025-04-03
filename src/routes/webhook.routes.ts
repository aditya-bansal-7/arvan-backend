import { Router, Request, Response } from "express";
import { prisma } from "../utils/prismaclient.js";
import { orderDeliverd, orderOutforDelivery, orderShipped } from "../utils/whatsappclient.js";

// Define expected request body structure
interface WebhookRequestBody {
  order_id: string;
  awb?: string;
  etd?: string;
  current_status: string;
}

const WebhookRouter = Router();

WebhookRouter.post("/", async (req: Request, res: Response) => {
  console.log("Webhook received", req.body);

  try {
    const { order_id, awb, etd, current_status } = req.body;

    if (!order_id) {
      res.status(400).json({ success: false, message: "Missing order_id" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: { user: true, items: true },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    let updateData: Record<string, any> = {};

    if (!order.awb && awb) updateData.awb = awb;
    if (!order.etd || order.etd !== etd) updateData.etd = etd;

    if (order.DeliveryStatus !== current_status) {
      switch (current_status.toUpperCase()) {
        case "DELIVERED":
          updateData.status = "COMPLETED";
          updateData.deliveredAt = new Date();
          orderDeliverd(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", order.user?.mobile_no ?? "");
          break;
        case "CANCELED":
          updateData.status = "CANCELLED";
          updateData.deliveredAt = new Date();
          break;
        case "OUT FOR DELIVERY":
          orderOutforDelivery(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", "", order.user?.mobile_no ?? "");
          break;
        case "SHIPPED":
          updateData.status = "PENDING";
          orderShipped(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", "", order.user?.mobile_no ?? "");
          break;
      }
    }

    updateData.DeliveryStatus = current_status;

    await prisma.order.update({
      where: { id: order_id },
      data: updateData,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default WebhookRouter;
