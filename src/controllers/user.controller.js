const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const userModel = require('../models/user.model.js');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service.js');


const registerUser = async (req, res) => {
    try{
        const { firstName, lastName, email, password, contactNumber, dob, role, vehicleDetails } = req.body;

        const userExists = await userModel.findOne({ $or: [{ email }, { contactNumber }] });
        if(userExists) return apiError(res, 400, "This email or contact number is already registered.", "This email or contact number is already registered.");

        if(role === 'driver' && !vehicleDetails) {
            return apiError(res, 400, "Vehicle details are required for driver registration");
        }

        const newUser = await userModel.create({
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            dob,
            role,
            vehicleDetails: role === 'driver' ? vehicleDetails : undefined
        });

        const { password: _, ...userWithoutPassword } = newUser.toObject(); // Exclude password from response

        const token = newUser.generateToken();
        return apiResponse(res, 201, 'User registered successfully.', { user: userWithoutPassword, token });
    } catch(error){
        console.error('Error in registerUser:', error);
        return apiError(res, 500, 'An error occurred while registering the user.', 'Internal Server Error');
    }
};

const loginUser = async (req, res) => {
    try{
        const { identifier, password } = req.body; // identifier can be email or contactNumber
        const user = await userModel.findOne({ $or: [{ email: identifier }, { contactNumber: identifier }] });
      
        if(!user || !(await user.isMatchPassword(password))){
            return apiError(res, 401, 'Invalid credentials.', 'Invalid credentials.');
        }

        const token = user.generateToken();
        const { password: _,  ...userWithoutPassword } = user.toObject(); // Exclude password and __v from response
        return apiResponse(res, 200, 'User logged in successfully.', { user: userWithoutPassword, token });
    } catch(error){
        console.error('Error in loginUser:', error);
        return apiError(res, 500, 'An error occurred while logging in.', 'Internal Server Error');
    }
};

const viewProfile = async (req, res) => {
    try{
        const userId = req.user._id;
        const user = await userModel.findById(userId).select('-password -__v');
        if(!user) return apiError(res, 404, 'User not found.', 'User not found.');

        return apiResponse(res, 200, 'User profile fetched successfully.', { user });
    } catch(error){
        console.error('Error in viewProfile:', error);
        return apiError(res, 500, 'An error occurred while fetching the profile.', 'Internal Server Error');
    }
};

const logoutUser = async (req, res) => {
    // Since JWt is stateless, we can't truly "logout" on the server side. The client should simply delete the token.
    return apiResponse(res, 200, 'User logged out successfully.', {});
};

const deleteAccount = async (req, res) => {
    try{
        const userId = req.user._id;
        const deletedUser = await userModel.findByIdAndDelete(userId);
        if(!deletedUser) return apiError(res, 404, 'User not found.', 'User not found.');

        if(deletedUser.avatar.publicId){
            await deleteFromCloudinary(deletedUser.avatar.publicId);
        }

        return apiResponse(res, 200, 'User account deleted successfully.');
    } catch(error){
        console.error('Error in deleteAccount:', error);
        return apiError(res, 500, 'An error occurred while deleting the account.', 'Internal Server Error');
    }
};

const uploadAvatar = async (req, res) => {
    try{
        const userId = req.user._id;
        const user = await userModel.findById(userId);

        if(!user){
            return apiError(res, 404, 'User not found.', 'User not found.');
        }
        
        if(!req.file){
            return apiError(res, 400, 'No image file uploaded.','No image file uploaded.');
        }

        if(user.avatar.publicId){
            await deleteFromCloudinary(user.avatar.publicId);
        }

        const { url, publicId } = await uploadBufferToCloudinary(req.file.buffer, 'zomato-clone/avatars');

        user.avatar = { url, publicId };
        await user.save();

        return apiResponse(res, 200, 'Avatar uploaded successfully.', { avatar: user.avatar });
    } catch(error){
        console.error('Error in uploadAvatar:', error);
        return apiError(res, 500, 'An error occurred while uploading the avatar.', 'Internal Server Error');
    }
};


const removeAvatar = async (req, res) => {
    try{
        const userId = req.user._id;
        const user = await userModel.findById(userId);
        if(!user || !user.avatar){
            return apiError(res, 404, 'Avatar not found.', 'Avatar not found.');
        }

        if(user.avatar.publicId){
            await deleteFromCloudinary(user.avatar.publicId);
        }

        user.avatar = { url: "", publicId: null };
        await user.save();

        return apiResponse(res, 200, 'Avatar removed successfully.');
    } catch(error){
        console.error('Error in removeAvatar:', error);
        return apiError(res, 500, 'An error occurred while removing the avatar.', 'Internal Server Error');
    }
}

module.exports = {
    registerUser,
    loginUser,
    viewProfile,
    logoutUser,
    deleteAccount,
    uploadAvatar,
    removeAvatar
};