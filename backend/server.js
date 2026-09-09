require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path=require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/BookRoutes");
const aiRoutes = require("./routes/aiRoutes");
const exportRoutes=require("./routes/exportRoutes");


const app = express();
//middlewares to handle cors
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
//connect to database
connectDB();


//middleware to parse json
app.use(express.json());
//static folder for uploads
app.use("/backend/uploads", express.static(path.join(__dirname, "uploads")));
// Health check endpoint for Render monitoring and manual verification
app.get("/health", (req, res) => {
    const mongoose = require("mongoose");
    const dbState = mongoose.connection.readyState;
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (dbState === 1) {
        return res.status(200).json({ status: "OK", message: "Server is healthy and connected to MongoDB", timestamp: new Date() });
    }
    return res.status(500).json({ status: "ERROR", message: "Server is running but MongoDB connection is down", dbState, timestamp: new Date() });
});

//routes
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/export", exportRoutes);

//start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
