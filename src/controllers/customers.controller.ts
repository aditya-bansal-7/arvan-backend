import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prismaclient.js";
import { RouteError, ValidationErr } from "../common/routeerror.js";
import HttpStatusCodes from "../common/httpstatuscode.js";
import {
  addAddressSchema,
  getOtpSchema,
  makeotpSchema,
  updatecustomerSchema,
} from "../types/validations/customer.js";

import {
  orderOutforDelivery,
  orderProcessed,
  orderShipped,
  sendOtp,
} from "../utils/whatsappclient.js";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import ENV from "./../common/env.js";
import { forgetpasswordSchema } from "../types/validations/customer.js";
import bcryptjs from "bcryptjs";

const allCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {

    const customers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        mobile_no: true,

        Order: {
          select: {
            id: true,
            total: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        }

      }})
  
      const formattedCustomers = customers.map((customer: { Order: any[]; id: any; name: any; mobile_no: any; }) => {
        const totalOrders = customer.Order.length;
        const totalSpent = customer.Order.reduce((sum, order) => sum + order.total, 0);
        const lastOrder = customer.Order[0]?.createdAt || null;
  
        return {
          id: customer.id,
          name: customer.name || "N/A",
         mobile_no: customer.mobile_no,
          totalOrders,
          totalSpent,
          lastOrder,
        };
      });
  
      res.json({ success: true, data: formattedCustomers });
    } catch (error) {
      console.error("Error fetching customers:", error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to fetch customers");
    }
  };
 const updatecustomer = async(req:Request, res:Response, next:NextFunction) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }

  const partialCustomer = updatecustomerSchema.partial();
  const customer = partialCustomer.safeParse(req.body);


  if (!customer.success) {
    throw new ValidationErr(customer.error.errors);
  }


  const updatedCustomer = await prisma.user.update({
    where: { id },
    data: customer.data,
  });

  res.status(HttpStatusCodes.OK).json({ success: true, updatedCustomer });
};


const getCustomer = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }

  const customer = await prisma.user.findUnique({
    where: { id },
    select:{
      id: true,
      name: true,
      mobile_no: true,
      email: true
    
    }})

  res.status(HttpStatusCodes.OK).json({ success: true, customer });

}
const addAddress = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }
  // const { address } = req.body;
  const parsedData = addAddressSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ValidationErr(parsedData.error.errors);
  }
  console.log(parsedData.data);

  const addressCreate = await prisma.address.create({
    data: {
      userId: id,
      ...parsedData.data,
    },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, addressCreate });
};

const deleteAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }

  const { addressId } = req.params;

  if (!addressId) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing address id");
  }

  await prisma.address.delete({
    where: {
      id: addressId,
      userId: id,
    },
  });

  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Address deleted" });
};

const updateAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }

  const { addressId } = req.params;

  if (!addressId) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing address id");
  }
  // const { address } = req.body;
  const parsedData = addAddressSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ValidationErr(parsedData.error.errors);
  }

  const addressUpdate = await prisma.address.update({
    where: {
      id: addressId,
      userId: id,
    },
    data: {
      ...parsedData.data,
    },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, addressUpdate });
};

const getAddress = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing customer id");
  }

  const address = await prisma.address.findMany({
    where: {
      userId: id,
    },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, address });
};
const generateSecureOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString(); // Always 7 characters
};

const getOtpByNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(req.body);
  const parsedData = makeotpSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ValidationErr(parsedData.error.errors);
  }

  const findOtp = await prisma.otp.findUnique({
    where: {
      userphone: parsedData.data.mobile_no,
    },
  });

  if (findOtp) {
    await prisma.otp.delete({
      where: {
        userphone: parsedData.data.mobile_no,
      },
    });
  }
  console.log("getOtp");
  const getOtp = generateSecureOTP();

  await sendOtp(getOtp, parsedData.data.mobile_no);

  const jwt = await generateToken({  userphone: parsedData.data.mobile_no,type:parsedData.data.type });
  await prisma.otp.create({
    data: {
      userphone: parsedData.data.mobile_no,
      otp: getOtp,
      jwt: jwt
    },
  });

  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "OTP sent successfully", jwt });
};

