const router = require("express").Router();
const dc = require("../controllers/discovery.controller.js");
const { isLoggedIn } = require("../middlewares/auth.middleware.js");



// get zomato search feed
router.get("/search", isLoggedIn, dc.getZomatoSearchFeed);


module.exports = router;