const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Cart = require('../../models/cartSchema')
const getBestOfferPrice = require('../../utils/offerHelper')
const Coupon = require('../../models/couponSchema')


const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
        const addressDoc = await Address.findOne({userId}) 
        const addresses = addressDoc ?. address || []

        const selectedAddress = addresses.length ? addresses[addresses.length - 1]._id : null

        const cartDoc = await Cart.findOne({userId}).populate('items.productId items.variantId')
        const cartItems = cartDoc ?. items || []

        
        const subTotal = cartItems.reduce((acc, curr) => acc + curr.totalPrice, 0)
        console.log("subtotal:",subTotal)
        const deliveryCharge = subTotal > 1000 ? 0 : 40
        const discount = 0
        const tax = Math.round(subTotal * 0.03) //3% tax
        const finalAmount = subTotal + deliveryCharge + tax - discount

        req.session.cartTotal = finalAmount

        res.render('checkout', {
            user,
            addresses,
            selectedAddress,
            cartItems,
            totalAmount:subTotal,
            shippingCharge: deliveryCharge,
            discount,
            tax,
            finalAmount,
            appliedCoupon: req.session.appliedCoupon || null
        })

    } catch (error) {
        console.error("Error while loading checkout page", error)
        res.redirect('/pageNotFound')
    }
    
}

//remove item
const removeItem = async (req, res) => {
    try {
        const productId = req.params.id 
        const userId = req.session.user
        const user = await User.findById(userId).populate({
            path: 'cart',
            populate: {
                path: 'items.productId items.variantId'
            }
        })

        if(!user || !user.cart.length){
            return res.status(404).json({success: false, message: 'Cart not found!'})
        }

        let cartDoc = user.cart[0]
        const itemIndex = cartDoc.items.findIndex(item => item._id.toString() === productId)

        if(itemIndex === -1){
            return res.status(404).json({success: false, message: 'Item not found in the cart'})
        }

        cartDoc.items.splice(itemIndex, 1)
        await cartDoc.save()

        return res.status(200).json({success: true, message : 'Item removed from the cart'})
    } catch (error) {
        console.error('Error while removing item from cart', error)
        return res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//get available coupons
const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user 
        const now = new Date()

        const coupons = await Coupon.find({
            status: true,
            startingDate: {$lte: now},
            expiryDate: {$gte: now}
        }).lean()

        const usableCoupons = coupons.filter(coupon =>{
            const usedCount = coupon.usedUsers.filter(id => id.toString() === userId).length
            return usedCount < coupon.usagePerUser
        })

        res.json({success: true, coupons:usableCoupons})
    } catch (error) {
        console.error('Error while fetching coupon', error)
        res.status(500).json({success: false, message: 'something went wrong'})
    }
}
module.exports = { 
    loadCheckout,
    removeItem,
    getAvailableCoupons
}