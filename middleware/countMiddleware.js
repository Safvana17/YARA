const Cart = require('../models/cartSchema')
const Wishlist = require('../models/wishlistSchema')
const User = require('../models/userSchema')

const countMiddleware = async (req, res, next) => {
    try {
        if(req.session.user){
            const userId = req.session.user 
            const user = await User.findById(userId)

            const cart = await Cart.findOne({userId})
            const cartCount = cart?.items.length || 0

            //const wishlist = await User.findOne(userId,)
            const wishlistCount = user?.wishlist.length || 0

            res.locals.cartCount = cartCount
            res.locals.wishlistCount = wishlistCount

        }else{
            res.locals.cartCount = 0
            res.locals.wishlistCount = 0
        }

        next()
    } catch (error) {
        console.error('Error in countMiddleware', error)
        res.locals.cartCount = 0
        res.locals.wishlistCount = 0
        next()
    }
}

module.exports = countMiddleware