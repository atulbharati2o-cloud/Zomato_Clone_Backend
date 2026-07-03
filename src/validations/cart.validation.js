const { z } = require('zod');
const mongoose = require('mongoose');

// ObjectId string validator
const objectIdString = z.string()
    .refine( (val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid ObjectId string"
    });


const addItemToCartSchema = z.object({
    restaurantId: objectIdString,
    menuItemId: objectIdString,
    quantity: z.number({ invalid_type_error: "Quantity must be a number" })
        .int("Quantity must be an integer")
        .min(1, "Quantity must be at least 1")
        .max(20, "Quantity cannot exceed 20")
        .optional()
        .default(1)
});

const updateCartItemQuantitySchema = z.object({
    menuItemId: objectIdString,
    quantity: z.number({ invalid_type_error: "Quantity must be a number" })
        .int("Quantity must be an integer")
        .min(1, "Quantity must be at least 1")
        .max(20, "Quantity cannot exceed 20")
});


module.exports = {
    addItemToCartSchema,
    updateCartItemQuantitySchema
};