require('dotenv').config();
const app = require('./src/app.js');
const connectDB = require('./src/config/db.js');
const initCronJobs = require('./src/jobs/cron.job.js');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try{
        await connectDB();

        // Initialize background cron jobs
        initCronJobs();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}✅`);
        });
    } catch(err){
        console.error("Failed to start the server ❌");
        process.exit(1);
    }
}

startServer();