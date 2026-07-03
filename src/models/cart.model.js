const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1,
        max: 20
    }
}, { _id: false }); 
// _id: false because we don't want items id as the item id is already in restaurant.menu[]

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    items: {
        type: [ cartItemSchema ],
        default: []
    },
    totalPrice: {
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps: true });


cartSchema.methods.recalculateTotalPrice = function(restaurant){
    const menuById = new Map(restaurant.menu.map(item => [item._id.toString(), item]));

    this.totalPrice = this.items.reduce( (sum, cartItem) => {
        const menuItem = menuById.get(cartItem.menuItem.toString());
        if(!menuItem || !menuItem.isAvailable) return sum; // Skip unavailable items
        return sum + (menuItem.price * cartItem.quantity);
    }, 0);

    return this.totalPrice;
}

// Ensure one cart per restaurant for a user
cartSchema.index({ user: 1, restaurant: 1 }, { unique: true }); 


const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;