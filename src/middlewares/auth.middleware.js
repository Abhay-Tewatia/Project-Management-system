import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {

    // 🔹 Token get from cookies or headers
    const token =
        req.cookies?.accessToken ||
        req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // 🔹 Decode token
        const decodedToken = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET
        );

        // 🔹 Find user
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry"
        );

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }

        // 🔹 Attach user to request
        req.user = user;

        next();

    } catch (error) {
        throw new ApiError(401, "Invalid access token");
    }
});