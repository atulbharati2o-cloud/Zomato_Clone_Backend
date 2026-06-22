const apiResponse = require("./utils/apiResponse.js");
const apiError = require("./utils/apiError.js");
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));







// 404 Error Handling Middleware
app.use((req, res) =>{
    apiError(res, 404, "Not Found", `Requested path ${req.originalUrl} not found on this server!`);
})

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    apiError(res, 500, "Internal Server Error", err.message);
});

module.exports = app;