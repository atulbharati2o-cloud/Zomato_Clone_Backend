const fs = require('fs').promises;

const cleanupUploadedFiles = async (req) => {
    try{
        // single file upload cleanup
        if(req.file && req.file.path){
            await fs.unlink(req.file.path).catch(() => {});
        }

        //multiple files upload cleanup
        if(req.files && (Array.isArray(req.files) || typeof req.files === 'object')){
            if(Array.isArray(req.files)){
                for(const file of req.files){
                    if(file.path){
                        await fs.unlink(file.path).catch(() => {});
                    }
                }
            } else{
                for(const field in req.files){
                    for(const file of req.files[field]){
                        if(file.path){
                            await fs.unlink(file.path).catch(() => {});
                        }
                    }
                }
            }
        }
    } catch(error){
        console.error('Error in cleanupUploadedFiles:', error.message);
    }
}


module.exports = cleanupUploadedFiles;