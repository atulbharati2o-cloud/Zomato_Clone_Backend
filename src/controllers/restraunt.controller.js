const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const restaurantModel = require('../models/restaurant.model.js');
const userModel = require('../models/user.model.js');
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');


// =================== OWNER SPECIFIC CONTROLLERS ===================
const createRestaurant = async (req, res) => {
    try{
        if(req.user.role !== 'owner'){
            return apiError(res, 403, "Access denied. Only owners can create restaurants", "Forbidden");
        }

        const ownerId = req.user._id;
        const { name, description, addressLine, coordinates } = req.body;

        const restaurantExists = await restaurantModel.findOne({ name, owner: ownerId, addressLine });
        if(restaurantExists){
            return apiError(res, 400, "Restaurant already exists with the same name and address", "Bad Request");
        }

        const newRestaurant = await restaurantModel.create({
            name,
            description,
            addressLine,
            owner: ownerId,
            location: {
                type: 'Point',
                coordinates
            },
            menu: [],
            ratedBy: []
        });

        return apiResponse(res, 201, "New restaurant onboarded successfully", { restaurant: newRestaurant });

    } catch(error){
        console.error("Error creating restaurant:", error);
        return apiError(res, 500, "Error creating restaurant", error.message);
    }
};

const getOwnerRestaurants = async (req, res) => {
    try{
        if(req.user.role !== 'owner'){
            return apiError(res, 403, "Access denied. Only owners can view their restaurants", "Forbidden");
        }

        const ownerId = req.user._id;
        const restaurants = await restaurantModel.find({ owner: ownerId }).select('-menu -ratedBy');

        return apiResponse(res, 200, "Owner's restaurants fetched successfully", { count: restaurants.length, restaurants });

    } catch(error){
        console.error("Error fetching owner's restaurants:", error);
        return apiError(res, 500, "Error fetching owner's restaurants", error.message);
    }
};

const uploadBannerImage = async (req, res) => {
    try{
        if(req.user.role !== 'owner'){
            return apiError(res, 403, "Access denied. Only owners can upload banner images", "Forbidden");
        }

        const { restaurantId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const restaurant = await restaurantModel.findOne({ _id: restaurantId, owner: req.user._id });
        if(!restaurant){
            return apiError(res, 404, "Restaurant not found or you are not the owner", "Not Found");
        }

        if(!req.file){
            return apiError(res, 400, "No banner image file uploaded", "Bad Request");
        }

        if(restaurant.bannerImage && restaurant.bannerImage !== ""){
            const oldBannerPath = path.join(process.cwd(), 'src', 'public', restaurant.bannerImage);
            try{
                await fs.access(oldBannerPath);
                await fs.unlink(oldBannerPath);
            } catch(unlinkError){
                console.error("Error deleting old banner image:", unlinkError.message);
            }
        }

        restaurant.bannerImage = `images/uploads/${req.file.filename}`;

        try{
            await restaurant.save();
        } catch(saveError){
            await fs.unlink(req.file.path).catch((err) => {});
            throw saveError;
        }

        return apiResponse(res, 200, "Banner image uploaded successfully", { restaurant });
        
    } catch(error){
        console.error("Error uploading banner image:", error);
        if(req.file){
            await fs.unlink(req.file.path).catch((err) => {
                console.error("Error deleting uploaded banner image after failure:", err);
            });
        }
        return apiError(res, 500, "Error uploading banner image", error.message);
    }
};

const getBannerImage = async (req, res) => {
    try{
        const { restaurantId } = req.params;
        const restaurant = await restaurantModel.findById(restaurantId);
        if(!restaurant || !restaurant.bannerImage){
            return apiError(res, 404, "Banner image not found", "Not Found");
        }

        const absoluteBannerPath = path.join(process.cwd(), 'src', 'public', restaurant.bannerImage);
        return res.sendFile(absoluteBannerPath);
    } catch(error){
        console.error("Error fetching banner image:", error);
        return apiError(res, 500, "Error fetching banner image", error.message);
    }
};

const deleteBannerImage = async (req, res) => {
    try{
        if(req.user.role !== 'owner'){
            return apiError(res, 403, "Access denied. Only owners can delete banner images", "Forbidden");
        }

        const { restaurantId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const restaurant = await restaurantModel.findOne({ _id: restaurantId, owner: req.user._id });
        if(!restaurant || !restaurant.bannerImage){
            return apiError(res, 404, "Banner image not found or you are not the owner", "Not Found");
        }

        const bannerImagePath = path.join(process.cwd(), 'src', 'public', restaurant.bannerImage);
        try{
            await fs.access(bannerImagePath);
            await fs.unlink(bannerImagePath);
        } catch(unlinkError){
            console.error("Error deleting banner image:", unlinkError.message);
        }

        restaurant.bannerImage = "";
        await restaurant.save();
        return apiResponse(res, 200, "Banner image deleted successfully");
    } catch(error){
        console.error("Error deleting banner image:", error);
        return apiError(res, 500, "Error deleting banner image", error.message);
    }
};

const toggleRestaurantStatus = async (req, res) => {
    try{
        if(req.user.role !== 'owner'){
            return apiError(res, 403, "Access denied. Only owners can toggle restaurant status", "Forbidden");
        }

        const { restaurantId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const restaurant = await restaurantModel.findOne({ _id: restaurantId, owner: req.user._id });
        if(!restaurant){
            return apiError(res, 404, "Restaurant not found or you are not the owner", "Not Found");
        }

        restaurant.isOpen = !restaurant.isOpen;
        await restaurant.save();
        return apiResponse(res, 200, `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`, { isOpen: restaurant.isOpen });
    } catch(error){
        console.error("Error toggling restaurant status:", error);
        return apiError(res, 500, "Error toggling restaurant status", error.message);
    }
};

