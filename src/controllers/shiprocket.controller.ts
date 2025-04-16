import { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prismaclient.js";
import { RouteError } from "../common/routeerror.js";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { ShipRocketOrderSchema } from "../types/validations/shipRocket.js";
import axios from "axios";
import { OrderFulfillment } from "@prisma/client";

const getShiprocketToken = async () => {
    const token = await prisma.shiprocketToken.findFirst();

    if (token && token.createdAt.getTime() > Date.now() - 9 * 24 * 60 * 60 * 1000) {
        return token.token;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/auth/login",
            { email, password },
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        const token = response.data.token;
        if (token) {
            await prisma.$transaction([
                prisma.shiprocketToken.deleteMany(),
                prisma.shiprocketToken.create({ data: { token } }),
            ]);
        }
        return token;
    } catch (error) {
        console.error("Shiprocket Auth Error:", error);
        return null;
    }
};

const createShiprocketOrder = async (req: Request, res: Response, next: NextFunction) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const orderData = req.body;

    console.log(orderData);

    const passedData = ShipRocketOrderSchema.safeParse(orderData);
    if (!passedData.success) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid data");
    }


    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
            orderData,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        console.log(response.data);


        const ShipRocketOrderId = response.data.order_id;
        await prisma.$transaction([
            prisma.order.update({
                where: {
                    id: orderData.order_id
                },
                data: {
                    ShipRocketOrderId: ShipRocketOrderId
                }
            })
        ]);

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });

    } catch (error) {
        console.error("Shiprocket Create Order Error:", error);
    }

};

const cancelShiprocketOrder = async (req: Request, res: Response, next: NextFunction) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const orderId = req.body.orderId;

    try {

        const orderData = await prisma.order.findUnique({
            where: {
                id: orderId
            }
        });

        console.log(orderData);

        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/cancel",
            { ids: [orderData?.ShipRocketOrderId] },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );

        console.log(response.data);

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Shiprocket Cancel Order Error:", error);
    }
};


const returnShiprocketOrder = async (req: Request, res: Response, next: NextFunction) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const orderId = req.body.orderId;
    const reason = req.body.reason;
    const additionalInfo = req.body.additionalInfo;

    const order = await prisma.order.findUnique({
        where: {
            id: orderId
        },
        include: {
            items: true
        }
    });

    const getOrderDetails = await axios.get(`https://apiv2.shiprocket.in/v1/external/orders/show/` + order?.ShipRocketOrderId, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${shipToken}`,
        }
    })


    const oData = getOrderDetails.data;
    const orderData = {
        "order_id": oData.data.id,
        "order_date": order?.createdAt.toISOString().split('T')[0],
        "pickup_customer_name": oData.data.customer_name, 
        "pickup_address": oData.data.customer_address,
        "pickup_city": oData.data.customer_city,
        "pickup_state": oData.data.customer_state,
        "pickup_country": oData.data.customer_country,
        "pickup_pincode": oData.data.customer_pincode,
        "pickup_email": oData.data.customer_email,
        "pickup_phone": oData.data.customer_phone,
        "shipping_customer_name": "Kartik ",
        "shipping_address": oData.data.pickup_location,
        "shipping_city": "Gautam Buddha Nagar",
        "shipping_country": "India",
        "shipping_pincode": "201301",
        "shipping_state": "Uttar Pradesh",
        "shipping_phone": "7428637234",
        "order_items": order?.items.map((item) => ({
            "name": item.productName,
            "sku": "ARV" + item.color + item.size,
            "units": item.quantity,
            "selling_price": item.priceAtOrder
        })),
        "payment_method": order?.paid ? "cod" : "Prepaid",
        "sub_total": order?.total,
        "length": oData.data.shipments.length,
        "breadth": oData.data.shipments.breadth,
        "height": oData.data.shipments.height,
        "weight": oData.data.shipments.weight,
    };
    console.log(orderData);
    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/create/return",
            orderData,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        console.log(response.data);

        await prisma.order.update({
            where: {
                id: orderId
            },
            data: {
                returnReason: reason,
                returnAdditionalInfo: additionalInfo,
                fulfillment: OrderFulfillment.RETURNING,
            }
        });

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Shiprocket Return Order Error:", {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            console.error("Shiprocket Return Order Error:", error.response?.data.errors);
            res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: error.response?.data?.message || error.message || "Failed to return order"
            });
        } else {
            console.error("Shiprocket Return Order Error:", error);
            res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: "Failed to return order"
            });
        }
    }
};

export default {
    createShiprocketOrder,
    cancelShiprocketOrder,
    returnShiprocketOrder
};