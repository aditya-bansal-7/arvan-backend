import { z } from "zod";
import { AssetType, ProductStatus, VariantsValues } from "@prisma/client";

export const addProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be a positive number"),
  discountPrice: z.number().positive("Discount price must be a positive number").optional(),
  category_id: z.string().cuid("Invalid category ID"),
  material: z.string().min(1, "Material is required"),
  assets: z
    .array(
      z.object({
        url: z.string().url("Invalid asset URL"),
        type: z.nativeEnum(AssetType, {
          errorMap: () => ({ message: "Invalid asset type" }),
        }),
      })
    )
    .optional(),
    status: z.nativeEnum(ProductStatus, {
      errorMap: () => ({ message: "Invalid asset type" }),
    }),
});

// id: string | undefined, name: string, assets: { url: string; type: string }[]
export const updateColorSchema = z.object({
  name: z.string().min(1, "Color name is required"),
  assets: z.array(
    z.object({
      url: z.string().url("Invalid asset URL"),
      type: z.nativeEnum(AssetType, {
        errorMap: () => ({ message: "Invalid asset type" }),
      }),
    })
  )
})

export const addColorSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  color: z.string().min(1, "Color is required"),
  assets: z.array(
    z.object({
      url: z.string().url("Invalid asset URL"),
      type: z.nativeEnum(AssetType, {
        errorMap: () => ({ message: "Invalid asset type" }),
      }),
    })
  ),
  sizes: z.array(
    z.object({
      size: z.nativeEnum(VariantsValues, {
        errorMap: () => ({ message: "Invalid size value" }),
      }),
      stock: z.number().int().min(0, "Stock must be a non-negative integer"),
    })
  ),
});

export const addSizesSchema = z.object({
  colorId: z.string().cuid("Invalid color ID"),
  sizes: z.array(
    z.object({
      size: z.nativeEnum(VariantsValues, {
        errorMap: () => ({ message: "Invalid size value" }),
      }),
      stock: z.number().int().min(0, "Stock must be a non-negative integer"),
    })
  ),
});

export const updateStockSchema = z.object({
  variantId: z.string().cuid("Invalid variant ID"),
  stock: z.number().int().min(0, "Stock must be a non-negative integer"),
});
