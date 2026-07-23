const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const restaurantModel = require('../models/restaurant.model.js');
const userModel = require('../models/user.model.js');
const orderModel = require('../models/order.model.js');
const mongoose = require('mongoose');
const { deleteFromCloudinary, uploadBufferToCloudinary } = require('../services/cloudinary.service.js');
const { redis } = require('../config/redis.js');

// Helper to clear restaurant details and menu cache in Redis
const invalidateRestaurantCache = async (restaurantId) => {
    try{
        if(!restaurantId) return;
        const cacheKey = `restaurant:${restaurantId.toString()}`;
        await redis.del(cacheKey);
    } catch(error){
        console.error("Failed to clear Redis cache:", error);
    }
}


// =================== OWNER SPECIFIC CONTROLLERS ===================
const createRestaurant = async (req, res) => {
    try{
        const ownerId = req.user._id;
        const { name, description, pureVeg, addressLine, coordinates } = req.body;

        const restaurantExists = await restaurantModel.findOne({ name, owner: ownerId, addressLine });
        if(restaurantExists){
            return apiError(res, 400, "Restaurant already exists with the same name and address", "Bad Request");
        }

        const newRestaurant = await restaurantModel.create({
            name,
            description,
            pureVeg,
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
        const ownerId = req.user._id;
        const restaurants = await restaurantModel.find({ owner: ownerId }).select('-menu -ratedBy');

        return apiResponse(res, 200, "Owner's restaurants fetched successfully", { count: restaurants.length, restaurants });

    } catch(error){
        console.error("Error fetching owner's restaurants:", error);
        return apiError(res, 500, "Error fetching owner's restaurants", error.message);
    }
};


const updateRestaurantDetails = async (req, res) => {
    try{
        const ownerId = req.user._id;
        const restaurant = req.restaurant;

        const allowedFields = [ "name", "description", "pureVeg", "addressLine", "coordinates" ];
        for(const field of allowedFields){
            if(req.body[field] !== undefined){
                if(field === "coordinates"){
                    restaurant.location.coordinates = req.body.coordinates;
                } else {
                    restaurant[field] = req.body[field];
                }
            }
        }

        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, "Restaurant details updated successfully", { restaurant });
    } catch(error){
        console.error("Error updating restaurant details:", error);
        return apiError(res, 500, "Error updating restaurant details", error.message);
    }
}


const uploadBannerImage = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        if(!req.file){
            return apiError(res, 400, "No banner image file uploaded", "Bad Request");
        }

        if(restaurant.bannerImage.publicId){
            await deleteFromCloudinary(restaurant.bannerImage.publicId);
        }

        const { url, publicId } = await uploadBufferToCloudinary(req.file.buffer, 'zomato-clone/banners');
        restaurant.bannerImage = { url, publicId };
        await restaurant.save();
        
        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, "Banner image uploaded successfully", { restaurant });
        
    } catch(error){
        console.error("Error uploading banner image:", error);
        return apiError(res, 500, "Error uploading banner image", error.message);
    }
};


const deleteBannerImage = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        if(!restaurant.bannerImage.url){
            return apiError(res, 404, "No banner image", "Not Found");
        }

        if(restaurant.bannerImage.publicId){
            await deleteFromCloudinary(restaurant.bannerImage.publicId);
        }

        restaurant.bannerImage = {url: "", publicId: null };
        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, "Banner image deleted successfully");
    } catch(error){
        console.error("Error deleting banner image:", error);
        return apiError(res, 500, "Error deleting banner image", error.message);
    }
};


