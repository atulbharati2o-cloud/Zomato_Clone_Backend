const apiResponse = require('../utils/apiResponse.js');
const apiError = require('../utils/apiError.js');
const userModel = require('../models/user.model.js');


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

        const token = newUser.generateToken();
        return apiResponse(res, 201, 'User registered successfully.', { token });
    } catch(error){
        console.error('Error in registerUser:', error);
        return apiError(res, 500, 'An error occurred while registering the user.', 'Internal Server Error');
    }
};

const loginUser = async (req, res) => {
    try{
        const { email, contactNumber, password } = req.body;
        if(email){
            const user = await userModel.findOne({ email });
            if(!user || !(await user.isMatchPassword(password))) {
                return apiError(res, 401, 'Invalid email or password.', 'Invalid email or password.');
            }
        }
        if(contactNumber){
            const user = await userModel.findOne({ contactNumber });
            if(!user || !(await user.isMatchPassword(password))) {
                return apiError(res, 401, 'Invalid contact number or password.', 'Invalid contact number or password.');
            }
        }

        const token = user.generateToken();
        return apiResponse(res, 200, 'User logged in successfully.', { token });
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
        return apiResponse(res, 200, 'User account deleted successfully.');
    } catch(error){
        console.error('Error in deleteAccount:', error);
        return apiError(res, 500, 'An error occurred while deleting the account.', 'Internal Server Error');
    }
};
