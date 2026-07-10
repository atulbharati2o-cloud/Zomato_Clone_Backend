const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const orderModel = require('../models/order.model.js');
const paymentModel = require('../models/payment.model.js');
const razorpayInstance = require('../services/razorpay.service.js');
const crypto = require('crypto');


// Initiate payment - only for online orders
const initiatePayment = async (req, res) => {
    try{
        const userId = req.user._id;
        const { orderId } = req.body;

        const order = await orderModel.findOne({ _id: orderId, user: userId });
        if(!order){
            return apiError(res, 404, "Order not found");
        }

        if(order.paymentMethod === 'cod'){
            return apiError(res, 400, "Payment initiation is not required for Cash on Delivery", "Bad Request");
        }

        if(order.paymentStatus === 'paid'){
            return apiError(res, 400, "Payment has already been completed for this order", "Bad Request");
        }

        const amountInPaise = Math.round(order.totalPrice * 100);

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `order_rcptid_${orderId}`,
            notes: {
                internalOrderId: orderId.toString(),
                userId: userId.toString()
            }
        });

        const payment = await paymentModel.create({
            order: order._id,
            user: userId,
            amount: amountInPaise,
            currency: "INR",
            razorpayOrderId: razorpayOrder.id,
            status: "created"
        });

        return apiResponse(res, 200, "Payment initiated successfully", {
            razorpayOrderId: razorpayOrder.id,
            amount: amountInPaise,
            currency: "INR",
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            paymentId: payment._id
        });

    } catch(error){
        console.error("Error initiating payment:", error);
        return apiError(res, 500, "Error initiating payment", error.message);    
    }
};


// Verify payment - frontend callback
const verifyPayment = async (req, res) => {
    try{
        const userId = req.user._id;
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        const payment = await paymentModel.findOne({ razorpayOrderId, user: userId });
        if(!payment){
            return apiError(res, 404, "Payment record not found", "Not Found");
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if(expectedSignature !== razorpaySignature){
            payment.status = 'failed';
            await payment.save();
            return apiError(res, 400, "Payment signature verification failed", "Bad Request");
        }

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.status = 'paid';
        await payment.save();

        await orderModel.findByIdAndUpdate(payment.order, { paymentStatus: 'paid' });

        return apiResponse(res, 200, "Payment verified successfully", { payment });

    } catch(error){
        console.error("Error verifying payment:", error);
        return apiError(res, 500, "Error verifying payment", error.message);
    }
};


// Razorpay webhook - just for extra security when user closes the browser before the payment verification
const handleRazorpayWebhook = async (req, res) => {
    try{
        const webhookSignature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body) // raw Buffer, NOT parsed JSON
            .digest('hex');

        if(expectedSignature !== webhookSignature){
            console.error("Webhook signature mismatch — possible spoofed request");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        const payload = JSON.parse(req.body.toString());
        const event = payload.event;

        if(event === 'payment.captured'){
            const razorpayPaymentEntity = payload.payload.payment.entity;
            const razorpayOrderId = razorpayPaymentEntity.order_id;

            const payment = await paymentModel.findOne({ razorpayOrderId });
            if(payment && payment.status !== 'paid'){
                payment.status = 'paid';
                payment.razorpayPaymentId = razorpayPaymentEntity.id;
                payment.method = razorpayPaymentEntity.method;
                await payment.save();

                await orderModel.findByIdAndUpdate(payment.order, { paymentStatus: 'paid' });
            }
        }

        if(event === 'payment.failed'){
            const razorpayPaymentEntity = payload.payload.payment.entity;
            const razorpayOrderId = razorpayPaymentEntity.order_id;

            const payment = await paymentModel.findOne({ razorpayOrderId });
            if(payment){
                payment.status = 'failed';
                await payment.save();

                await orderModel.findByIdAndUpdate(payment.order, { paymentStatus: 'failed' });
            }
        }

        return res.status(200).json({ success: true });

    } catch(error){
        console.error("Error handling Razorpay webhook:", error);
        return res.status(500).json({ success: false, message: "Webhook processing error" });
    }
};


module.exports = {
    initiatePayment,
    verifyPayment,
    handleRazorpayWebhook
};




/**
 * SHA256 = Secure Hash Algorithm 256-bit
 *     same input always produces same output of fixed length (256 bits)
 * HMAC = Hash-based Message Authentication Code
 *    .createHmac(algorithm, key) - creates an HMAC signature using sha256 hash function with this secret key
 *    .update(rzpOrderId + "|" + paymentId) - actual data/msg to sign
 *    .digest('hex') - returns the signature in human redable hexadecimal format(like a3f8c2...)
 */