const { z } = require('zod');

const createRestaurantSchema = z.object({
    name: z.string()
        .trim()
        .min(1, "Restaurant name is required")
        .max(100, "Restaurant name cannot exceed 100 characters"),
    description: z.string()
        .trim()
        .max(500, "Description cannot exceed 500 characters")
        .optional(),
    pureVeg: z.string().or(z.boolean())
        .transform((val) => typeof val === 'string' ? val.toLowerCase() === 'true' : val),
    addressLine: z.string()
        .trim()
        .min(5, "Address line is required"),
    coordinates: z.array(z.number())
        .length(2, "Coordinates must contain exactly [longitude, latitude]")
        .refine(([lng, lat]) => lng >= -180 && lng <= 180  && lat >= -90 && lat <= 90, {
            message: "Invalid Geospatial coordinates."
        })
});

const updateRestaurantSchema = createRestaurantSchema.partial();

const addMenuItemSchema = z.object({
    name: z.string()
        .trim()
        .min(1, "Menu item name is required")
        .max(100, "Item name cannot exceed 100 characters"),
    description: z.string()
        .trim()
        .max(500, "Description cannot exceed 500 characters")
        .optional(),
    price: z.string().or(z.number())
        .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
        .refine((val) => !isNaN(val) && val >= 0, {
            message: "Price must be a positive number"
        }),
    isVeg: z.string().or(z.boolean())
        .transform((val) => typeof val === 'string' ? val.toLowerCase() === 'true' : val),
    category: z.string()
        .trim()
        .min(1, "Category is required")
        .toLowerCase()
});

const updateMenuItemSchema = addMenuItemSchema.partial();

const rateRestaurantSchema = z.object({
    rating: z.string().or(z.number())
        .transform((val) => typeof val === 'string' ? parseInt(val) : val)
        .refine((val) => !isNaN(val) && val >= 1 && val <= 5, {
            message: "Rating must be an integer between 1 and 5"
        })
})

const rateMenuItemSchema = rateRestaurantSchema;

module.exports = {
    createRestaurantSchema,
    updateRestaurantSchema,
    addMenuItemSchema,
    updateMenuItemSchema,
    rateRestaurantSchema,
    rateMenuItemSchema
};