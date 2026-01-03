import asyncHandler from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { deleteOnCloudinary, uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

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

    if(!(coverImageLocalPath && coverImage)) {
        throw new ApiError(500, "Unable to upload cover image file on cloudinary")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        fullname,
        password,
        email,
        avatar: avatar.url,
        avatarPublicId: avatar.public_id,
        coverImage: coverImage?.url || "",
        coverImagePublicId: coverImage?.public_id
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

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const options={
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(
        200,
        { refreshToken, accessToken },
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

    if(oldPassword === newPassword) {
        throw new ApiError(401, "New Password must be different from your current password")
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
        throw new ApiError(401, "fullname or email required")
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

const updateUserAvatar = asyncHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
        throw new ApiError(401, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url) {
        throw new ApiError(400, "Error while uploding avatar on cloudinary")
    }

    const oldAvatar = req.user?.avatarPublicId
    const oldAvatarDelete = await deleteOnCloudinary(oldAvatar)  // Delete avatar file on cloudinary
    if(!oldAvatarDelete) {
        throw new ApiError(401, "Error while deleting avatar file from cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
                avatarPublicId: avatar.public_id
            }
        },
        { new : true }
    )

    return res
    .json(new ApiResponse(
        200,
        {
            url: user.avatar,
            publicId: user.avatarPublicId
        },
        "Avatar updated successfully"
    ))
})

const updateUserCoverImage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath) {
        throw new ApiError(401, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploding avatar on cloudinary")
    }

    const oldCoverImage = req.user?.coverImagePublicId

    if(oldCoverImage) {
        const oldCoverImageDeleted = await deleteOnCloudinary(oldCoverImage)

        if(!oldCoverImageDeleted) {
            throw new ApiError(401, "Error while deleting cover image on cloudinary")
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
                coverImagePublicId: coverImage.public_id
            }
        },
        {
            new: true
        }
    )

    return res
    .json(new ApiResponse(
        200,
        {url: user.coverImage, publicId: user.coverImagePublicId },
        "Cover image updated successfully"
    ))
})

const getUserChannelProfile = asyncHandler( async (req, res) => {
    const {username} = req.params

    if(!username) {
        throw new ApiError(400, "Username is required to get channel profile")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                ifSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullname: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(401, "Channel does not exist")
    }

    return res
    .json(
        new ApiResponse(
            200,
            channel[0],
            "User channel fetched successfully"
        )
    )
})

const getWatchHistory = asyncHandler( async (req, res) => {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "$watchHistory",
                foreignField: "$_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "$owner",
                            foreignField: "$_id",
                            as: "owner"
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .json(
        new ApiResponse(
            200,
            user.watchHistory,
            "Watch history fetched successfully"
        )
    )
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
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}