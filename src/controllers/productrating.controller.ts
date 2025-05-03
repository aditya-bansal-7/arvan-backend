import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prismaclient.js";
import HttpStatusCodes from "../common/httpstatuscode.js";

const createreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, rating } = req.body;
        const productIdFromParams = req.params.productId;  
        console.log("productIdFromParams", productIdFromParams);

        // Validate required fields
        if (!title || !description || !rating || !productIdFromParams) {
            res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "Missing required fields" });
            return;
        }

        // Ensure rating is a valid number (1-5)
        if (typeof rating !== "number" || rating < 1 || rating > 5) {
            res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "Rating must be a number between 1 and 5" });
            return;
        }

        // Perform product check and create rating in parallel
        const [productExists, productrating] = await Promise.all([
            prisma.product.findUnique({
                where: { id: productIdFromParams }
            }),
            prisma.productRating.create({
                data: {
                    title,
                    description,
                    rating,
                    productId: productIdFromParams,
                    userId: req.user.id 
                }
            })
        ]);

        if (!productExists) {
            res.status(HttpStatusCodes.NOT_FOUND).json({ message: "Product not found" });
            return;
        }

        // Calculate and update average rating in parallel with response
        const updateRating = prisma.productRating.aggregate({
            where: { productId: productIdFromParams },
            _avg: { rating: true }
        }).then(result => {
            return prisma.product.update({
                where: { id: productIdFromParams },
                data: { avgRating: result._avg.rating || 0 }
            });
        });

        res.status(HttpStatusCodes.CREATED).json({
            message: "Testimonial created successfully",
            productrating
        });

        await updateRating;

    } catch (error) {
        console.error("Error creating testimonial:", error);
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Internal Server Error",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// const getTestimonialsByProductId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//     try {
//         const { productId } = req.query; // URL se productId le rahe hain

//         const testimonials = await prisma.productRating.findMany({
//             where: {
//                 productId: productId ? String(productId) : undefined,
//             },
//             orderBy: {
//                 createdAt: "desc"
//             }
//         });

//         res.status(200).json({
//             testimonials
//         });

//     } catch (error) {
//         console.error("Error getting testimonials:", error);
//         res.status(500).json({
//             message: "Internal Server Error",
//             error: error instanceof Error ? error.message : "Unknown error"
//         });
//     }
// };
const getReviewsByProductId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const productId = req.params.productId;  

        if (!productId) {
            res.status(400).json({ message: "Product ID is required" });
            return;
        }

        const reviews = await prisma.productRating.findMany({
            where: { productId: productId },  // Sirf usi product ke reviews lao
            orderBy: { createdAt: "desc" }
        });
        

        res.status(200).json({ reviews });

    } catch (error) {
        console.error("Error getting reviews:", error);
        res.status(500).json({ message: "Internal Server Error", error: error instanceof Error ? error.message : "Unknown error" });
    }
};


export default {
    createreview,
    getReviewsByProductId
};
