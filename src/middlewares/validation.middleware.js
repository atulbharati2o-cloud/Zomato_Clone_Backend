const apiError = require("../utils/apiError.js");
const apiResponse = require("../utils/apiResponse.js");
const { ZodError } = require("zod");
const cleanupUploadedFiles = require("../utils/cleanupUploadedFiles.js");

const validate = (schema) => (req, res, next) => {
    try{
        if(req.body.coordinates && typeof req.body.coordinates === 'string'){
            try{
                req.body.coordinates = JSON.parse(req.body.coordinates);
            } catch{
                return apiError(res, 400, "Invalid coordinates format");
            }
        }

        req.body = await schema.parseAsync(req.body);
        return next();

    } catch(err){

        await cleanupUploadedFiles(req);

        if(err instanceof ZodError){
            const formattedErrors = err.issues.map(issue =>{
                return {
                    //// e.path is an array (e.g., ['instructions', 0, 'text']). We can join it to get a string path like 'instructions.0.text'.
                    field: issue.path.join('.'),
                    message: issue.message
                }
            });
            return apiError(res, 400, `Validation failed: ${formattedErrors.length} error(s) detected.`, formattedErrors);
        }

        return apiError(res, 500, `validation error: ${err.message}` || "Internal Server Error while validation");
    }
}

module.exports = validate;