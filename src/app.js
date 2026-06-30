const apiResponse = require("./utils/apiResponse.js");
const apiError = require("./utils/apiError.js");
const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));



app.use("/api/v1/users", require("./routes/user.route.js"))

app.use("/api/v1/restaurants", require("./routes/restaurant.route.js"))



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