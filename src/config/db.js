const mongoose = require("mongoose");

const connectDB = async () => {
    try{
        const conn = await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
        console.log("MongoDB Connected✅: ", conn.connection.host);
    } catch(err){
        console.log("MongoDB connection FAILED ❌", err);
        process.exit(1);
    }
}

module.exports = connectDB;