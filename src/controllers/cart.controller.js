const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const cartModel = require('../models/cart.model.js');
const restaurantModel = require('../models/restaurant.model.js');
const mongoose = require('mongoose');



const enrichCartWithLiveMenuData = (cart, restaurant) => {
    const menuById = new Map(restaurant.menu.map(item => [item._id.toString(), item]));

    let hasUnavailableItems = false;
    let totalPrice = 0;


    const enrichedItems = cart.items.map(cartItem => {
        const menuItem = menuById.get(cartItem.menuItem.toString());
        if(!menuItem){
            hasUnavailableItems = true;
            return {
                menuItemId: cartItem.menuItem,
                quantity: cartItem.quantity,
                name: null,
                price: null,
                isAvailable: false,
                removed: true,
                itemTotal: 0
            };
        }

        if(!menuItem.isAvailable){
            hasUnavailableItems = true;
        }

        const itemTotal = menuItem.isAvailable ? menuItem.price * cartItem.quantity : 0;
        totalPrice += itemTotal;

        return {
            menuItemId: cartItem.menuItem,
            quantity: cartItem.quantity,
            name: menuItem.name,
            price: menuItem.price, // single item price
            isVeg: menuItem.isVeg,
            isAvailable: menuItem.isAvailable,
            removed: false,
            itemTotal // total price for this item (price * quantity)
        };
    });

    return {
        _id: cart._id,
        restaurant: {
            _id: restaurant._id,
            name: restaurant.name,
            bannerImage: restaurant.bannerImage,
            isOpen: restaurant.isOpen
        },
        items: enrichedItems,
        totalPrice,
        hasUnavailableItems,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt
    }
};


const addItemToCart = async (req, res) => {
    try{
        const userId = req.user._id;
        const { restaurantId, menuItemId, quantity } = req.body;

        const restaurant = await restaurantModel.findById(restaurantId);
        if(!restaurant){
            return apiError(res, 404, "Restaurant profile not found", "Not Found");
        }

        if(!restaurant.isOpen){
            return apiError(res, 400, "Restaurant is currently closed", "Bad Request");
        }

        const menuItem = restaurant.menu.id(menuItemId);
        if(!menuItem){
            return apiError(res, 404, "Menu item not found.", "Not Found");
        }
        if(!menuItem.isAvailable){
            return apiError(res, 400, "Menu item is currently unavailable.", "Bad Request");
        }

        let cart = await cartModel.findOne({ user: userId, restaurant: restaurantId });
        if(!cart){
            // if cart doesn't exist, create a new one
            cart = await cartModel.create({
                user: userId,
                restaurant: restaurantId,
                items: [{ menuItem: menuItemId, quantity }]
            });

            cart.recalculateTotalPrice(restaurant);
            await cart.save();

        } else{
            // if cart already exists, increment quantity if item present else push item to cart
            const existingItemIndex = cart.items.findIndex(item => item.menuItem.toString() === menuItemId);

            if(existingItemIndex !== -1){
                cart.items[existingItemIndex].quantity += quantity;
            } else{
                cart.items.push({ menuItem: menuItemId, quantity });
            }
            
            cart.recalculateTotalPrice(restaurant);
            await cart.save();
        }

        const enrichedCart = enrichCartWithLiveMenuData(cart, restaurant);
        return apiResponse(res, 200, "Item added to cart successfully", { cart: enrichedCart });

    } catch(error){
        console.error("Error in addItemToCart:", error);
        return apiError(res, 500, "Internal Server Error while adding item to cart", error.message);
    }
};


const updateCartItemQuantity = async (req, res) => {
    try{
        const userId = req.user._id;
        const { cartId } = req.params;
        const { menuItemId, quantity } = req.body;

        if(!mongoose.Types.ObjectId.isValid(cartId) ){
            return apiError(res, 400, "Invalid cartId", "Bad Request");
        }
        const cart = await cartModel.findOne({ _id: cartId, user: userId });
        if(!cart){
            return apiError(res, 404, "Cart not found", "Not Found");
        }

        const restaurant = await restaurantModel.findById(cart.restaurant);
        if(!restaurant){
            return apiError(res, 404, "Associated restaurant not found", "Not Found");
        }

        const itemIndex = cart.items.findIndex(item => item.menuItem.toString() === menuItemId);
        if(itemIndex === -1){
            return apiError(res, 404, "Item not found in cart", "Not Found");
        }

        const menuItem = restaurant.menu.id(menuItemId);
        if(!menuItem || !menuItem.isAvailable){
            return apiError(res, 400, "This item is no longer available.", "Bad Request");
        }

        cart.items[itemIndex].quantity = quantity;
        cart.recalculateTotalPrice(restaurant);
        await cart.save();

        const enrichedCart = enrichCartWithLiveMenuData(cart, restaurant);
        return apiResponse(res, 200, "Cart item quantity updated successfully", { cart: enrichedCart });

    } catch(error){
        console.error("Error in updateCartItemQuantity:", error);
        return apiError(res, 500, "Internal Server Error while updating cart item quantity", error.message);
    }
};


