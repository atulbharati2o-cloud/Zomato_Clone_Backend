const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pointSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
    },
    coordinates: {
        type: [Number]
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    avatar: {
        url: {
            type: String,
            default: ""
        },
        publicId: {
            type: String,
            default: null
        }
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    contactNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    dob: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'owner', 'driver'],
        default: 'user'
    },
    savedAddresses: [{
        title: {
            type: String,
            default: 'Home',
            trim: true
        },
        addressLine: {
            type: String,
            required: true,
            trim: true
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
        }
    }],


    // Driver specific details
    vehicleDetails: {
        make: {
            type: String,
            trim: true
        },
        vehicleNumber: {
            type: String,
            trim: true,
            unique: true,
            sparse: true  // as this is undefined for non-driver users, we use sparse index to allow multiple null values
        },
        licenseNumber: {
            type: String,
            trim: true,
            unique: true,
            sparse: true  // as this is undefined for non-driver users, we use sparse index to allow multiple null values
        }
    },
    isAvailable: {
        type: Boolean,
        default: false
    },
    // Driver's live location
    currentLocation: {
        type: pointSchema,
        default: undefined
    }
}, { timestamps: true });


userSchema.index({ currentLocation: '2dsphere' });

userSchema.pre('save', async function(next) {
    if(this.isModified('password')){
        this.password = await bcrypt.hash(this.password, 10);
    }
});

userSchema.methods.isMatchPassword = async function(plainPassword) {
    return await bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.generateToken = function() {
    return jwt.sign({id: this._id}, process.env.JWT_SECRET, { expiresIn: '7d'});
};

const User = mongoose.model('User', userSchema);
module.exports = User;