const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const userModel = require('../models/user.model.js');
const path = require('path');
const fs = require('fs').promises;


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

        // delete avatar if exists and not default
        if(deletedUser.avatar && !deletedUser.avatar.endsWith('default-avatar.avif')){
            const avatarPath = path.join(process.cwd(), 'src', 'public', deletedUser.avatar);
            try{
                await fs.access(avatarPath);
                await fs.unlink(avatarPath);
                console.log('Avatar deleted successfully:', avatarPath);
            } catch(unlinkError){
                console.error('Error deleting avatar:', unlinkError.message);
            }
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
            if(req.file) await fs.unlink(req.file.path).catch(err => console.error('Error deleting uploaded file:', err));
            return apiError(res, 404, 'User not found.', 'User not found.');
        }
        
        if(!req.file){
            return apiError(res, 400, 'No image file uploaded.','No image file uploaded.');
        }

        if(user.avatar && !user.avatar.endsWith('default-avatar.avif')){
            const oldAvatarPath = path.join(process.cwd(), 'src', 'public', user.avatar);
            try{
                await fs.access(oldAvatarPath);
                await fs.unlink(oldAvatarPath);
                console.log('Old avatar deleted successfully:', oldAvatarPath);
            } catch(unlinkError){
                console.error('Error deleting old avatar:', unlinkError.message);
            }
        }

        user.avatar = `images/uploads/${req.file.filename}`;

        // save profile changes and handle potential errors during save
        try{
            await user.save();
        } catch(saveError){
            await fs.unlink(req.file.path).catch((err) => {});
            throw saveError;
        }

        return apiResponse(res, 200, 'Avatar uploaded successfully.', { avatar: user.avatar });
    } catch(error){
        console.error('Error in uploadAvatar:', error);
        return apiError(res, 500, 'An error occurred while uploading the avatar.', 'Internal Server Error');
    }
};

const getAvatar = async (req, res) => {
    try{
        const userId = req.user._id;
        const user = await userModel.findById(userId);

        if(!user || !user.avatar){
            return apiError(res, 404, 'Avatar not found.', 'Avatar not found.');
        }

        const absoluteAvatarPath = path.join(process.cwd(), 'src', 'public', user.avatar);
        try{
            await fs.access(absoluteAvatarPath);
            return res.sendFile(absoluteAvatarPath);
        } catch(accessError){
            console.error("Database path exists but file is missing on server:", accessError.message);
            return apiError(res, 404, 'Avatar file not found on server.', 'File not found.');
        }

    } catch(error){
        console.error('Error in getAvatar:', error);
        return apiError(res, 500, 'An error occurred while fetching the avatar.', 'Internal Server Error');
    }
};


const removeAvatar = async (req, res) => {
    try{
        const userId = req.user._id;
        const user = await userModel.findById(userId);
        if(!user){
            return apiError(res, 404, 'User not found.', 'User not found.');
        }

        if(user.avatar && !user.avatar.endsWith('default-avatar.avif')){
            const avatarPath = path.join(process.cwd(), 'src', 'public', user.avatar);
            try{
                await fs.access(avatarPath);
                await fs.unlink(avatarPath);
                console.log('Avatar deleted successfully:', avatarPath);
            } catch(unlinkError){
                console.error('Error deleting avatar:', unlinkError.message);
            }
        }

        user.avatar = `images/uploads/default-avatar.avif`;
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
    getAvatar,
    removeAvatar
};