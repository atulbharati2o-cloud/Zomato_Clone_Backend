const router = require("express").Router();
const { isLoggedIn } = require("../middlewares/auth.middleware.js");
const val = require("../validations/payment.validation.js");
const pc = require("../controllers/payment.controller.js");
const validate = require("../middlewares/validate.middleware.js");


router.post("/initiate", express.json(), isLoggedIn, validate(val.initiatePaymentSchema), pc.initiatePayment);
router.post("/verify", express.json(), isLoggedIn, validate(val.verifyPaymentSchema), pc.verifyPayment);

// Webhook: called by Rzp server, not the user
// Needs raw body for signature verification, so we use express.raw() middleware here not express.json()
router.post("/webhook", express.raw({ type: 'application/json' }), pc.handleRazorpayWebhook);



module.exports = router;