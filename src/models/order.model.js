const mongoose = require("mongoose");
const { ORDER_STATUSES } = require("../utils/constants.js");


const orderItemSchema = new mongoose.Schema({
    menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    isVeg: {
        type: Boolean,
        required: true
    }
}, { _id: false }); 


const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    items: {
        type: [orderItemSchema],
        required: true
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    deliveryAddress: {
        addressLine: {
            type: String,
            required: true,
            trim: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        }
    },
    status: {
        type: String,
        enum: ORDER_STATUSES,
        default: 'placed'
    },

    // Track the history of status changes
    statusHistory: [{
        status: {
            type: String,
            enum: ORDER_STATUSES,
            required: true
        },
        changedAt: {
            type: Date,
            default: Date.now
        }
    }],

    cancelledReason: {
        type: String,
        trim: true,
        default: null
    },

    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    deliveryPartner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });


// Order list sorted as newest first
orderSchema.index({ user: 1, createdAt: -1 });



const Order = mongoose.model('Order', orderSchema);
module.exports = Order;