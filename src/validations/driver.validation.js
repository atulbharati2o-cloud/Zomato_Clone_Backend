const { z } = require('zod');

const updateDriverLocationSchema = z.object({
    coordinates: z.tuple([
        z.number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),

        z.number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90")
    ])
});


const toggleDriverAvailabilitySchema = z.object({
    isAvailable: z.string().or(z.boolean())
        .transform((val) => typeof val === 'string' ? val.toLowerCase() === 'true' : val)
});


module.exports = {
    updateDriverLocationSchema,
    toggleDriverAvailabilitySchema
}