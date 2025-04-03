import { Router } from "express";
import { prisma } from "../utils/prismaclient.js";
import { orderDeliverd, orderOutforDelivery, orderShipped } from "../utils/whatsappclient.js";

const WebhookRouter = Router();

WebhookRouter.post("/", async (req, res) => {
  console.log("Webhook received");
  console.log(req.body);

  const order = await prisma.order.findUnique({
    where: {
      id: req.body.order_id,
    },
    include: {
      user: true,
      items: true,
    },
  });

  if (!order) {
    res.status(200).json({ success: false });
    return;
  }

  if (!order.awb) {
    prisma.order.update({
      where: {
        id: req.body.order_id,
      },
      data: {
        awb: req.body.awb,
      },
    });
  }

  if (!order.etd || order.etd !== req.body.etd) {
    prisma.order.update({
      where: {
        id: req.body.order_id,
      },
      data: {
        etd: req.body.etd,
      },
    });
  }

  if (order.DeliveryStatus !== req.body.current_status) {
    if (req.body.current_status === "Delivered") {
      await prisma.order.update({
        where: {
          id: req.body.order_id,
        },
        data: {
          status: "COMPLETED",
          deliveredAt: new Date(),
        },
      });
      orderDeliverd(order.user.name ?? "Customer", order.items[0].productName, "Thank You", order.user.mobile_no);
    } else if (req.body.current_status === "Cancelled") {
      await prisma.order.update({
        where: {
          id: req.body.order_id,
        },
        data: {
          status: "CANCELLED",
          deliveredAt: new Date(),
        },
      });
    } else if (req.body.current_status === "Out for Delivery") {
      orderOutforDelivery(order.user.name ?? "Customer", order.items[0].productName, "Thank You", "https://", order.user.mobile_no);
    } else if (req.body.current_status === "Shipped") {
      await prisma.order.update({
        where: {
          id: req.body.order_id,
        },
        data: {
          status: "PENDING",
        },
      });

      orderShipped(order.user.name ?? "Customer", order.items[0].productName, "Thank You", "", order.user.mobile_no);
    }
  }

  prisma.order.update({
    where: {
      id: req.body.order_id,
    },
    data: {
      DeliveryStatus: req.body.current_status,
    },
  });


  res.status(200).json({ success: true });
});

export default WebhookRouter;