const router = require("express").Router();
const rc = require("../controllers/restraunt.controller.js");


const { isLoggedIn, isOwner, isDriver } = require("../middlewares/auth.middleware.js");
const validate = require("../middlewares/validation.middleware.js");
const upload = require("../config/multer.js");
const val = require("../validations/restaurant.validation.js");


// create restaurant
router.post("/", isLoggedIn, isOwner, validate(val.createRestaurantSchema), rc.createRestaurant);

// get all restaurants of the owner
router.get("/owner", isLoggedIn, isOwner, rc.getOwnerRestaurants);

// update restaurant details
router.patch("/:restaurantId", isLoggedIn, isOwner, validate(val.updateRestaurantSchema), rc.updateRestaurantDetails);

// upload banner image
router.post("/:restaurantId/banner", isLoggedIn, isOwner, upload.single("bannerImage"), rc.uploadBannerImage);

// delete banner image
router.delete("/:restaurantId/banner", isLoggedIn, isOwner, rc.deleteBannerImage);

// toggle restaurant status
router.patch("/:restaurantId/status", isLoggedIn, isOwner, rc.toggleRestaurantStatus);

// add menu item
router.post("/:restaurantId/menu", isLoggedIn, isOwner, upload.array("images", 5), validate(val.addMenuItemSchema), rc.addMenuItem);

// update menu item
router.patch("/:restaurantId/menu/:menuItemId", isLoggedIn, isOwner, upload.array("images", 5), validate(val.updateMenuItemSchema), rc.updateMenuItem);

// delete menu item
router.delete("/:restaurantId/menu/:menuItemId", isLoggedIn, isOwner, rc.deleteMenuItem);

// toggle menu item availability
router.patch("/:restaurantId/menu/:menuItemId/availability", isLoggedIn, isOwner, rc.toggleItemAvailability);

// get restaurant details
router.get("/:restaurantId", rc.getRestaurantDetails);

// get menu items
router.get("/:restaurantId/menu", rc.getMenuItems);

// get banner image
router.get("/:restaurantId/banner", rc.getBannerImage);

// rate restaurant
router.post("/:restaurantId/rate", isLoggedIn, validate(val.rateRestaurantSchema), rc.rateRestaurant);

// rate menu item
router.post("/:restaurantId/menu/:menuItemId/rate", isLoggedIn, validate(val.rateMenuItemSchema), rc.rateMenuItem);



module.exports = router;