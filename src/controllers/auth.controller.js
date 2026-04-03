// 🔹 Import required modules
import { User } from "../models/user.models.js"; // User model (DB operations)
import { ApiResponse } from '../utils/api-response.js'; // Standard response format
import { ApiError } from '../utils/api-error.js'; // Custom error handler
import { asyncHandler } from '../utils/async-handler.js'; // Try-catch wrapper
import { emailVerificationMailgenContent, sendEmail } from '../utils/mail.js'; // Email utilities


/**
 * 🔐 FUNCTION: generateAccessAndRefreshToken
 * 
 * 📌 FEATURE:
 * - Access token (short-lived) generate karta hai
 * - Refresh token (long-lived) generate karta hai
 * - Refresh token DB me store karta hai
 * 
 * 📌 USE:
 * - Login API
 * - Refresh token API
 * - OAuth login
 */
const generateAccessAndRefreshToken = async (userId) => {
    try {
        // 🔹 User fetch karo database se
        const user = await User.findById(userId);

        // 🔹 Safety check
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // 🔹 Tokens generate karo
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // 🔹 Refresh token DB me store karo
        user.refreshToken = refreshToken;

        // 🔹 Save without validation
        await user.save({ validateBeforeSave: false });

        // 🔹 Return tokens
        return { accessToken, refreshToken };

    } catch (error) {
        console.error("🔥 TOKEN ERROR:", error);
        throw new ApiError(500, error.message);
    }
};


/**
 * 📝 FUNCTION: registerUser
 * 
 * 📌 FEATURE:
 * - New user create karta hai
 * - Email verification token generate karta hai
 * - Verification email send karta hai
 * 
 * 📌 FLOW:
 * 1. Check existing user
 * 2. Create new user
 * 3. Generate verification token
 * 4. Save token in DB
 * 5. Send email
 * 6. Return user response
 */
const registerUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body;

    // 🔹 Step 1: Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // 🔹 Step 2: Create new user
    const newUser = await User.create({
        email,
        password,
        username,
        isEmailVerified: false
    });

    // 🔹 Step 3: Generate email verification token
    const { unhashedToken, hashedToken, tempTokenExpiry } =
        newUser.generateTemporaryToken();

    // 🔹 Step 4: Save token in DB
    newUser.emailVerificationToken = hashedToken;
    newUser.emailVerificationTokenExpiry = tempTokenExpiry;

    await newUser.save({ validateBeforeSave: false });

    // 🔹 Step 5: Send verification email
    await sendEmail({
        email: newUser.email,
        subject: "Verify your email",
        mailgenContent: emailVerificationMailgenContent(
            newUser.username,
            `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}`
        )
    });

    // 🔹 Step 6: Remove sensitive fields
    const createdUser = await User.findById(newUser._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry"
    );

    if (!createdUser) {
        throw new ApiError(500, "User registration failed");
    }

    // 🔹 Step 7: Send response
    return res.status(201).json(
        new ApiResponse(
            201,
            { user: createdUser },
            "User registered & verification email sent"
        )
    );
});


/**
 * 🔑 FUNCTION: login
 * 
 * 📌 FEATURE:
 * - User authentication (login system)
 * - Password verify karta hai
 * - JWT tokens generate karta hai
 * - Cookies me tokens store karta hai
 * 
 * 📌 FLOW:
 * 1. Validate input
 * 2. Check user exists
 * 3. Verify password
 * 4. Generate tokens
 * 5. Save refresh token
 * 6. Send cookies
 */
const login = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    // 🔹 Step 1: Validate input
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    // 🔹 Step 2: Check user
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(400, "User does not exist");
    }

    // 🔹 Step 3: Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid credentials");
    }

    // 🔹 Step 4: Generate tokens
    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id);

    // 🔹 Step 5: Remove sensitive data
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry"
    );

    // 🔹 Step 6: Cookie options (security)
    const options = {
        httpOnly: true, // JS se access nahi hoga
        secure: true    // HTTPS only
    };

    // 🔹 Step 7: Send response with cookies
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );
});


// 🔹 Export controllers
export { registerUser, login };