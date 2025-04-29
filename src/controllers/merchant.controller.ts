import { Request, Response, NextFunction } from "express";
import { google } from 'googleapis';
import { prisma } from '../utils/prismaclient.js';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const content = google.content({ version: 'v2.1', auth: oauth2Client });

const SyncProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const merchantId = process.env.GOOGLE_MERCHANT_ID;

        // 1. Fetch Merchant Center products
        const merchantProductsResp = await content.products.list({ merchantId });
        const merchantProducts = merchantProductsResp.data.resources || [];

        const merchantMap: { [key: string]: any } = {};
        merchantProducts.forEach(p => {
            if (p.offerId) {
                merchantMap[p.offerId] = p;
            }
        });
        // 2. Fetch DB products
        const dbProducts = await prisma.product.findMany({
            where: {
                status: "PUBLISHED"
            },
            include: {
                category: true,
                assets: true,
            },
        });

        const dbMap: { [key: string]: any } = {};
        dbProducts.forEach(p => {
            const offerId = `product-${p.id}`;
            dbMap[offerId] = p;
        });

        // 3. Calculate diffs
        const toInsert = [];
        const toUpdate = [];
        const toDelete = [];

        const merchantIds = new Set(Object.keys(merchantMap));
        const dbIds = new Set(Object.keys(dbMap));

        // a) New products (in DB, not in Merchant)
        for (const id of dbIds) {
            if (!merchantIds.has(id)) toInsert.push(id);
        }

        // b) Deleted products (in Merchant, not in DB)
        for (const id of merchantIds) {
            if (!dbIds.has(id)) toDelete.push(merchantMap[id].id);
        }

        // c) Updated products (in both, but changed)
        for (const id of dbIds) {
            if (merchantMap[id]) {
                const dbProduct = dbMap[id];
                const merchantProduct = merchantMap[id];

                const isChanged =
                    dbProduct.name !== merchantProduct.title ||
                    dbProduct.description !== merchantProduct.description ||
                    parseFloat(dbProduct.discountPrice ? dbProduct.discountPrice : dbProduct.price).toFixed(2) !== merchantProduct.price?.value;

                if (isChanged) toUpdate.push(merchantMap[id].id);
            }
        }

        // 4. Sync

        for (const id of toInsert) {
            const p = dbMap[id];
            const image = p.assets[0]?.asset_url || 'https://yourstore.com/default.jpg';

            const newProduct = {
                offerId: id,
                title: p.name,
                description: p.description,
                link: `https://www.thearvan.com/product/${p.id}`,
                imageLink: image,
                contentLanguage: 'en',
                targetCountry: 'IN',
                channel: 'online',
                availability: 'in stock',
                condition: 'new',
                price: {
                    value: p.discountPrice ? p.discountPrice.toFixed(2) : p.price.toFixed(2),
                    currency: 'INR',
                },
                brand: p.material,
                productTypes: [p.category.name],
                shipping: [{
                    country: 'IN',
                    service: 'Standard shipping',
                    price: {
                        value: '0.00',
                        currency: 'INR'
                    }
                }],
            };

            await content.products.insert({ merchantId, requestBody: newProduct });
        }

        for (const id of toUpdate) {
            console.log(id);
            const productId = id.split(':').pop();
            console.log(productId);
            const p = dbMap[productId];
            console.log(p);
            const image = p.assets[0]?.asset_url || 'https://yourstore.com/default.jpg';

            const updatedProduct = {
                title: p.name,
                description: p.description,
                link: `https://www.thearvan.com/product/${p.id}`,
                imageLink: image,
                availability: 'in stock',
                condition: 'new',
                price: {
                    value: p.discountPrice ? p.discountPrice.toFixed(2) : p.price.toFixed(2),
                    currency: 'INR',
                },
                brand: p.material,
                productTypes: [p.category.name],
            };

            await content.products.update({
                merchantId,
                productId: id,
                requestBody: updatedProduct,
            });
        }

        for (const id of toDelete) {
            await content.products.delete({ merchantId, productId: id });
        }

        res.json({
            inserted: toInsert.length,
            updated: toUpdate.length,
            deleted: toDelete.length,
            message: 'Sync completed',
        });
    } catch (error) {
        console.error('Full sync error:', error);
        res.status(500).json({ error: 'Full sync failed' });
    }
}

export default {
    SyncProducts,
};