const removeItemFromCart = async (req, res) => {
    try{
        const userId = req.user._id;
        const { cartId, menuItemId } = req.params;

        if(!mongoose.Types.ObjectId.isValid(cartId) || !mongoose.Types.ObjectId.isValid(menuItemId)){
            return apiError(res, 400, "Invalid cartId or menuItemId", "Bad Request");
        }

        const cart = await cartModel.findOne({ _id: cartId, user: userId });
        if(!cart){
            return apiError(res, 404, "Cart not found", "Not Found");
        }

        const restaurant = await restaurantModel.findById(cart.restaurant);
        if(!restaurant){
            return apiError(res, 404, "Associated restaurant not found", "Not Found");
        }

        const itemIndex = cart.items.findIndex(item => item.menuItem.toString() === menuItemId);
        if(itemIndex === -1){
            return apiError(res, 404, "Item not found in cart", "Not Found");
        }

        // Remove the item from the cart
        cart.items.splice(itemIndex, 1);
        
        if(cart.items.length === 0){
            await cartModel.findByIdAndDelete(cartId);
            return apiResponse(res, 200, "Item removed from cart and cart is empty now", { cart: null });
        }

        cart.recalculateTotalPrice(restaurant);
        await cart.save();

        const enrichedCart = enrichCartWithLiveMenuData(cart, restaurant);
        return apiResponse(res, 200, "Item removed from cart successfully", { cart: enrichedCart });

    } catch(error){
        console.error("Error in removeItemFromCart:", error);
        return apiError(res, 500, "Internal Server Error while removing item from cart", error.message);
    }
};


const clearCart = async (req, res) => {
    try{
        const userId = req.user._id;
        const { cartId } = req.params;

        if(!mongoose.Types.ObjectId.isValid(cartId)){
            return apiError(res, 400, "Invalid cartId", "Bad Request");
        }

        const deletedCart = await cartModel.findOneAndDelete({ _id: cartId, user: userId });
        if(!deletedCart){
            return apiError(res, 404, "Cart not found", "Not Found");
        }

        return apiResponse(res, 200, "Cart cleared successfully", { cart: null });
    } catch(error){
        console.error("Error in clearCart:", error);
        return apiError(res, 500, "Internal Server Error while clearing cart", error.message);
    }
};


const getCartByRestaurant = async (req, res) => {
    try{
        const userId = req.user._id;
        const { restaurantId } = req.params;

        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurantId", "Bad Request");
        }

        const restaurant = await restaurantModel.findById(restaurantId);
        if(!restaurant){
            return apiError(res, 404, "Associated restaurant not found", "Not Found");
        }

        const cart = await cartModel.findOne({ user: userId, restaurant: restaurantId });
        if(!cart){
            return apiResponse(res, 200, "No cart found for this restaurant", { cart: null });
        }

        const enrichedCart = enrichCartWithLiveMenuData(cart, restaurant);
        return apiResponse(res, 200, "Cart fetched successfully", { cart: enrichedCart });
    } catch(error){
        console.error("Error in getCartByRestaurant:", error);
        return apiError(res, 500, "Internal Server Error while fetching cart by restaurant", error.message);
    }
};


const getAllCarts = async (req, res) => {
    try{
        const userId = req.user._id;

        const carts = await cartModel.find({ user: userId }).lean();
        if(carts.length === 0){
            return apiResponse(res, 200, "No carts active", { carts: [] });
        }

        const restaurantIds = carts.map(cart => cart.restaurant);
        const restaurants = await restaurantModel.find({ _id: { $in: restaurantIds } }).lean();
        const restaurantById = new Map(restaurants.map(r => [r._id.toString(), r]));

        const enrichedCarts = carts
            .map(cart => {
                const restaurant = restaurantById.get(cart.restaurant.toString());
                if (!restaurant) return null; // restaurant deleted entirely — skip
                return enrichCartWithLiveMenuData(cart, restaurant);
            })
            .filter(Boolean);

        return apiResponse(res, 200, "Carts fetched successfully", {
            count: enrichedCarts.length,
            carts: enrichedCarts 
        });

    } catch(error){
        console.error("Error in getAllCarts:", error);
        return apiError(res, 500, "Internal Server Error while fetching all carts", error.message);
    }
};



module.exports = {
    addItemToCart,
    updateCartItemQuantity,
    removeItemFromCart,
    clearCart,
    getCartByRestaurant,
    getAllCarts
};