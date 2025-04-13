import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { prisma } from "../utils/prismaclient.js";

const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  const limit = parseInt(req.query.limit as string) || 5;

  const topProducts = await prisma.orderItem.groupBy({
    by: ["productVariantId"],
    _sum: {
      quantity: true,
      priceAtOrder: true,
    },
  });

  // Sort manually (since Prisma does not allow ordering by _sum)
  topProducts.sort((a, b) => (b._sum.quantity || 0) - (a._sum.quantity || 0));

  // Limit results after sorting
  const limitedProducts = topProducts.slice(0, limit);

  const products = await Promise.all(
    limitedProducts.map(async (item) => {
      const productVariant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        include: {
          color: {
            include: {
              product: true,
            },
          },
        },
      });

      return {
        id: productVariant?.color?.product?.id || "",
        name: productVariant?.color?.product?.name || "Unknown Product",
        sales: item._sum.quantity || 0,
        revenue: item._sum.priceAtOrder || 0,
      };
    })
  );

  res.status(HttpStatusCodes.OK).json({ success: true, products });
};


const getBesSellers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const limit = parseInt(req.query.limit as string) || 10;

  // Step 1: Group by variantId (bestsellers)
  const topProducts = await prisma.orderItem.groupBy({
    by: ["productVariantId"],
    _sum: {
      quantity: true,
    },
  });

  // Step 2: Sort by quantity sold
  const sortedVariants = topProducts
    .sort((a, b) => (b._sum.quantity || 0) - (a._sum.quantity || 0));

  // Step 3: Fetch variant details including product
  const topVariants = await prisma.productVariant.findMany({
    where: {
      id: {
        in: sortedVariants.map((v) => v.productVariantId),
      },
    },
    include: {
      color: {
        include: {
          product: {
            include: { category: true },
          },
          assets: { take: 1 },
        },
      },
    },
  });

  // Step 4: Keep only one variant per product
  const uniqueProductsMap = new Map();
  for (const variant of topVariants) {
    const product = variant.color?.product;
    if (product && !uniqueProductsMap.has(product.id)) {
      uniqueProductsMap.set(product.id, variant);
    }
    if (uniqueProductsMap.size >= limit) break;
  }

  // Step 5: If not enough unique products, fetch more
  if (uniqueProductsMap.size < limit) {
    const existingProductIds = Array.from(uniqueProductsMap.keys());

    const additionalVariants = await prisma.productVariant.findMany({
      where: {
        color: {
          product: {
            id: { notIn: existingProductIds },
          },
        },
      },
      take: limit - uniqueProductsMap.size,
      include: {
        color: {
          include: {
            product: {
              include: { category: true },
            },
            assets: { take: 1 },
          },
        },
      },
    });

    for (const variant of additionalVariants) {
      const product = variant.color?.product;
      if (product && !uniqueProductsMap.has(product.id)) {
        uniqueProductsMap.set(product.id, variant);
      }
    }
  }

  // Step 6: Format result
  const products = Array.from(uniqueProductsMap.values()).map((variant) => ({
    productid: variant.color?.product?.id || "",
    img: variant.color.assets[0]?.asset_url || "",
    name: variant.color?.product?.name || "",
    price: variant.color?.product?.price || 0,
    category: variant.color?.product?.category?.name || "",
    discount: variant.color?.product?.discountPrice || 0,
  }));

  res.status(HttpStatusCodes.OK).json({ success: true, products });
};


const newArrivals = async (req: Request, res: Response, next: NextFunction) => {
  const limit = parseInt(req.query.limit as string) || 5;

  const newProducts = await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    where: {
      status: "PUBLISHED",
    },
    include: {
      category: true,
      assets: {
        take: 1,
      },
    },
  });

  const products = newProducts.map((product) => ({
    id: product.id,
    name: product.name,
    img: product.assets[0].asset_url,
    price: product.price,
    discountPrice: product.discountPrice,
    category: product.category.name,
  }));

  res.status(HttpStatusCodes.OK).json({ success: true, products });
};


export const AnalyticsController = {
  getTopProducts,
  getBesSellers,
  newArrivals,
};
