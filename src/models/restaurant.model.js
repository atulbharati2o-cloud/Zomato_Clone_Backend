const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    images: {
        type: [{
            url: {
                type: String,
                required: true
            },
            publicId: {
                type: String,
                required: true
            }
        }],
        default: []
    },
    isVeg: {
        type: Boolean,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },

    // starters, maincourse, desserts, beverages
    category: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    }
}, { timestamps: true });


const restaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    bannerImage: {
        url: {
            type: String,
            default: ""
        },
        publicId: {
            type: String,
            default: null
        }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pureVeg: {
        type: Boolean,
        default: false
    },
    
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    addressLine: {
        type: String,
        required: true,
        trim: true
    },
    menu: [menuItemSchema],
    isOpen: {
        type: Boolean,
        default: true
    },
    ratedBy: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            rating: {
                type: Number,
                required: true,
                min: 1,
                max: 5
            }
        }
    ],
    avgRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalRatings: {
        type: Number,
        default: 0,
        min: 0  
    }
}, { timestamps: true });

// Geospatial index for proximity searches
restaurantSchema.index({ location: '2dsphere' });

// Home feed index
restaurantSchema.index({
    isOpen: -1,
    totalRatings: -1,
    avgRating: -1
}, {
    name: "zomato_home_feed_index"
});



const Restaurant = mongoose.model('Restaurant', restaurantSchema);
module.exports = Restaurant;