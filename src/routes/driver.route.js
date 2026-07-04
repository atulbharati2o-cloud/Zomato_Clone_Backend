const router = require('express').Router();
const dc = require('../controllers/driver.controller.js');
const { isLoggedIn, isDriver } = require('../middlewares/auth.middleware.js');
const val = require('../validations/driver.validation.js');
const validate = require('../middlewares/validation.middleware.js');

// All routes need the user to be logged in as driver
router.use(isLoggedIn, isDriver);



// Update driver's current location
router.post('/location', validate(val.updateDriverLocationSchema), dc.updateDriverLocation);

// Toggle driver's availability status
router.post('/availability', validate(val.toggleDriverAvailabilitySchema), dc.toggleDriverAvailability);

// Get orders that the driver has delivered or is currently delivering
router.get('/orders', dc.getDriverOrders);

// Mark order as picked up
router.post('/orders/:orderId/pickup', dc.markOrderPickUp);

// Mark order as delivered
router.post('/orders/:orderId/deliver', dc.markOrderDelivered);



module.exports = router;