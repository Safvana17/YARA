const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Cart = require('../../models/cartSchema')
const User = require('../../models/userSchema')
const Wishlist = require('../../models/wishlistSchema')
const Category = require('../../models/categorySchema')

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)

        const products = await Product.find({_id: {$in: user.wishlist}}).populate('category')
        const productId = products.map(p => p._id)

        const variants = await ProductVariant.find({productId: {$in: productId}})

        const productsWithVariants = products.map(product =>{
            const matchedVariants = variants.filter(v => {
                return v.productId.toString() === product._id.toString()
            })
            return {
                ...product._doc,
                variants: matchedVariants
            }
        })
        res.render('wishlist',{
            user,
            products: productsWithVariants
        })
    } catch (error) {
        console.error('Error while loading wishlist page', error)
        res.redirect('/pageNotFound')
    }
}

//addto wishlist
const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)

        const productId = req.body.productId
        
        if(user.wishlist.includes(productId)){
            return res.status(400).json({success: false, message: 'Product already exists in wishlist'})
        }

        user.wishlist.push(productId)
        await user.save()

        res.status(200).json({status: true, message: 'Item addedd to wishlist'})

    } catch (error) {
        console.error('Error while adding item to wishlist', error)
        res.status(500).json({success: false, message :'Internal server error'})
    }
}

//remove item from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
        const productId = req.params.id 
        const product = await Product.findById(productId)
        if(!product){
            return res.status(404).json({success: false, message: 'Product not found'})
        }

        if(!user.wishlist.includes(productId)){
            return res.status(404).json({success: false, message: 'Item not found in the wishlist'})
        }

        const index = await user.wishlist.indexOf(productId)
        user.wishlist.splice(index, 1)
        await user.save()

        res.status(200).json({success: true, message :'Product removed from wishlist'})
        
    } catch (error) {
        console.error('Error while removing item from wishlist', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//add to cart
const addToCartFromWishlist = async (req, res) => {
    try{
    const userId = req.session.user
    const {productId, variantId} = req.body

    const product = await Product.findById(productId)
    const variant = await ProductVariant.findById(variantId)

    if(!product || !variant){
        return res.status(404).json({success: false, message: 'Product or variant not found'})
    }

    if(variant.stockQuantity <= 0){
        return res.status(400).json({success: false, message: 'Selected variant is out of stock'})
    }

    const user = await User.findById(userId)
                .populate({
                    path: 'cart',
                    populate: {
                        path: 'items.productId items.variantId',
                    }
                })

    let cartDoc = user.cart[0]
    if(!cartDoc){
        cartDoc = new Cart({userId, items: []})
        await cartDoc.save()
        user.cart.push(cartDoc._id)
        await user.save()
    }

    const existingItem = cartDoc.items.find(
        item => 
            item.productId._id.toString() === productId &&
            item.variantId._id.toString() === variantId)

    if(existingItem){
        if(existingItem.quantity >= 3){
            return res.status(400).json({
                success: false, 
                message: 'Maximum 3 quantity per variant allowed',
                quantity: existingItem.quantity
            })
        }
        if(existingItem.quantity >= variant.stockQuantity){
            return res.status(400).json({success: false, message: 'Not enough stock available', quantity: existingItem.quantity})
        }
        existingItem.quantity += 1
        existingItem.totalPrice = Number(existingItem.quantity) * existingItem.price
        cartDoc.markModified('items')
        await cartDoc.save()
    }else{
        cartDoc.items.push({
            productId,
            variantId, 
            quantity: 1, 
            price: Number(variant.salePrice), 
            totalPrice: Number(variant.salePrice * 1)
        })
        
        await cartDoc.save()
    }
    await cartDoc.populate({
        path: 'items.productId items.variantId'
    })

     user.wishlist = user.wishlist.filter(id => id.toString() !== productId)
     await user.save()
        
    return res.json({
        success: true,
        message: 'Product added to cart',
        cartLength: cartDoc.items.length
    })
}catch(error){
    console.error('Error in add to cart', error)
    return res.status(500).json({success: false, message: 'Internal server error'})
}
}
module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    addToCartFromWishlist
}