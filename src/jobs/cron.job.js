const cron = require('node-cron');
const userModel = require('../models/user.model.js');
const orderModel = require('../models/order.model.js');
const cartModel = require('../models/cart.model.js');
const claimNearestAvailableDriver = require('../services/driverAssignment.service.js');

const initCronJobs = () => {
    
    // Every 5 minutes:  Cancel orders that have payment pending for more than 10 minutes
    cron.schedule('*/5 * * * *', async () => {
        try{
            const result = await orderModel.updateMany(
                {
                    paymentMethod: "online",
                    paymentStatus: "pending",
                    status: "placed",
                    createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } // older than 10 minutes
                },
                {
                    $set: {
                        status: "cancelled",
                        cancelledReason: "Payment timeout"
                    },
                    $push: {
                        statusHistory: { status: "cancelled" }
                    }
                }
            );

            if(result.modifiedCount > 0){
                console.log(`Cancelled ${result.modifiedCount} orders due to payment timeout.`);
            }
        } catch(error){
            console.error("Cron job error while auto-cancelling orders:", error.message);
        }
    });


    // Every 1 minute retry driver allocation for orders ready for pickup
    cron.schedule('*/1 * * * *', async () => {
        try{
            const unassignedOrders = await orderModel.find({
                status: "ready_for_pickup",
                deliveryPartner: null
            }).populate('restaurant');

            for(const order of unassignedOrders){
                const driver = await claimNearestAvailableDriver(order.restaurant.location.coordinates);
                if(driver){
                    try{
                        order.deliveryPartner = driver._id;
                        order.status = "out_for_delivery";
                        order.statusHistory.push({ status: "out_for_delivery" });
                        await order.save();
                        console.log(`Assigned driver ${driver._id} to order ${order._id}`);
                    } catch(saveError){
                        console.error(`Failed to assign driver ${driver._id} to order ${order._id}:`, saveError.message);
                        await userModel.findByIdAndUpdate(driver._id, { $set: { isAvailable: true } }); // Mark driver as available again
                    }
                }
            }
        } catch(error){
            console.error("Cron job error while retrying driver allocation:", error.message);
        }
    });


    // Everyday at midnight(00:00): Clear carts that have been inactive for more than 24 hours
    cron.schedule('0 0 * * *', async () => {
        try{
            const result = await cartModel.deleteMany({
                updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // older than 24 hours
            });

            if(result.deletedCount > 0){
                console.log(`Cleared ${result.deletedCount} inactive carts.`);
            }
        } catch(error){
            console.error("Cron job error while clearing inactive carts:", error.message);
        }
    });

    console.log("Cron jobs initialized.");
};


module.exports = initCronJobs;