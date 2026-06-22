const apiError = (res, statusCode, message, error = null) => {
    return res.status(statusCode).json({
        success: statusCode < 400,
        message,
        error
    });
};

module.exports = apiError;