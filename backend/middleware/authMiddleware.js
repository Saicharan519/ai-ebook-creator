const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }

    let user;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id).select("-password");
    } catch (error) {
        return res.status(401).json({ message: "Not authorized, token failed" });
    }

    // Token is valid but the account no longer exists
    if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user;
    next();
};

module.exports = { protect };
