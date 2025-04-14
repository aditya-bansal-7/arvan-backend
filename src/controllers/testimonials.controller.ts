import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prismaclient.js";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { RouteError, ValidationErr } from "../common/routeerror.js";
import { createTestimonialSchema, updateTestimonialSchema } from "../types/validations/testimonial.js";

interface TestimonialInput {
    username: string;
    role: string;
    description: string;
    image: string;
    ratings: number;
  }

  const createTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { username, role, description, image, ratings }: TestimonialInput = req.body;
      // Validate required fields
      const passed = createTestimonialSchema.safeParse({
        ...req.body,
      });

      if (!passed.success) {
        throw new ValidationErr(passed.error.issues);
      }
  
  
      // Ensure rating is a valid number (1-5)
      if (typeof ratings !== "number" || ratings < 1 || ratings > 5) {
        throw new ValidationErr([{
          message: "Invalid rating. Rating must be a number between 1 and 5.",
          path: ["ratings"],
        }]);
      }

      // Create testimonial
      const testimonial = await prisma.testimonial.create({
        data: {
          username,
          role,
          description,
          ratings,
          image,
        },
      });
  
      res.status(HttpStatusCodes.CREATED).json({
        message: "Testimonial created successfully",
        testimonial,
      });
  };

  const getTestimonials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const testimonials = await prisma.testimonial.findMany();
  
      res.status(HttpStatusCodes.OK).json({
        testimonials,
      });
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Internal Error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
  const updateTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    
    
    const { id } = req.params;
    
    if (!id) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing testimonial id");
    }
    
    const parsed = updateTestimonialSchema.safeParse(req.body);
    
    if (!parsed.success) {
      throw new ValidationErr(parsed.error.errors);
    }
    
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: parsed.data
    });
    
    res.status(HttpStatusCodes.OK).json({ success: true, testimonial });
  };
  
  const deleteTestimonial = async (req: Request, res: Response, next: NextFunction) => {

    
    const { id } = req.params;
    
    if (!id) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing testimonial id");
    }
    
    const testimonial = await prisma.testimonial.findUnique({ where: { id } });
    
    if (!testimonial) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Testimonial not found");
    }
    
    await prisma.testimonial.delete({ where: { id } });
    
    res.status(HttpStatusCodes.OK).json({ success: true, message: "Testimonial deleted" });
  };
  export default {
    createTestimonial,
    getTestimonials,
    updateTestimonial,
    deleteTestimonial,
  };