const router = require("express").Router();
const { isLoggedIn, isOwner, isDriver } = require("../middlewares/auth.middleware.js");
const val = require("../validations/order.validation.js");
const oc = require("../controllers/order.controller.js");
const validate = require("../middlewares/validation.middleware.js");


//============= Customer Routes =============

// Place a new order
router.post("/", isLoggedIn, validate(val.placeOrderSchema), oc.placeOrder);

// Get all your orders
router.get("/my-orders", isLoggedIn, oc.getUserOrders);

// Get a specific order by ID
router.get("/:orderId", isLoggedIn, oc.getOrderById);

// cancel order before confirmation
router.patch('/:orderId/cancel', isLoggedIn, oc.cancelOrderByUser);




//============= Restaurant Owner Routes =============
// get all orders of your restaurant
router.get("/restaurant/:restaurantId", isLoggedIn, isOwner, oc.getRestaurantOrders);

// update order status
router.patch("/restaurant/:restaurantId/:orderId/status", isLoggedIn, isOwner, validate(val.updateOrderStatusSchema), oc.updateOrderStatus);




module.exports = router;