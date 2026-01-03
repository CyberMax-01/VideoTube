import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, updateUserCoverImage, updateUserAvatar, getCurrentUser, changeCurrentPassword, updateAccountDetails } from "../controllers/user.controller.js";
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

router.route('/getCurrentUser').post(verifyJWT, getCurrentUser)

router.route('/refresh-token').post(verifyJWT, refreshAccessToken)

router.route('/updateCoverImage').post(
    verifyJWT,
    upload.single('coverImage'),
    updateUserCoverImage
)

router.route('/updateAvatar').post(
    verifyJWT,
    upload.single('avatar'),
    updateUserAvatar
)

router.route('/updateAccountDetails').post(verifyJWT, updateAccountDetails)

export default router