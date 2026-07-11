const cloudinary = require("../config/cloudinary.js");
const streamifier = require("streamifier");


// Upload an in-memory buffer to Cloudinary inside given folder and return { url, publicId }
const uploadBufferToCloudinary = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "auto" },
            (error, result) => {
                if(error) return reject(error);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};


const deleteFromCloudinary = async (publicId) => {
    if(!publicId) return;
    try{
        await cloudinary.uploader.destroy(publicId);
    } catch(error){
        console.error("Error deleting from Cloudinary:", error.message);
    }
};


module.exports = {
    uploadBufferToCloudinary,
    deleteFromCloudinary
}