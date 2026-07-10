const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const orderModel = require('../models/order.model.js');
const userModel = require('../models/user.model.js');
const mongoose = require('mongoose');
const { ORDER_STATUSES } = require('../utils/constants.js');


// Called periodically by driver's device to keep currentLocation fresh
const updateDriverLocation = async (req, res) => {
    try{
        const driverId = req.user._id;
        const { coordinates } = req.body;

        const driver = await userModel.findByIdAndUpdate(
            driverId,
            {
                currentLocation: {
                    type: 'Point',
                    coordinates: coordinates
                }
            },
            {
                returnDocument: 'after'
            }
        )
        
        return apiResponse(res, 200, "Driver location updated successfully", { currentLocation: driver.currentLocation });

    } catch(error){
        console.error("Error updating driver location:", error);
        return apiError(res, 500, "Error updating driver location", error.message);    
    }
};


// Toggle the driver's availability status
const toggleDriverAvailability = async (req, res) => {
    try{
        const driverId = req.user._id;
        const { isAvailable } = req.body;

        const driver = await userModel.findByIdAndUpdate(
            driverId,
            { isAvailable },
            { returnDocument: 'after' }
        );

        return apiResponse(res, 200, "Driver availability status updated successfully", { isAvailable: driver.isAvailable });
    } catch(error){
        console.error("Error updating driver availability:", error);
        return apiError(res, 500, "Error updating driver availability", error.message);
    }
};


// Get orders that the driver has delivered or is currently delivering
const getDriverOrders = async (req, res) => {
    try{
        const driverId = req.user._id;
        const { page = 1, limit = 10, status } = req.query;

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const query = { deliveryPartner: driverId };
        if (status && ORDER_STATUSES.includes(status)) {
            query.status = status;
        }

        const totalOrders = await orderModel.countDocuments(query);
        const orders = await orderModel.find(query)
            .populate('restaurant', 'name bannerImage addressLine location')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber)
            .lean();

        return apiResponse(res, 200, "Driver orders fetched successfully", {
            orders,
            pagination: {
                totalOrders,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalOrders / limitNumber),
                itemsPerPage: limitNumber
            }
        });

    } catch(error){
        console.error("Error fetching driver orders:", error);
        return apiError(res, 500, "Error fetching driver orders", error.message);
    }
};


const markOrderPickUp = async (req, res) => {
    try{
        const driverId = req.user._id;
        const { orderId } = req.params;

        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return apiError(res, 400, "Invalid order ID");
        }

        const order = await orderModel.findOne({ _id: orderId, deliveryPartner: driverId });
        if(!order){
            return apiError(res, 404, "Order not found or not assigned to this driver");
        }

        if(order.status !== 'ready_for_pickup'){
            return apiError(res, 400, `Cannot confirm pickup for order with status: ${order.status}`, "Bad Request");
        }

        order.status = 'out_for_delivery';
        order.statusHistory.push({ status: 'out_for_delivery' });
        await order.save();

        return apiResponse(res, 200, "Order pickup confirmed, order is now out for delivery", { order });
    } catch(error){
        console.error("Error confirming pickup: ", error);
        return apiError(res, 500, "Error confirming pickup", error.message);
    }
};


const markOrderDelivered = async (req, res) => {
    try{
        const driverId = req.user._id;
        const { orderId } = req.params;

        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return apiError(res, 400, "Invalid order ID");
        }

        const order = await orderModel.findOne({ _id: orderId, deliveryPartner: driverId });
        if(!order){
            return apiError(res, 404, "Order not found or not assigned to you");
        }

        if(order.status !== 'out_for_delivery'){
            return apiError(res, 400, `Cannot mark order as delivered with status: ${order.status}`, "Bad Request");
        }

        order.status = 'delivered';
        order.statusHistory.push({ status: 'delivered' });

        if(order.paymentMethod === 'cod'){
            order.paymentStatus = 'paid';
        }
        
        await order.save();

        // Driver now becomes available
        await userModel.findByIdAndUpdate(driverId, { isAvailable: true });
        return apiResponse(res, 200, "Order marked as delivered", { order });
    } catch(error){
        console.error("Error marking order as delivered: ", error);
        return apiError(res, 500, "Error marking order as delivered", error.message);
    }
};



module.exports = {
    updateDriverLocation,
    toggleDriverAvailability,
    getDriverOrders,
    markOrderPickUp,
    markOrderDelivered
};
