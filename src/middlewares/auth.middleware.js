const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const userModel = require('../models/user.model.js');
const restaurantModel = require('../models/restaurant.model.js');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const cleanupUploadedFiles = require('../utils/cleanupUploadedFiles.js');

const isLoggedIn = async (req, res, next) => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return apiError(res, 401, "Unauthorized: No token provided", "Unauthorized: No token provided");
        }

        const token = authHeader.split(" ")[1];
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await userModel.findById(decodedData.id).select("-password");
        if(!user){
            return apiError(res, 401, "Unauthorized: User not found", "Unauthorized: User not found");
        }

        req.user = user;
        next();

    } catch(error){
        console.error('Error in isLoggedIn middleware:', error);
        return apiError(res, 500, 'An error occurred while checking authentication.', error.message || 'Internal Server Error');
    }
};

const isDriver = async (req, res, next) => {
    try{
        if(req.user?.role !== "driver"){
            return apiError(res, 403, "Forbidden: Drivers only", "Forbidden: Drivers only");
        }
        next();
    } catch(error){
        console.error('Error in isDriver middleware:', error);
        return apiError(res, 500, 'An error occurred while checking driver authentication.', error.message || 'Internal Server Error');
    }
};

const isOwner = async (req, res, next) => {
    try{

        // role check
        if(!req.user || req.user.role !== "owner"){
            await cleanupUploadedFiles(req);
            return apiError(res, 403, "Forbidden: Owners only", "Forbidden: Owners only");
        }

        //if restaurantId is present in params, check if the owner owns the restaurant
        const { restaurantId } = req.params;
        if(restaurantId){
            if(!mongoose.Types.ObjectId.isValid(restaurantId)){
                await cleanupUploadedFiles(req);
                return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
            }

            const restaurant = await restaurantModel.findOne({ _id: restaurantId, owner: req.user._id });
            if(!restaurant){
                await cleanupUploadedFiles(req);
                return apiError(res, 403, "Forbidden: You do not own this restaurant", "Forbidden: You do not own this restaurant");
            }

            req.restaurant = restaurant; // Attaching the restaurant to req
        }

        return next();
    } catch(error){
        console.error('Error in isOwner middleware:', error);
        await cleanupUploadedFiles(req);
        return apiError(res, 500, 'An error occurred while checking owner authentication.', error.message || 'Internal Server Error');
    }
};

module.exports = {
    isLoggedIn,
    isDriver,
    isOwner
};