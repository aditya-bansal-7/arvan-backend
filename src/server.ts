import morgan from 'morgan';

import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';


import 'express-async-errors';

// import BaseRouter from '@src/routes';
import { authenticateJWT, globalErrorHandler } from './middleware/globalerrorhandler.js';

import ENV from './common/env.js';
import HttpStatusCodes from './common/httpstatuscode.js';
import { RouteError } from './common/routeerror.js';
import { NodeEnvs } from './common/constants.js';
import cors from 'cors';
import cookieParser from 'cookie-parser'


/******************************************************************************
                                Setup
******************************************************************************/

const app = express();

// **** Middleware **** //

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Show routes called in console during development
if (ENV.NODE_ENV === NodeEnvs.Dev) {
  app.use(morgan('dev'));
}

// WebHook
import webhookRoutes from './routes/webhook.routes.js'
import whatsappRoutes from './routes/whatsapp.routes.js'

const healthCheck = express.Router();

healthCheck.get("/", (req: Request, res: Response) => {
  res.status(HttpStatusCodes.OK).json({
    success: true,
    message: "Server is running",
  });
});


app.use("/api/webhook", webhookRoutes);

app.use("/api/whatsapp", whatsappRoutes);

app.use("/api/health", healthCheck);

//CORS
const whitelist = [ENV.FRONTENDURL];
const corsOptions = {
  origin: ENV.FRONTENDURL,// Only allow your frontend URL
  credentials: true,     
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.set("trust proxy", true);

app.use(cors(corsOptions));
// Add APIs, must be after middleware

import UserRouter from './routes/products.routes.js'
import uploadRouter from './routes/upload.routes.js'
import categoryRouter from './routes/category.routes.js'
import customersRoutes from './routes/customers.routes.js'
import orderRoutes from './routes/order.routes.js'
import testimonialsRoutes from './routes/testimonials.routes.js'
import productratingRoutes from './routes/productsrating.routes.js'
import resendEmailRoutes from './routes/resendemail.js'
import inventoryRouter from './routes/inventory.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'
import getAllTimeMetricsRoutes from './routes/salesmetrics.routes.js'
import productPerformanceRouter from './routes/productperformance.routes.js'
import shipRocketRoutes from './routes/shipRocket.routes.js'
import merchantRoutes from './routes/merchant.routes.js'

app.use(globalErrorHandler);
app.use("/api/products", UserRouter);
// app.use(Paths.Base, BaseRouter);

app.use("/api/upload", uploadRouter);

app.use("/api/category", categoryRouter);

app.use("/api/customers", customersRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/reviews", productratingRoutes);

app.use("/api/testimonials", testimonialsRoutes);


app.use("/api/send", resendEmailRoutes);

app.use("/api/inventory", inventoryRouter);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/sales", getAllTimeMetricsRoutes);

app.use("/api/productperformance", productPerformanceRouter);

app.use("/api/shiprocket", authenticateJWT, shipRocketRoutes);

app.use("/api/merchant", merchantRoutes);

// Add error handler

// app.use(authenticateJWT)



// **** FrontEnd Content **** //

// Set views directory (html)

// Redirect to login if not logged in.


/******************************************************************************
                                Export default
******************************************************************************/

export default app;


