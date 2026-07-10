const { z } = require('zod');
const mongoose = require('mongoose');

const objectIdString = z.string().refine(
    (val) => mongoose.Types.ObjectId.isValid(val),
    { message: "Must be a valid ObjectId" }
);

const initiatePaymentSchema = z.object({
    orderId: objectIdString
});

const verifyPaymentSchema = z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string()
});

module.exports = {
    initiatePaymentSchema, 
    verifyPaymentSchema 
};