const apiError = require("../utils/apiError.js");
const apiResponse = require("../utils/apiResponse.js");
const { ZodError } = require("zod");

const validate = (schema) => (req, res, next) => {
    try{
        req.body = schema.parse(req.body);
        next();
    } catch(err){
        if(err instanceof ZodError){
            const formattedErrors = err.issues.map(issue =>{
                return {
                    //// e.path is an array (e.g., ['instructions', 0, 'text']). We can join it to get a string path like 'instructions.0.text'.
                    field: issue.path.join('.'),
                    message: issue.message
                }
            });
            return apiResponse(res, 400, `Validation failed: ${formattedErrors.length} error(s) detected.`, { errors: formattedErrors });
        }

        return apiError(res, 500, `validation error: ${err.message}` || "Internal Server Error while validation");
    }
}

module.exports = validate;