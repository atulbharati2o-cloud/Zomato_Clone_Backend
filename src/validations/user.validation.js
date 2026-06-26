const { z } = require('zod');

const registerSchema = z.object({
    firstName: z.string()
            .trim()
            .min(1, "First name is required")
            .max(50, "First name must be at most 50 characters"),
    lastName: z.string()
            .trim()
            .min(1, "Last name is required")
            .max(50, "Last name must be at most 50 characters"),

    email: z.string()
            .trim()
            .toLowerCase()
            .min(1, "Email is required")
            .email("Invalid email"),

    contactNumber: z.string()
            .trim()
            .min(1, "Contact number is required"),
            
    password: z.string()
            .trim()
            .min(8, "Password must be at least 8 characters")
            .max(15, "Password must be at most 15 characters")
            .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
            .regex(/[a-z]/, "Must contain at least 1 lowercase letter")
            .regex(/[0-9]/, "Must contain at least 1 number")
            .regex(/[^A-Za-z0-9]/, "Must contain at least 1 special character"),

    dob: z.string()
            .trim()
            .optional(),

    role: z.enum(['user', 'owner', 'driver']).optional(),

    vehicleDetails: z.object({
        make: z.string().trim().min(1, "Vehicle make is required"),
        vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
        licenseNumber: z.string().trim().min(1, "License number is required"),
    }).optional(),

    isAvailable: z.boolean().optional()
});

const loginSchema = z.object({
    identifier: z.string()
            .trim()
            .min(1, "Email or contact number is required")
            .transform((val) => (val.includes('@') ? val.toLowerCase() : val)),

    password: z.string()
            .trim()
            .min(1, "Password is required")
});

module.exports = {
    registerSchema,
    loginSchema
};