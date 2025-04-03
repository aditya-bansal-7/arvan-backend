import { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prismaclient.js";
import { RouteError } from "../common/routeerror.js";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { ShipRocketOrderSchema } from "../types/validations/shipRocket.js";
import axios from "axios";

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
export default {
    createShiprocketOrder,
    cancelShiprocketOrder
};