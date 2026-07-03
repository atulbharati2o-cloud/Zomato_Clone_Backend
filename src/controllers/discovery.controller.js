const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const restaurantModel = require('../models/restaurant.model.js');


const getZomatoSearchFeed = async (req, res) => {
    try{
        const {
            lng, lat,
            radius = 5000,
            keyword,
            pureVeg,
            page = 1,
            limit = 10
        } = req.query;

        if(!lng || !lat){
            return apiError(res, 400, "Missing required query parameters", "Longitude and Latitude are required for search.");
        }

        const longitude = parseFloat(lng);
        const latitude = parseFloat(lat);
        const radiusInMeters = parseFloat(radius);

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        if(isNaN(longitude) || isNaN(latitude) || isNaN(radiusInMeters)){
            return apiError(res, 400, "Invalid query parameters", "Longitude, Latitude, and Radius must be valid numbers.");
        }

        const vegFilterMode = pureVeg === undefined 
            ? 'all'
            : (pureVeg === 'true' || pureVeg === true)
                 ? 'veg'
                 : 'non-veg'

        const query = {
            isOpen: true,
            location: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: radiusInMeters
                }
            }
        };

        if(vegFilterMode === 'veg'){
            query.pureVeg = true;
        } else if(vegFilterMode === 'non-veg'){
            query.pureVeg = false;
        }

        const nearbyRestaurants = await restaurantModel.find(query).lean();

        let filteredResults = [];

        if(keyword && keyword.trim() !== ""){
            const cleanKeyword = keyword.trim().toLowerCase();

            // Split into tokens, remove common stopwords/noise words
            const stopWords = new Set(["the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "a", "an"]);

            // suppose search query is "Spicy Chicken Wings", then tokens will be ["spicy", "chicken", "wings"]
            const tokens = cleanKeyword
                .split(/\s+/)
                .filter(Boolean)
                .filter(token => !stopWords.has(token));

            
            const scoredRestaurants = nearbyRestaurants.map( restaurant => {
                let score = 0;
                const restaurantName = restaurant.name.toLowerCase();
                const restaurantDescription = (restaurant.description || "").toLowerCase();

                if(restaurantName.includes(cleanKeyword)) score += 100;
                if(restaurantDescription.includes(cleanKeyword)) score += 20;

                restaurant.menu.forEach( dish => {
                    if(!dish.isAvailable) return;

                    const dishName = dish.name.toLowerCase();
                    const dishDescription = (dish.description || "").toLowerCase();

                    if(dishName.includes(cleanKeyword)) score += 50;
                    if(dishDescription.includes(cleanKeyword)) score += 30;

                    tokens.forEach( token => {
                        if(dishName.includes(token)) score += 10;
                    });
                });

                return { restaurant, score };
            });

            // Filter out restaurants that have keyword or their menu has keyword and 
            // sort according to score in descending order
            filteredResults = scoredRestaurants
                .filter( item => item.score > 0 )
                .sort( (a, b) => b.score - a.score )
                .map( entry => entry.restaurant );

        } else{
            // No keyword, sort according to totalRatings and avgRating
            filteredResults = [...nearbyRestaurants]
                .sort( (a, b) => {
                    if(a.totalRatings !== b.totalRatings){
                        return b.totalRatings - a.totalRatings; // Descending order of totalRatings
                    } else {
                        return b.avgRating - a.avgRating; // Descending order of avgRating if totalRatings are equal
                    }
                })
        }

        const totalCount = filteredResults.length;
        const paginatedResults = filteredResults.slice(skip, skip + limitNumber);

        const organizedResults = paginatedResults.map( restaurant => {
            const { menu, ratedBy, ...publicProfile } = restaurant;
            return publicProfile;
        });

        return apiResponse(res, 200, "Zomato search feed fetched successfully", {
            restaurants: organizedResults,
            pagination: {
                totalCount,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalCount / limitNumber),
                itemsPerPage: limitNumber
            }
        });

    } catch(error){
        console.error("Error in split-phase search engine execution: ", error);
        return apiError(res, 500, "Internal Server Error compiling search results.", error.message);
    }
}

module.exports = {
    getZomatoSearchFeed
}