const router = require('express').Router();
const cc = require('../controllers/cart.controller.js');
const { isLoggedIn, isOwner, isDriver } = require('../middlewares/auth.middleware.js');
const val = require('../validations/cart.validation.js');
const validate = require('../middlewares/validation.middleware.js');


// Add an item to the cart
router.post('/add', isLoggedIn, validate(val.addItemToCartSchema), cc.addItemToCart);

// Get all carts
router.get('/all', isLoggedIn, cc.getAllCarts);

// Get cart of a restaurant
router.get('/restaurant/:restaurantId', isLoggedIn, cc.getCartByRestaurant);

// Update item quantity in the cart
router.patch('/:cartId/item', isLoggedIn, validate(val.updateCartItemQuantitySchema), cc.updateCartItemQuantity);

// Remove an item from the cart
router.delete('/:cartId/item/:menuItemId', isLoggedIn, cc.removeItemFromCart);

// Clear the entire cart
router.delete('/:cartId', isLoggedIn, cc.clearCart);



module.exports = router;