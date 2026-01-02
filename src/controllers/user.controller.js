import asyncHandler from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshToken = async function(userId) {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.accessTokenGenerator();
        const refreshToken = await user.refreshTokenGenerator();
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken };
        
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        );
    }
    
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exist: username, email
    // check for image, check for avatar
    // upload them on cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // send response

    const { username, fullname, email, password } = req.body

    if([username, fullname, email, password].some(
        (field) => field?.trim() === ""
    )) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser) {
        throw new ApiError(409, "User with this username and email already existed")
    }

    const avatarLocalPath = Object.hasOwn(req.files, "avatar")? req.files?.avatar[0]?.path : null
    const coverImageLocalPath = Object.hasOwn(req.files, "coverImage")? req.files?.coverImage[0]?.path : null

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(500, "Unable to upload avatar file on cloudinary")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        fullname,
        password,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User created Successfully :)")
    )
})

const loginUser = asyncHandler( async (req, res) => {
    // Get data from req.body
    // Validate fields are not empty
    // check user exists or not
    // Get user ref from db
    // Check password is correct
    // Provide access and refresh token

    const {usernameOrEmail, password} = req.body

    if(!usernameOrEmail) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{username: usernameOrEmail}, {email: usernameOrEmail}]
    })

    if(!user) {
        throw new ApiError(401, "User does not exists")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid) {
        throw new ApiError(401, "Incorrect password")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }
    
    return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully :)"
        )
    )
})

const logoutUser = asyncHandler( async (req, res) => {

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "user logout successfully"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    
    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    const decodedRefreshToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedRefreshToken?._id)
    if(!user) {
        throw new ApiError(401, "Invalid refresh token")
    }

    if(user?.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is expired or used")
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)

    const options={
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(new ApiResponse(
        200,
        {refreshToken: newRefreshToken, accessToken},
        "Access token refreshed"
    ))
})

const changeCurrentPassword = asyncHandler( async (req, res) => {
    const {oldPassword, newPassword} = req.body

    if(!(oldPassword && newPassword)) {
        throw new ApiError(401, "Invalid request")
    }

    const user = await User.findById(req.user?._id)
    const validPassword = user.isPasswordCorrect(oldPassword)

    if(!validPassword) {
        throw new ApiError(400, "Wrong password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password change successfully"
        )
    )
})

const getCurrentUser = asyncHandler( async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler( async (req, res) => {
    let {fullname, email} = req.body
    if(!(fullname || email)) {
        throw new ApiError(401, "fullname or emial required")
    } else if(!fullname) {
        fullname = req.user?.fullname
    } else {
        email = req.user?.email
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res.
    json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    )
})

const updateUserAvatar = asynchandler( async (req, res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
        throw new ApiError(401, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url) {
        throw new ApiError(400, "Error while uploding avatar on cloudinary")
    }
    req?.user.avatar = avatar.url
    req?.user.save({validateBeforeSave: false})

    return res
    .json(new ApiResponse(
        200,
        avatar.url,
        "Avatar updated successfully"
    ))
})

const updateUserCoverImage = asynchandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath) {
        throw new ApiError(401, "Avatar file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverIamge.url) {
        throw new ApiError(400, "Error while uploding avatar on cloudinary")
    }
    req?.user.coverImage = coverImage.url
    req?.user.save({validateBeforeSave: false})

    return res
    .json(new ApiResponse(
        200,
        coverImage.url,
        "Cover image updated successfully"
    ))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}