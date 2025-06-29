const express = require('express')
const router = express.Router()
const userController = require('../controller/user/userController')
const profileController = require('../controller/user/profileController')
const productController = require('../controller/user/productController')
const passport = require('passport')
const {userAuth, adminAuth } = require('../middleware/auth')

router.get('/pageNotFound', userController.pageNotFound)
//authentication management
router.get('/login', userController.loadLogin)
router.post('/login', userController.login)
router.get('/logout', userController.logout)
router.get('/signup', userController.loadSignup)
router.post('/signup', userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resendOtp', userController.resendOTP)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email'],prompt: 'consent select_account'}))
router.get('/auth/google/callback', passport.authenticate('google',{failureRedirect:'/signup'}),(req, res)=>{
    req.session.user = req.user._id;
    res.redirect('/')
})


//home page and shopping page
router.get('/', userController.loadHome)
router.get('/shop', userAuth, userController.loadShoppingPage)
router.get('/search', userAuth, userController.searchProducts)
//profile management
router.get('/forgotpassword', profileController.getForgotPassword)
router.post('/forgot-email-valid', profileController.forgotEmailValid)
router.post('/verify-pass-Forgot-otp', profileController.verifyForgotPassOtp)
router.get('/reset-password', profileController.getResetPassPage)
router.post('/forgot-pass-resend-otp', profileController.resendOtp)
router.post('/reset-password', profileController.newPassword)

//product management
router.get('/productDetails', userAuth, productController.productDetails)







module.exports = router