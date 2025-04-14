import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { RouteError, ValidationErr } from "../common/routeerror.js";
import {
    addCategorySchema,
    updateCategorySchema,
} from "../types/validations/category.js";

import { prisma } from "../utils/prismaclient.js";

/** ✅ Add a new category */
const addCategory = async (req: Request, res: Response, next: NextFunction) => {

    const parsed = addCategorySchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ValidationErr(parsed.error.errors);
    }
    const { name } = parsed.data;

    const category = await prisma.category.create({
        data: {
            name,
        },
    });

    res.status(HttpStatusCodes.CREATED).json({ success: true, category });
};

/** ✅ Update a category */
const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    const parsed = updateCategorySchema.safeParse(req.body);

    if (!parsed.success) {
        throw new ValidationErr(parsed.error.errors);
    }
    const { id } = req.params;

    if (!id) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing category id");
    }

    const category = await prisma.category.update({
        where: { id },
        data: {
            name: parsed.data.name,
            description: parsed.data.description,
        },
    });

    res.status(HttpStatusCodes.OK).json({ success: true, category });
};

/** ✅ Delete a category */
const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing category id");
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Category not found");
    }

    await prisma.category.delete({ where: { id } });
    res.status(HttpStatusCodes.OK).json({ success: true, message: "Category deleted" });
};

/** ✅ Get all categories */
const getAllCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const categories = await prisma.category.findMany();
    res.status(HttpStatusCodes.OK).json({ success: true, categories });
};

/** ✅ Get a category by ID */
const getCategory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing category id");
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Category not found");
    }

    res.status(HttpStatusCodes.OK).json({ success: true, category });
};

export default {
    addCategory,
    updateCategory,
    deleteCategory,
    getAllCategories,
    getCategory,
};