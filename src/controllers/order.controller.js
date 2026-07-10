const apiResponse = require("../utils/apiResponse.js");
const apiError = require("../utils/apiError.js");
const cartModel = require("../models/cart.model.js");
const restaurantModel = require("../models/restaurant.model.js");
const orderModel = require("../models/order.model.js");
const mongoose = require("mongoose");
const claimNearestAvailableDriver = require("../services/driverAssignment.service.js");

const { ORDER_STATUSES } = require("../utils/constants.js");

// To prevent invalid status transitions 
const ALLOWED_TRANSITIONS = {
    placed: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['out_for_delivery'],
    out_for_delivery: ['delivered'],
    delivered: [],
    cancelled: []
};


// Place order( checkout: cart -> order)
const placeOrder = async (req, res) => {
    try{
        const userId = req.user._id;
        const { cartId, deliveryAddress, paymentMethod } = req.body; // deliveryAddress = { addressLine, coordinates: [longitude, latitude] }

        const cart = await cartModel.findOne({ _id: cartId, user: userId });
        if(!cart){
            return apiError(res, 404, "Cart not found", "Not Found");
        }
        if(!cart.items || cart.items.length === 0){
            return apiError(res, 400, "Cart is empty", "Bad Request");
        }

        const restaurant = await restaurantModel.findById(cart.restaurant);
        if(!restaurant){
            return apiError(res, 404, "Associated restaurant not found", "Not Found");
        }
        if(!restaurant.isOpen){
            return apiError(res, 400, "Restaurant is currently closed", "Bad Request");
        }

        
        // Check if all the cart items are still available
        const menuById = new Map(restaurant.menu.map(item => [item._id.toString(), item]));
        const orderItems = [];
        const unavailableItemNames = [];
        for(const cartItem of cart.items){
            const menuItem = menuById.get(cartItem.menuItem.toString());

            if(!menuItem || !menuItem.isAvailable){
                unavailableItemNames.push(menuItem?.name || "Unknown Item");
                continue;
            }

            orderItems.push({
                menuItemId: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: cartItem.quantity,
                isVeg: menuItem.isVeg
            });
        }

        if(unavailableItemNames.length > 0){
            return apiError(res, 409, "Some items in your cart are no longer available", { unavailableItems: unavailableItemNames });
        }

        const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const newOrder = await orderModel.create({
            user: userId,
            restaurant: restaurant._id,
            items: orderItems,
            totalPrice,
            deliveryAddress: {
                addressLine: deliveryAddress.addressLine,
                location: {
                    type: "Point",
                    coordinates: deliveryAddress.coordinates
                }
            },
            paymentMethod,
            paymentStatus: 'pending',
            status: 'placed',
            statusHistory: [{
                status: 'placed'
            }]
        });


        // Clear the cart after placing the order
        await cartModel.findByIdAndDelete(cartId);

        return apiResponse(res, 201, "Order placed successfully", { order: newOrder });
    } catch(error){
        console.error("Error occurred while placing order:", error);
        return apiError(res, 500, "Internal Server Error while placing order", error.message);
    }
};


// get all orders --> accessed by the user only
const getUserOrders = async (req, res) => {
    try{
        const userId = req.user._id;
        const { page = 1, limit = 10, status } = req.query;

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const query = { user: userId };
        if(status && ORDER_STATUSES.includes(status)){
            query.status = status;
        }

        const totalOrders = await orderModel.countDocuments(query);
        const orders = await orderModel.find(query)
            .populate('restaurant', 'name bannerImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber)
            .lean();


        return apiResponse(res, 200, "User orders fetched successfully", {
            orders,
            pagination: {
                totalOrders,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalOrders / limitNumber),
                itemsPerPage: limitNumber
            }
        });

    } catch(error){
        console.error("Error occurred while fetching user orders:", error);
        return apiError(res, 500, "Internal Server Error while fetching user orders", error.message);
    }
};


// Get order by ID --> can be accessed by the user who placed order or the restaurant owner
const getOrderById = async (req, res) => {
    try{
        const { orderId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return apiError(res, 400, "Invalid order ID", "Bad Request");
        }

        const order = await orderModel.findById(orderId)
            .populate('restaurant', 'name bannerImage addressLine owner')
            .populate('user', 'firstName lastName contactNumber email')
            .lean();

        if(!order){
            return apiError(res, 404, "Order not found", "Not Found");
        }

        const isUser = req.user._id.equals(order.user._id);
        const isOwnerOfRestaurant = req.user._id.equals(order.restaurant.owner);

        if(!isUser && !isOwnerOfRestaurant){
            return apiError(res, 403, "Access denied", "Forbidden");
        }

        return apiResponse(res, 200, "Order fetched successfully", { order });

    } catch(error){
        console.error("Error occurred while fetching order by ID:", error);
        return apiError(res, 500, "Internal Server Error while fetching order by ID", error.message);
    }
};


