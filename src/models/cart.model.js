const mongoose = require('mongoose');


const cartSchema = new mongoose.Schema({

});


const cartModel = mongoose.model('Cart', cartSchema);

module.exports = cartModel;