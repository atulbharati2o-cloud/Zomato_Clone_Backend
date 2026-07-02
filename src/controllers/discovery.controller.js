const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const restaurantModel = require('../models/restaurant.model.js');


const getZomatoSearchFeed = async (req, res) => {
    try{
        const {
            lng, lat, 
            radius = 5000,
            keyword,
            isVeg, 
            page = 1,
            limit = 10
        } = req.query;

        if(!lng || !lat){
            return apiError(res, 400, "Longitude and Latitude are required.");
        }

        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.max(1, parseInt(limit));
        const skip = (pageNumber - 1) * limitNumber;

        const query = {
            isOpen: true,
            location: {
                $nearSphere: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        };

        if(keyword){
            query.$text = { $search: new RegExp(keyword.trim(), 'i') }; 
        }

        if(isVeg !== undefined && (isVeg === 'true' || isVeg === true)){
            query["menu.isVeg"] = true;
        }

        const totalCount = await restaurantModel.countDocuments(query);

        let findChain = restaurantModel.find(query);
        if(keyword){
            findChain = findChain
                .select({ score: { $meta: "textScore" } })
                .sort({ score: { $meta: "textScore" } });
        }

        const restaurants = await findChain
            .select('name description bannerImage avgRating totalRatings addressLine location isOpen')
            .skip(skip)
            .limit(limitNumber)
            .lean();

        return apiResponse(res, 200, "Zomato search feed fetched successfully.", {
            restaurants,
            pagination: {
                totalCount,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalCount / limitNumber),
                limit: limitNumber
            }
        });

    } catch(error){
        console.error("Error in getZomatoSearchFeed:", error);
        return apiError(res, 500, "Internal Server Error while fetching Zomato search feed", error.message);
    }
};




module.exports = {
    getZomatoSearchFeed
}