// Get orders for a restaurant --> can be accessed by the restaurant owner only
const getRestaurantOrders = async (req, res) => {
    try{
        const restaurant = req.restaurant;
        const { page = 1, limit = 10, status } = req.query;

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const query = { restaurant: restaurant._id };
        if(status && ORDER_STATUSES.includes(status)){
            query.status = status;
        }

        const totalOrders = await orderModel.countDocuments(query);
        const orders = await orderModel.find(query)
            .populate('user', 'firstName lastName contactNumber email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber)
            .lean();

        return apiResponse(res, 200, "Restaurant orders fetched successfully", {
            orders,
            pagination: {
                totalOrders,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalOrders / limitNumber),
                itemsPerPage: limitNumber
            }
        });

    } catch(error){
        console.error("Error occurred while fetching restaurant orders:", error);
        return apiError(res, 500, "Internal Server Error while fetching restaurant orders", error.message);
    }
};


// Update order status --> can be accessed by the restaurant owner only
const updateOrderStatus = async (req, res) => {
    try{
        const { orderId } = req.params;
        const { status: nextStatus, cancellationReason } = req.body;

        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return apiError(res, 400, "Invalid order ID", "Bad Request");
        }

        const order = await orderModel.findById(orderId);
        if(!order){
            return apiError(res, 404, "Order not found", "Not Found");
        }

        // order of different restaurant, not allowed to update
        if(req.restaurant._id.toString() !== order.restaurant.toString()){
            return apiError(res, 403, "Access denied", "Forbidden");
        }

        const allowedNextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
        if(!allowedNextStatuses.includes(nextStatus)){
            return apiError(res, 400, "Invalid status transition", `Cannot change status from ${order.status} to ${nextStatus}`);
        }

        if(nextStatus === 'cancelled' && !cancellationReason){
            return apiError(res, 400, "Cancellation reason required", "Bad Request");
        }

        if(nextStatus === 'ready_for_pickup'){
            const restaurant = req.restaurant;
            const driver = await claimNearestAvailableDriver(restaurant.location.coordinates);

            if(!driver){
                return apiError(res, 503, "No available drivers nearby right now", "Service Unavailable");
            }

            order.deliveryPartner = driver._id;
        }

        order.status = nextStatus;
        order.statusHistory.push({ status: nextStatus });
        if(nextStatus === 'cancelled'){
            order.cancelledReason = cancellationReason;
        }

        await order.save();

        return apiResponse(res, 200, `Order status updated to ${nextStatus} successfully`, { order });
    } catch(error){
        console.error("Error occurred while updating order status:", error);
        return apiError(res, 500, "Internal Server Error while updating order status", error.message);
    }
};


// Cancel order --> user can only access while restaurant hasn't confirmed yet
// if restaurant has confirmed, user cannot cancel, only restaurant can cancel via updateOrderStatus
const cancelOrderByUser = async (req, res) => {
    try{
        const userId = req.user._id;
        const { orderId } = req.params;
        const { cancelledReason } = req.body;

        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return apiError(res, 400, "Invalid order ID", "Bad Request");
        }

        const order = await orderModel.findOne({ _id: orderId, user: userId });
        if(!order){
            return apiError(res, 404, "Order not found", "Not Found");
        }

        if(order.status !== 'placed'){
            return apiError(res, 400, `Order cannot be cancelled by you. Current status: ${order.status}.`, "Bad Request");
        }

        order.status = 'cancelled';
        order.statusHistory.push({ status: 'cancelled' });
        order.cancelledReason = cancelledReason || "Cancelled by customer";

        await order.save();

        return apiResponse(res, 200, "Order cancelled successfully", { order });
    } catch(error){
        console.error("Error occurred while cancelling order by user:", error);
        return apiError(res, 500, "Internal Server Error while cancelling order", error.message);
    }
};



module.exports = {
    placeOrder,
    getUserOrders,
    getOrderById,
    getRestaurantOrders,
    updateOrderStatus,
    cancelOrderByUser
};