const getOtpByJwt = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(req.body.jwt);
  const data:any = verifyToken(req.body.jwt);
  ;
  console.log(data);
  if(!data){
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid JWT");
  }
  

 



  const findOtp = await prisma.otp.findUnique({
    where: {
      userphone:data.userphone,
    },
  });

  if (findOtp) {
    await prisma.otp.delete({
      where: {
        userphone: data.userphone,
      },
    });
  }
  console.log("getOtp");
  const getOtp = generateSecureOTP();

  await sendOtp(getOtp, data.userphone);

  const jwt = await generateToken({  userphone: data.userphone,type:data.type });
  await prisma.otp.create({
    data: {
      userphone: data.userphone,
      otp: getOtp,
      jwt: jwt
    },
  });

  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "OTP sent successfully", jwt });
};

function generateToken(payload: object): string {
  const options: SignOptions = {
    expiresIn: "15m", // Ensure this aligns with the expected type
    // other options
  };

  return jwt.sign(payload, ENV.AUTH_SECRET, options);
}
function verifyToken(token: string) {
  try {
    // Verify the token using the secret key
    return jwt.verify(token, ENV.AUTH_SECRET);
  } catch (err: any) {
    console.error("Token verification failed:", err.message);
    return null;
  }
}


const verfy_otp = async (req: Request, res: Response, next: NextFunction) => {
  console.log(req.body)
  const parseddata = getOtpSchema.safeParse(req.body);

  if (!parseddata.success) {
    throw new ValidationErr(parseddata.error.errors);
  }

  const { otp, jwt } = parseddata.data;
  console.log(jwt,otp);

  const verifyJwt: any = verifyToken(jwt)
  console.log(verifyJwt);


  if (!verifyJwt) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid JWT");
  }


  const findOtp = await prisma.otp.findUnique({
    where: {
     userphone:verifyJwt.userphone,
      otp: otp,
      jwt:jwt
    },
  });
  if (!findOtp ) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  if (verifyJwt.type === "verify") {
    await prisma.user.update({
      where: {
        mobile_no: findOtp.userphone,
      },
      data: {
        isPhoneNoVerified: true,
        phoneNoVerified: new Date(),
      },
    });

    await prisma.otp.delete({
      where: {
        otp: findOtp.otp,
      },
    });
    res
      .status(HttpStatusCodes.OK)
      .json({ success: true, message: "mobile verified successfully" });
  } else {
    const token = generateToken({
      mobile_no: findOtp.userphone,
      id: findOtp.id,
      
    });
    await prisma.otp.update({
      where: {
        userphone: findOtp.userphone,
      },
      data: {
        jwt: token,
      },
    });
    console.log(token);
    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "OTP verified successfully",
      jwt: token,
    });
  }
};

const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
 
  const { password, token } = req.body;
  const parsedData = forgetpasswordSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ValidationErr(parsedData.error.errors);
  }
  const tokendata: any = verifyToken(token);
console.log(tokendata);
  if (!tokendata) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid token");
  }
 

  const otp = await prisma.otp.findUnique({
    where: {
      id: tokendata.id,
    },
  });

  if (!otp) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid token");
  }
  if (otp.jwt !== token) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid token");
  }
  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(password, salt);

  await prisma.user.update({
    where: {
      mobile_no: tokendata.mobile_no,
    },
    data: {
      password: hashedPassword,
    },
  })
  await prisma.otp.delete({
    where: {
      userphone: tokendata.mobile_no,
    },
  });
  res.status(HttpStatusCodes.OK).json({ success: true, message: "Password updated successfully" });
};

const makeAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { mobile_no } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      mobile_no: mobile_no,
    },
  });

  if (!user) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "User not found");
  }

  if ( user.role === "ADMIN") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "User is already an admin");
  }

  await prisma.user.update({
    where: {
      mobile_no: mobile_no,
    },
    data: {
      role: "ADMIN",
    },
  });
  res.status(HttpStatusCodes.OK).json({ success: true, message: "User is now an admin" });
};

export default {
  allCustomers,
  updatecustomer,
  addAddress,
  deleteAddress,
  updateAddress,
  getAddress,
  getOtpByNumber,
  getOtpByJwt,
  forgotPassword,
  verfy_otp,
  makeAdmin,
  getCustomer,


};
