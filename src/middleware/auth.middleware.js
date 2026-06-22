const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const User = require('../models/user.model.js');
const jwt = require('jsonwebtoken');

const isLoggedIn = async (req, res, next) => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return apiError(res, 401, "Unauthorized: No token provided", "Unauthorized: No token provided");
        }

        const token = authHeader.split(" ")[1];
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decodedData.id).select("-password");
        if(!user){
            return apiError(res, 401, "Unauthorized: User not found", "Unauthorized: User not found");
        }

        req.user = user;
        next();

    } catch(error){
        console.error('Error in isLoggedIn middleware:', error);
        return apiError(res, 500, 'An error occurred while checking authentication.', 'Internal Server Error');
    }
};

const isdriver = (req, res, next) => {
    try{
        if(req.user?.role !== "driver"){
            return apiError(res, 403, "Forbidden: Drivers only", "Forbidden: Drivers only");
        }
        next();
    } catch(error){
        console.error('Error in isdriver middleware:', error);
        return apiError(res, 500, 'An error occurred while checking driver authentication.', 'Internal Server Error');
    }
};



module.exports = {
    isLoggedIn,
    isdriver
};