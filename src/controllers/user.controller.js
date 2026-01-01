import asyncHandler from '../utils/asyncHandler.js'
import { apiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { apiResponse } from '../utils/apiResponse.js'

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
        throw new apiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser) {
        throw new apiError(409, "User with this username and email already existed")
    }

    const avatarLocalPath = Object.hasOwn(req.files, "avatar")? req.files?.avatar[0]?.path : null
    const coverImageLocalPath = Object.hasOwn(req.files, "coverImage")? req.files?.coverImage[0]?.path : null

    if(!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new apiError(500, "Unable to upload avatar file on cloudinary")
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
        throw new apiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(201, createdUser, "User created Successfully :)")
    )
})

export {registerUser}