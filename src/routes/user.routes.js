import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, updateUserCoverImage, updateUserAvatar, getCurrentUser, changeCurrentPassword, updateAccountDetails, getUserChannelProfile, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route('/register').post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route('/login').post(loginUser)

// Secure routes

router.route('/logout').post(verifyJWT, logoutUser)

router.route('/changePassword').post(verifyJWT, changeCurrentPassword)

router.route('/currentUser').get(verifyJWT, getCurrentUser)

router.route('/refresh-token').get(verifyJWT, refreshAccessToken)

router.route('/coverImage').patch(
    verifyJWT,
    upload.single('coverImage'),
    updateUserCoverImage
)

router.route('/avatar').patch(
    verifyJWT,
    upload.single('avatar'),
    updateUserAvatar
)

router.route('/updateAccount').patch(verifyJWT, updateAccountDetails)

router.route('/channel/:username').get(verifyJWT, getUserChannelProfile)

router.route('/watchHistory').get(verifyJWT, getWatchHistory)

export default router