const toggleRestaurantStatus = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        restaurant.isOpen = !restaurant.isOpen;
        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`, { isOpen: restaurant.isOpen });
    } catch(error){
        console.error("Error toggling restaurant status:", error);
        return apiError(res, 500, "Error toggling restaurant status", error.message);
    }
};


const addMenuItem = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        let uploadedImages = [];
        if(req.files && req.files.length > 0){
            uploadedImages = await Promise.all(
                req.files.map(file => uploadBufferToCloudinary(file.buffer, 'zomato/menu-items'))
            );
        }

        const { name, description, price, isVeg, category } = req.body;

        const newMenuItem = {
            name,
            description,
            price,
            images: uploadedImages,
            isVeg: isVeg === 'true' || isVeg === true,
            category
        };

        restaurant.menu.push(newMenuItem);
        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 201, "Item added to menu successfully", { menuItem: newMenuItem });
    } catch(error){
        console.error("Error adding menu item:", error);
        return apiError(res, 500, "Error adding menu item", error.message);
    }
};


const updateMenuItem = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        const { menuItemId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(menuItemId)){
            return apiError(res, 400, "Invalid menu item ID", "Bad Request");
        }

        const menuItemIndex = restaurant.menu.findIndex(item => item._id.toString() === menuItemId);
        if(menuItemIndex === -1){
            return apiError(res, 404, "Menu item not found", "Not Found");
        }

        const allowedFields = [ "name", "description", "price", "isVeg", "category" ];
        for(const field of allowedFields){
            if(req.body[field] !== undefined){
                restaurant.menu[menuItemIndex][field] = req.body[field];
            }
        }

        if(req.files && req.files.length > 0){
            const maxImages = 5;
            if(restaurant.menu[menuItemIndex].images.length + req.files.length > maxImages){
                return apiError(res, 400, `You can upload a maximum of ${maxImages} images`, "Bad Request");
            }

            const uploadedImages = await Promise.all(
                req.files.map(file => uploadBufferToCloudinary(file.buffer, 'zomato-clone/menu-items'))
            );

            restaurant.menu[menuItemIndex].images.push(...uploadedImages);
        }

        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, "Menu item updated successfully", { menuItem: restaurant.menu[menuItemIndex] });

    } catch(error){
        console.error("Error updating menu item:", error);
        return apiError(res, 500, "Error updating menu item", error.message);
    }
}


const deleteMenuItem = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        const { menuItemId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(menuItemId)){
            return apiError(res, 400, "Invalid menu item ID", "Bad Request");
        }

        const menuItemIndex = restaurant.menu.findIndex(item => item._id.toString() === menuItemId);
        if(menuItemIndex === -1){
            return apiError(res, 404, "Menu item not found", "Not Found");
        }

        if(restaurant.menu[menuItemIndex].images && restaurant.menu[menuItemIndex].images.length > 0){
            await Promise.all(
                restaurant.menu[menuItemIndex].images.map(img => deleteFromCloudinary(img.publicId))
            );
        }

        restaurant.menu.splice(menuItemIndex, 1);
        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);
        
        return apiResponse(res, 200, "Menu item deleted successfully");
    } catch(error){
        console.error("Error deleting menu item:", error);
        return apiError(res, 500, "Error deleting menu item", error.message);
    }
};


const toggleItemAvailability = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        const { menuItemId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(menuItemId)){
            return apiError(res, 400, "Invalid menu item ID", "Bad Request");
        }
        
        const menuItemIndex = restaurant.menu.findIndex(item => item._id.toString() === menuItemId);
        if(menuItemIndex === -1){
            return apiError(res, 404, "Menu item not found", "Not Found");
        }

        restaurant.menu[menuItemIndex].isAvailable = !restaurant.menu[menuItemIndex].isAvailable;
        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, `Menu item is now ${restaurant.menu[menuItemIndex].isAvailable ? 'available' : 'unavailable'}`, { isAvailable: restaurant.menu[menuItemIndex].isAvailable });
    } catch(error){
        console.error("Error toggling item availability:", error);
        return apiError(res, 500, "Error toggling item availability", error.message);
    }
}



//=================== PUBLIC CONTROLLERS ===================

const getRestaurantDetails = async (req, res) => {
    try{
        const { restaurantId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const cacheKey = `restaurant:${restaurantId}`;
        const cachedData = await redis.get(cacheKey);

        if(cachedData){
            const restaurant = JSON.parse(cachedData);
            return apiResponse(res, 200, "Restaurant details fetched successfully (Cache HIT)", { restaurant });
        }

        const restaurant = await restaurantModel.findById(restaurantId).select('-ratedBy');
        if(!restaurant){
            return apiError(res, 404, "Restaurant profile not found", "Not Found");
        }

        // Store restaurant details in Redis cache for 15 minutes (900 seconds)
        await redis.setex(cacheKey, 900, JSON.stringify(restaurant)); 

        return apiResponse(res, 200, "Restaurant details fetched successfully", { restaurant });

    } catch(error){
        console.error("Error fetching restaurant details:", error);
        return apiError(res, 500, "Error fetching restaurant details", error.message);
    }
};


const getMenuItems = async (req, res) => {
    try{
        const { restaurantId } = req.params;
        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const { page = 1, limit = 10, searchContext } = req.query;
        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        let fullMenu = [];

        const cacheKey = `restaurant:${restaurantId}`;
        const cachedRestaurant = await redis.get(cacheKey);
        if(cachedRestaurant){
            const parsed = JSON.parse(cachedRestaurant);
            fullMenu = parsed.menu || [];
        } else {
            const restaurant = await restaurantModel.findById(restaurantId).select('-ratedBy');
            if(!restaurant){
                return apiError(res, 404, "Restaurant profile not found", "Not Found");
            }

            await redis.setex(cacheKey, 900, JSON.stringify(restaurant)); // Cache for 15 minutes
            fullMenu = restaurant.menu || [];
        }

        let organizedMenu = [];
        let pinnedCount = 0;

        if(searchContext && searchContext.trim() !== ""){
            const query = searchContext.trim().toLowerCase();

            // Split into tokens, remove common stopwords/noise words
            const stopWords = new Set(["the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "a", "an"]);

            // suppose search query is "Spicy Chicken Wings", then tokens will be ["spicy", "chicken", "wings"]
            const tokens = query
                .split(/\s+/)
                .filter(Boolean)
                .filter(token => !stopWords.has(token));

            
            const scoreItem = (item) => {
                const name = item.name.trim().toLowerCase();
                const description = (item.description || "").trim().toLowerCase();
                const category = item.category.trim().toLowerCase();

                let score = 0;

                // Full query match
                if(name.includes(query)) score += 100;
                else if(description.includes(query)) score += 40;
                else if(category.includes(query)) score += 30;

                let nameTokenHits = 0;
                // more tokens match --> more score. Name matches are more valuable than description or category matches.
                for(const token of tokens){
                    if(name.includes(token)){
                        score += 20;
                        nameTokenHits++; 
                    } else if(description.includes(token)){
                        score += 10;
                    } else if(category.includes(token)){
                        score += 5;
                    }
                }

                if(tokens.length > 0 && nameTokenHits === tokens.length){
                    score += 30; // Bonus for all tokens in name
                }

                return score;
            }


            const scoredMenu = fullMenu.map(item => ({
                item,
                score: scoreItem(item)
            }));

            const matchedItems = scoredMenu.filter(entry => entry.score > 0);
            const unmatchedItems = scoredMenu.filter(entry => entry.score === 0);

            matchedItems.sort( (a, b) => {
                if(b.score !== a.score) return b.score - a.score; // Higher score first
                return a.item.name.localeCompare(b.item.name); // Alphabetical order if scores are equal
            });


            pinnedCount = matchedItems.length;
            organizedMenu = [ ...matchedItems.map(entry => entry.item), ...unmatchedItems.map(entry => entry.item) ];

        } else{
            organizedMenu = fullMenu;
        }


        const totalItems = organizedMenu.length;
        const paginatedMenu = organizedMenu.slice(skip, skip + limitNumber);
        const totalPages = Math.ceil(totalItems / limitNumber);

        return apiResponse(res, 200, "Menu items fetched successfully", {
            hasPinnedItems: pinnedCount > 0,
            pinnedCount,
            menu: paginatedMenu,
            pagination: {
                totalItems,
                currentPage: pageNumber,
                totalPages,
                itemsPerPage: limitNumber
            }
        });

    } catch(error){
        console.error("Error fetching menu items:", error);
        return apiError(res, 500, "Error fetching menu items", error.message);
    }
};





// ============== Rating And Review Controllers ==============

const rateRestaurant = async (req, res) => {
    try{
        const { restaurantId } = req.params;
        const { rating } = req.body;
        const userId = req.user._id;

        if(!mongoose.Types.ObjectId.isValid(restaurantId)){
            return apiError(res, 400, "Invalid restaurant ID", "Bad Request");
        }

        const restaurant = await restaurantModel.findById(restaurantId);
        if(!restaurant){
            return apiError(res, 404, "Restaurant profile not found", "Not Found");
        }

        // To prevent rating from users who haven't ordered from the restaurant
        const hasDeliveredOrder = await orderModel.exists({
            user: userId,
            restaurant: restaurantId,
            status: 'delivered'
        });

        if(!hasDeliveredOrder){
            return apiError(res, 403, "You cannot rate a restaurant you haven't ordered from", "Forbidden");
        }

        const existingRatingIndex = restaurant.ratedBy.findIndex(entry => entry.userId.toString() === userId.toString());
        if(existingRatingIndex !== -1){
            restaurant.ratedBy[existingRatingIndex].rating = rating;
        } else {
            restaurant.ratedBy.push({ userId, rating });
        }

        const totalRatings = restaurant.ratedBy.length;
        
        const sumRatings = restaurant.ratedBy.reduce( (sum, entry) => sum + entry.rating, 0);
        const avgRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

        restaurant.avgRating = avgRating;
        restaurant.totalRatings = totalRatings;

        await restaurant.save();

        await invalidateRestaurantCache(restaurant._id);

        return apiResponse(res, 200, "Restaurant rated successfully", { yourRating: rating  , avgRating: restaurant.avgRating, totalRatings: restaurant.totalRatings });
    } catch(error){
        console.error("Error rating restaurant:", error);
        return apiError(res, 500, "Error rating restaurant", error.message);
    }
};





// =================== Zomato Home Feed Controller ===================
const getNearbyRestaurantsFeed = async (req, res) => {
    try{
        const { lng, lat, radius = 5000, page = 1, limit = 10 } = req.query;

        if(!lng || !lat){
            return apiError(res, 400, "Longitude and latitude are required for home feed", "Bad Request");
        }

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        // nearSphere query finds the nearby restaurants and sorts according to distance
        const findQueryCondition = {
            isOpen: true,
            location: {
                $nearSphere: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        }

        // geoWithin query finds the nearby restaurants but does not sort according to distance
        const countQueryCondition = {
            isOpen: true,
            location: {
                $geoWithin: {
                    $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseInt(radius) / 6378137]
                }
            }
        }

        // we cannot use findQueryCondition as it has nearSphere that does sorting and we want to count all nearby restaurants without sorting, so we use countQueryCondition for counting
        const totalRestaurants = await restaurantModel.countDocuments(countQueryCondition);

        const restaurants = await restaurantModel.find(findQueryCondition)
            .select('name description pureVeg bannerImage avgRating totalRatings location addressLine isOpen')
            .skip(skip)
            .limit(limitNumber)
            .lean();

        return apiResponse(res, 200, "Home restaurants feed fetched successfully", {
            restaurants,
            pagination: {
                totalRestaurants,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalRestaurants / limitNumber),
                itemsPerPage: limitNumber
            }
        })
    } catch(error){
        console.error("Error fetching nearby restaurants feed:", error);
        return apiError(res, 500, "Internal Server Error fetching nearby restaurants feed", error.message);
    }
}




module.exports = {
    createRestaurant,
    getOwnerRestaurants,
    updateRestaurantDetails,
    uploadBannerImage,
    deleteBannerImage,
    toggleRestaurantStatus,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleItemAvailability,
    getRestaurantDetails,
    getMenuItems,
    rateRestaurant,
    getNearbyRestaurantsFeed
};