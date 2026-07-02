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
        type: [String],
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
    },

    // ratings
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
        type: String,
        default: ""
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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

// Global Text search index
restaurantSchema.index({
    name: 'text',
    description: "text",
    'menu.name': "text",
    'menu.description': "text"
}, {
    name: "zomato_global_text_search_index",
    weights: {
        name: 10,
        description: 5,
        'menu.name': 3,
        'menu.description': 2
    }
});

// Home feed index
restaurantSchema.index({
    isOpen: -1,
    totalRatings: -1,
    avgRating: -1
}, {
    name: "zomato_home_feed_index"
});

//


const Restaurant = mongoose.model('Restaurant', restaurantSchema);
module.exports = Restaurant;