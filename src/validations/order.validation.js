const { z } = require("zod");
const mongoose = require('mongoose');

// ObjectId string validator
const objectIdString = z.string()
    .refine( (val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid ObjectId string"
    });



const placeOrderSchema = z.object({
    cartId: objectIdString,
    paymentMethod: z.enum(["online", "cod"], {
        errorMap: () => ({ message: "Invalid payment method" }) 
    }),
    deliveryAddress: z.object({
        addressLine: z.string()
            .trim()
            .min(5, "Address is too short"),
        coordinates: z
            .tuple([
                z.number()
                    .min(-180, "Longitude must be between -180 and 180")
                    .max(180, "Longitude must be between -180 and 180"),
                z.number()
                    .min(-90, "Latitude must be between -90 and 90")
                    .max(90, "Latitude must be between -90 and 90")
            ])
    })
});

const updateOrderStatusSchema = z.object({
    status: z.enum(
        ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"],
        { errorMap: () => ({ message: "Invalid order status" }) }
    ),
    cancellationReason: z.string()
        .trim()
        .min(3, "Cancellation reason is too short")
        .optional()
});


module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};