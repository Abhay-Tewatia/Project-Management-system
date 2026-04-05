// 🔹 Imports
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { emailVerificationMailgenContent, forgetPasswordMailgenContent, sendEmail } from "../utils/mail.js";


/**
 * 🔐 FUNCTION: generateAccessAndRefreshToken
 * 
 * 📌 FLOW:
 * 1. Find user from DB
 * 2. Generate access token
 * 3. Generate refresh token
 * 4. Save refresh token in DB
 * 5. Return tokens
 */
const generateAccessAndRefreshToken = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};


/**
 * 📝 FUNCTION: registerUser
 * 
 * 📌 FLOW:
 * 1. Get input
 * 2. Check if user exists
 * 3. Create new user
 * 4. Generate email verification token
 * 5. Save token in DB
 * 6. Send verification email
 * 7. Return user response
 */
const registerUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body;

    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const user = await User.create({
        email,
        username,
        password,
        isEmailVerified: false
    });

    const { unhashedToken, hashedToken, tempTokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tempTokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user.email,
        subject: "Verify your email",
        mailgenContent: emailVerificationMailgenContent(
            user.username,
            `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}`
        )
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});


/**
 * 🔑 FUNCTION: login
 * 
 * 📌 FLOW:
 * 1. Validate input
 * 2. Find user
 * 3. Verify password
 * 4. Generate tokens
 * 5. Send cookies
 */
const login = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email & password required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isValid = await user.isPasswordCorrect(password);

    if (!isValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id);

    const options = {
        httpOnly: true,
        secure: false
    };

    return res
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, { user }, "Login successful"));
});


/**
 * 🚪 FUNCTION: logoutUser
 * 
 * 📌 FLOW:
 * 1. Remove refresh token from DB
 * 2. Clear cookies
 * 3. Send response
 */
const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(req.user._id, {
        $set: { refreshToken: "" }
    });

    return res
        .clearCookie("accessToken")
        .clearCookie("refreshToken")
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});


/**
 * 👤 FUNCTION: getCurrentUser
 * 
 * 📌 FLOW:
 * 1. Get user from req
 * 2. Return user
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    return res.json(new ApiResponse(200, req.user, "User fetched"));
});


/**
 * 📩 FUNCTION: verifyEmail
 * 
 * 📌 FLOW:
 * 1. Get token
 * 2. Hash token
 * 3. Find user
 * 4. Check expiry
 * 5. Mark verified
 * 6. Save user
 */
const verifyEmail = asyncHandler(async (req, res) => {

    const { verificationToken } = req.params;

    const hashedToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired token");
    }

    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    user.isEmailVerified = true;

    await user.save({ validateBeforeSave: false });

    return res.json(new ApiResponse(200, {}, "Email verified"));
});


/**
 * 🔁 FUNCTION: resendEmailVerification
 * 
 * 📌 FLOW:
 * 1. Get user
 * 2. Check verification status
 * 3. Generate new token
 * 4. Save token
 * 5. Send email
 */
const resendEmailVerification = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user._id);

    if (!user) throw new ApiError(404, "User not found");

    if (user.isEmailVerified) {
        throw new ApiError(400, "Already verified");
    }

    const { unhashedToken, hashedToken, tempTokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tempTokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user.email,
        subject: "Verify your email",
        mailgenContent: emailVerificationMailgenContent(
            user.username,
            `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}`
        )
    });

    return res.json(new ApiResponse(200, {}, "Verification email sent"));
});


/**
 * 🔄 FUNCTION: refreshAccessToken
 * 
 * 📌 FLOW:
 * 1. Get refresh token
 * 2. Verify token
 * 3. Find user
 * 4. Match token
 * 5. Generate new tokens
 * 6. Send response
 */
const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingToken) {
        throw new ApiError(401, "Unauthorized");
    }

    const decoded = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decoded._id);

    if (!user || incomingToken !== user.refreshToken) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id);

    return res
        .cookie("accessToken", accessToken)
        .cookie("refreshToken", refreshToken)
        .json(new ApiResponse(200, {}, "Token refreshed"));
});

