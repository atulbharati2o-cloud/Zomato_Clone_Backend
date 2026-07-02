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

        const allowedFields = [ "name", "description", "addressLine", "coordinates" ];
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


const deleteBannerImage = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        if(!restaurant.bannerImage || restaurant.bannerImage === ""){
            return apiError(res, 404, "No banner image.", "Not Found");
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
        const restaurant = req.restaurant;

        restaurant.isOpen = !restaurant.isOpen;
        await restaurant.save();
        return apiResponse(res, 200, `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`, { isOpen: restaurant.isOpen });
    } catch(error){
        console.error("Error toggling restaurant status:", error);
        return apiError(res, 500, "Error toggling restaurant status", error.message);
    }
};


const addMenuItem = async (req, res) => {
    try{
        const restaurant = req.restaurant;

        let savedImagePaths = [];

        if(req.files && req.files.length > 0){
            for(const file of req.files){
                const imagePath = `images/uploads/${file.filename}`;
                savedImagePaths.push(imagePath);
            }
        }

        const { name, description, price, isVeg, category } = req.body;

        const newMenuItem = {
            name,
            description,
            price,
            images: savedImagePaths,
            isVeg: isVeg === 'true' || isVeg === true,
            category
        };

        restaurant.menu.push(newMenuItem);
        await restaurant.save();

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
                for(const file of req.files){
                    await fs.unlink(file.path).catch(() => {});
                }
                return apiError(res, 400, `You can upload a maximum of ${maxImages} images`, "Bad Request");
            }

            for(const file of req.files){
                const imagePath = `images/uploads/${file.filename}`;
                restaurant.menu[menuItemIndex].images.push(imagePath);
            }
        }

        try{
            await restaurant.save();
        } catch(saveError){
            if(req.files){
                for(const file of req.files){
                    await fs.unlink(file.path).catch(() => {});
                }
            }
            throw saveError;
        }

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
            for(const image of restaurant.menu[menuItemIndex].images){
                const imagePath = path.join(process.cwd(), 'src', 'public', image);
                try{
                    await fs.access(imagePath);
                    await fs.unlink(imagePath);
                } catch(unlinkError){
                    console.error("Error deleting menu item image:", unlinkError.message);
                }
            }
        }

        restaurant.menu.splice(menuItemIndex, 1);
        await restaurant.save();

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

        const restaurant = await restaurantModel.findById(restaurantId).select('-ratedBy');

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

        const restaurant = await restaurantModel.findById(restaurantId).select('menu');
        if(!restaurant){
            return apiError(res, 404, "Restaurant profile not found", "Not Found");
        }

        let fullMenu = restaurant.menu || [];
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

        return apiResponse(res, 200, "Restaurant rated successfully", { yourRating: rating  , avgRating: restaurant.avgRating, totalRatings: restaurant.totalRatings });
    } catch(error){
        console.error("Error rating restaurant:", error);
        return apiError(res, 500, "Error rating restaurant", error.message);
    }
};


const rateMenuItem = async (req, res) => {
    try{
        const { restaurantId, menuItemId } = req.params;
        const { rating } = req.body;
        const userId = req.user._id;

        if(!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(menuItemId)){
            return apiError(res, 400, "Invalid restaurant ID or menu item ID", "Bad Request");
        }

        const numericRating = parseInt(rating);
        if(isNaN(numericRating) || numericRating < 1 || numericRating > 5){
            return apiError(res, 400, "Rating must be an integer between 1 and 5", "Bad Request");
        }

        const restaurant = await restaurantModel.findById(restaurantId);
        if(!restaurant){
            return apiError(res, 404, "Restaurant profile not found", "Not Found");
        }

        const itemIndex = restaurant.menu.findIndex(item => item._id.toString() === menuItemId);
        if(itemIndex === -1){
            return apiError(res, 404, "Menu item not found", "Not Found");
        }

        const menuItem = restaurant.menu[itemIndex];

        if(!menuItem.ratedBy){
            menuItem.ratedBy = [];
        }

        const existingRatingIndex = menuItem.ratedBy.findIndex(entry => entry.userId.toString() === userId.toString());
        if(existingRatingIndex !== -1){
            menuItem.ratedBy[existingRatingIndex].rating = numericRating;
        } else {
            menuItem.ratedBy.push({ userId, rating: numericRating });
        }

        const totalRatings = menuItem.ratedBy.length;
        const sumRatings = menuItem.ratedBy.reduce((sum, entry) => sum + entry.rating, 0);
        const avgRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

        menuItem.avgRating = avgRating;
        menuItem.totalRatings = totalRatings;

        await restaurant.save();

        return apiResponse(res, 200, "Menu item rated successfully", { dishName: menuItem.name, yourRating: numericRating, avgRating: menuItem.avgRating, totalRatings: menuItem.totalRatings });
    } catch(error){
        console.error("Error rating menu item:", error);
        return apiError(res, 500, "Error rating menu item", error.message);
    }
}




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

        const queryCondition = {
            isOpen: true,
            location: {
                $nearSphere: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        }

        const totalRestaurants = await restaurantModel.countDocuments(queryCondition);

        const restaurants = await restaurantModel.find(queryCondition)
            .select('name description bannerImage avgRating totalRatings location addressLine isOpen')
            .sort({ totalRatings: -1, avgRating: -1 })
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
    getBannerImage,
    rateRestaurant,
    rateMenuItem,
    getNearbyRestaurantsFeed
};