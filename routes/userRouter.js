const express = require('express')
const router = express.Router()
const userController = require('../controller/user/userController')
const profileController = require('../controller/user/profileController')
const productController = require('../controller/user/productController')
const cartController = require('../controller/user/cartController')
const checkoutController = require('../controller/user/checkoutController')
const orderController = require('../controller/user/orderController')
const wishlistController = require('../controller/user/wishlistController')
const walletController = require('../controller/user/walletController')
const passport = require('passport')
const {userAuth, adminAuth } = require('../middleware/auth')
const upload = require('../middleware/multerConfig')

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
router.get('/userProfile', userAuth, profileController.loadUserProfile)
router.get('/forgotpassword', profileController.getForgotPassword)
router.post('/forgot-email-valid', profileController.forgotEmailValid)
router.post('/verify-pass-Forgot-otp', profileController.verifyForgotPassOtp)
router.get('/reset-password', profileController.getResetPassPage)
router.post('/forgot-pass-resend-otp', profileController.resendOtp)
router.post('/reset-password', profileController.newPassword)
router.get('/change-email', userAuth, profileController.getChangeEmail)
router.post('/change-email', userAuth, profileController.changeEmail)
router.get('/verify-email-change-otp', userAuth, profileController.getEmailchangeOtpPage)
router.post('/verify-otp-changeEmail', userAuth, profileController.verifyChangeEmailOtp)
router.post('/changeEmailResendOtp', userAuth, profileController.changeEmailResendOtp)
router.get('/updateEmail', userAuth, profileController.getUpdateEmail)
router.post('/updateEmail', userAuth, profileController.updateEmail)
router.post('/update-profile', userAuth, profileController.updateProfile)
router.post('/update-profile-pic', userAuth, upload.single('profileImage'), profileController.updateProfilePic)
router.post('/change-password', userAuth, profileController.changePassword)
router.get('/referAndEarn', userAuth, profileController.loadReferAndEarn)

//address management
router.get('/address', userAuth, profileController.getAddressPage)
router.get('/add-address', userAuth, profileController.getAddAddress)
router.post('/add-address', userAuth, profileController.addAddress)
router.get('/edit-address/:id', userAuth, profileController.getEditAddress)
router.post('/edit-address/:id', userAuth, profileController.editAddress)
router.delete('/delete-address/:id', userAuth, profileController.deleteAddress)

//product management
router.get('/productDetails', userAuth, productController.productDetails)

//cart management
router.get('/cart', userAuth, cartController.getCartPage)
router.post('/addToCart', userAuth, cartController.addToCart)
router.delete('/removeItem/:id', userAuth, cartController.removeFromCart)
router.patch('/updateQuantity/:id', userAuth, cartController.updateQuantity)

//checkout management
router.get('/checkout', userAuth, checkoutController.loadCheckout)
router.delete('/removeItem/:id', userAuth, checkoutController.removeItem)
router.get('/available-coupons', userAuth, checkoutController.getAvailableCoupons)

//order management
router.post('/place-order', userAuth, orderController.placeOrder)
router.get('/orderDetails/:id', userAuth, orderController.orderDetails)
router.get('/orders', userAuth, orderController.getAllOrders)
router.get('/download-invoice/:id', userAuth, orderController.getInvoice)
router.put('/return-order/:id', userAuth, orderController.returnOrder)
router.post('/order-item-return/:orderId/item/:itemId', userAuth, orderController.returnItemOrder)
router.post('/order/:orderId/item/:itemId', userAuth, orderController.deleteItemOrder)
router.put('/cancel-order/:id', userAuth, orderController.cancelOrder)
router.post('/create-razorpay-order', userAuth, orderController.createRazorpayOrder)
router.post('/verify-payment', userAuth, orderController.verifyPayment)
router.get('/order-confirmed/:id', userAuth, orderController.loadOrderSuccessPage)
router.get('/order-failed', userAuth, orderController.loadOrderFailurePage)
router.post('/apply-coupon', userAuth, orderController.applyCoupon)
router.get('/cancel-coupon', userAuth, orderController.deleteCoupon)


//wishlist management
router.get('/wishlist', userAuth, wishlistController.loadWishlist)
router.post('/add-wishlist', userAuth, wishlistController.addToWishlist)
router.delete('/wishlist/remove/:id', userAuth, wishlistController.removeFromWishlist)
router.post('/wishlistAddToCart', userAuth, wishlistController.addToCartFromWishlist)

//wallet managemnt
router.get('/wallet', userAuth, walletController.loadWalletPage)
router.get('/add-money', userAuth, walletController.getAddMoneyWallet)
router.post('/add-money', userAuth, walletController.addMoneyWallet)
router.post('/verify-wallet-payment', userAuth, walletController.verifyWalletPayment)


module.exports = router