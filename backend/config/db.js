const mongoose = require("mongoose");
const connectDB = async () => {
    try {
        console.log("mongo uri:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI, {});
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }   
    // console.log("hello");
};

module.exports = connectDB;