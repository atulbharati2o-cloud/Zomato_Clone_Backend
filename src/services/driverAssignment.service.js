const userModel = require('../models/user.model.js');


const claimNearestAvailableDriver = async (coordinates, maxDistance = 8000) => {
    const driver = await userModel.findOneAndUpdate(
        {
            role: 'driver',
            isAvailable: true,
            currentLocation: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates
                    },
                    $maxDistance: maxDistance
                }
            }
        },
        {
            isAvailable: false
        },
        {
            returnDocument: 'after'
        }
    );

    return driver; // null if no driver found within range
};


module.exports = claimNearestAvailableDriver;