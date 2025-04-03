import { PrismaClient, OrderStatus, OrderFulfillment } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { RouteError, ValidationErr } from "../common/routeerror.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updateFulfillmentSchema,
} from "../types/validations/order.js";

import { prisma } from "../utils/prismaclient.js";
import { orderProcessed } from "../utils/whatsappclient.js";

/** ✅ Create a new order */
const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
    const { userId, items, total, addressId ,paid} = parsed.data;


    const order = await prisma.order.create({
      data: {
        userId,
        total,
        addressId,
        status: OrderStatus.PENDING,
        paid: paid,
        fulfillment: OrderFulfillment.PENDING,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            priceAtOrder: item.priceAtOrder,
            color: item.color,
            productImage: item.productImage,
            productName: item.productName,
            size: item.size,
          })),
        },
      },
      include: { items: true },
    });

    // Get all items details

    await orderProcessed(
      req.user.name,
      items[0].productName,
      "ARVAN",
      req.user.mobile_no,
    )
  res.status(HttpStatusCodes.CREATED).json({ success: true, order });
};
/** ✅ Get all orders (Admin) */
const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
  }

  const limit = parseInt(req.query.limit as string) || 10;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;
  const search = req.query.search as string || "";

  // Build the where clause
  const whereClause: any = req.user.role === "ADMIN" ? {} : { userId: req.user.id };
  
  // Add search functionality if search term is provided
  if (search) {
    whereClause.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { userId: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Get orders with pagination
  const orders = await prisma.order.findMany({
    where: whereClause,
    include: { 
      items: true // Include all OrderItem fields directly
    },
    take: limit,
    skip: skip,
    orderBy: { createdAt: 'desc' } // Most recent orders first
  });

  // No need for complex formatting since the OrderItem already contains all needed fields
  const formattedOrders = orders.map(order => ({
    ...order,
    items: order.items.map(item => ({
      id: item.productId,
      quantity: item.quantity,
      priceAtOrder: item.priceAtOrder,
      size: item.size,
      color: item.color,
      productVariantId: item.productVariantId,
      productName: item.productName,
      productImage: item.productImage,
    })),
  }));

  // Get total count for pagination
  const totalItems = await prisma.order.count({
    where: whereClause
  });

  const totalPages = Math.ceil(totalItems / limit);

  res.status(HttpStatusCodes.OK).json({
    success: true,
    orders: formattedOrders,
    pagination: {
      totalPages,
      currentPage: page,
      totalItems,
      itemsPerPage: limit
    }
  });
};

/** ✅ Get a single order by ID */
const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }
  
    const { id } = req.params;
    if (!id) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing order ID");
    }
  
    const myOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true, address: true },
    });

    const order = {
      status: myOrder?.DeliveryStatus,
      message: myOrder?.etd ? `Expected Delivery On ${myOrder?.etd.slice(0,10)}` : "Order is being processed",
      color: "bg-yellow-500",
      actions: (myOrder?.status === "COMPLETED" || myOrder?.status === "CANCELLED" )? [] : ["Cancel Order"],
      awb: myOrder?.awb,
      products: myOrder?.items.map((item) => ({
        id: item.productId,
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        productColor: item.color,
        price: item.priceAtOrder,
        image: item.productImage,
      })),
      totalPrice: myOrder?.total,
      orderDate: myOrder?.createdAt.toISOString().slice(0, 10),
      orderId: id,
      paymentMethod: !myOrder?.paid ? "Cash on Delivery" : "RAZORPAY",
      shippingAddress : {
        name : myOrder?.address?.name,
        street : myOrder?.address?.street,
        city : myOrder?.address?.city,
        state : myOrder?.address?.state,
        pincode : myOrder?.address?.zipCode,
        phone : myOrder?.address?.phone,
      },
      timeline: [
        { status: "Order Placed", date: "5 March 2024, 10:30 AM", completed: true },
        { status: "Payment Confirmed", date: "5 March 2024, 11:15 AM", completed: true },
        { status: "Processing", date: "6 March 2024, 9:00 AM", completed: true },
        { status: "Shipped", date: "7 March 2024, 2:45 PM", completed: true },
        { status: "Out for Delivery", date: "Expected 19 March 2024", completed: false },
        { status: "Delivered", date: "Expected 19 March 2024", completed: false }
      ]
    };
  
    res.status(HttpStatusCodes.OK).json({ success: true, order });
  };

/** ✅ Update order status */
const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "ADMIN") {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
  }

  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing order id");
  }

  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, updatedOrder });
};

/** ✅ Update fulfillment status */
const updateFulfillment = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "ADMIN") {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
  }

  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing order id");
  }

  const parsed = updateFulfillmentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { fulfillment: parsed.data.fulfillment },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, updatedOrder });
};

/** ✅ Delete an order */
const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "ADMIN") {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
  }

  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing order id");
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found");
  }

  await prisma.order.delete({ where: { id } });
  res.status(HttpStatusCodes.OK).json({ success: true, message: "Order deleted" });
};

export default {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateFulfillment,
  deleteOrder,
};