/**
 * 🔐 FUNCTION: forgotPasswordRequest
 * 
 * 📌 FEATURE:
 * - User password reset request handle karta hai
 * - Temporary reset token generate karta hai
 * - Email ke through reset link bhejta hai
 * 
 * 📌 FLOW:
 * 1. Get email from request body
 * 2. Find user in database using email
 * 3. If user not found → throw error
 * 4. Generate temporary reset token
 * 5. Save hashed token + expiry in DB
 * 6. Send password reset email with token link
 * 7. Return success response
 */
const  forgotPasswordRequest = asyncHandler(async(req, res) =>{
    const {email} = req.body
    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404, "User does not exists", [])
    }
   const{ unhashedToken, hashedToken, tempTokenExpiry} = user.generateTemporaryToken();
   user.forgotPasswordToken = hashedToken
   user.forgotPasswordTokenExpiry = tempTokenExpiry

   await user.save({validateBeforeSave:false})
   await sendEmail({
        email: user?.email,
        subject: "Password reset request",
        mailgenContent: forgetPasswordMailgenContent(
            user.username,
            `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unhashedToken}`,
        )
    });
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "password reset mail has been sent on your mail id"
        )
    )
})


/**
 * 🔐 FUNCTION: resetForgotPassword
 * 
 * 📌 FEATURE:
 * - Reset password using token
 * - Token verify karta hai (valid + not expired)
 * - New password set karta hai
 * - Token ko invalidate karta hai
 * 
 * 📌 FLOW:
 * 1. Get reset token from URL params
 * 2. Get new password from request body
 * 3. Hash the incoming token
 * 4. Find user using hashed token
 * 5. Check token expiry (valid or expired)
 * 6. If user not found → throw error
 * 7. Set new password
 * 8. Remove reset token & expiry from DB
 * 9. Save updated user
 * 10. Send success response
 */
const resetForgotpassword = asyncHandler(async(req, res) => {
    const {resetToken} = req.params
    const {newpassword} = req.body

    let hashedToken = crypto
       .createHash("sha256")
       .update(resetToken)
       .digest("hex")

      const user =  await User.findOne({
        forgotPasswordToken : hashedToken,
        forgotPasswordTokenExpiry: {$gt: Date.now()}
       })

       if(!user){
        throw new ApiError(489, "Token is invalid or expired")
       }
       user.forgotPasswordTokenExpiry = undefined
       user.forgotPasswordToken = undefined
    
       user.password = newpassword
       await user.save({validateBeforeSave: false})

       return res
       .status(200)
       .json(
        new ApiResponse(
            200,
            {},
            "password reset succesfully"
        )
       )

})

/**
 * 🔐 FUNCTION: changeCurrentPassword
 * 
 * 📌 FEATURE:
 * - Logged-in user ka password change karta hai
 * - Old password verify karta hai (security)
 * - New password set karta hai
 * 
 * 📌 FLOW:
 * 1. Get oldPassword & newPassword from request body
 * 2. Get current user from DB using req.user._id
 * 3. Verify old password
 * 4. If old password incorrect → throw error
 * 5. Set new password
 * 6. Save updated user in DB
 * 7. Return success response
 */
const changeCurrentPassword =  asyncHandler(async(req, res) => {
        const {oldPassword, newPassword} = req.body

       const user =  await User.findById(req.user?._id);
       const ispasswordValid  = await user.isPasswordCorrect(oldPassword)
       if(!ispasswordValid){
        throw new ApiError(400, "invalid old password")
       }

       user.password = newPassword
       await user.save({validateBeforeSave: false})

       return res
       .status(200)
       .json(
        new ApiResponse(200, {}, "Password change successfully")
       );
});

// 🔹 Export
export {
    registerUser,
    login,
    logoutUser,
    getCurrentUser,
    verifyEmail,
    resendEmailVerification,
    refreshAccessToken,
    forgotPasswordRequest,
    resetForgotpassword,
    changeCurrentPassword

};