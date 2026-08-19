const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const User = require('../../models/userSchema')
const STATUS = require('../../utils/statusCodes')
const mongoose = require('mongoose')
const { getFinalOffer} = require('../../utils/getFinalOffer')
const { getProductPrice } = require('../../utils/productPriceCalculator')


const getCartPage = async (req, res) => {
    try {

        const userId = req.session.user

        const user = await User.findById(userId)
            .populate({
                path: 'cart',
                populate: [
                    {
                        path: 'items.productId',
                        populate: {
                            path: 'category',
                            model: 'Category'
                        }
                    },
                    {
                        path: 'items.variantId'
                    }
                ]
            })

        const cartDoc = user.cart[0]

        if (!cartDoc || cartDoc.items.length === 0) {
            return res.render('cart', {
                user,
                cartItems: [],
                totalItems: 0,
                grandTotal: 0,
                deliveryCharge: 0,
                tax: 0,
                finalAmount: 0,
                message: "There is nothing in your cart. Let's add some items."
            })
        }

        const validCartItems = []

        for (let i = cartDoc.items.length - 1; i >= 0; i--) {

            const item = cartDoc.items[i]

            // Invalid variant
            if (!item.variantId) {
                cartDoc.items.splice(i, 1)
                continue
            }

            // Out of stock
            if (item.variantId.stockQuantity === 0) {
                cartDoc.items.splice(i, 1)
                continue
            }

            // Quantity exceeds stock
            if (item.quantity > item.variantId.stockQuantity) {
                item.quantity = item.variantId.stockQuantity
            }

            // Invalid product
            if (
                !item.productId ||
                item.productId.isBlocked ||
                !item.productId.category?.isListed
            ) {
                continue
            }

            // --------------------------------
            // GET CURRENT OFFER
            // --------------------------------

            const finalOffer = getFinalOffer(item.productId)

            const { finalPrice } = getProductPrice(
                item.productId,
                finalOffer
            )

            // --------------------------------
            // UPDATE CURRENT CART PRICE
            // --------------------------------

            item.price = finalPrice
            item.totalPrice = finalPrice * item.quantity

            validCartItems.push(item)
        }

        await cartDoc.save()

        // --------------------------------
        // CART TOTAL
        // --------------------------------

        const grandTotal = validCartItems.reduce(
            (total, item) => total + Number(item.totalPrice),
            0
        )

        const totalItems = validCartItems.reduce(
            (total, item) => total + item.quantity,
            0
        )

        const deliveryCharge = grandTotal > 1000 ? 0 : 40

        const tax = Math.round(grandTotal * 0.03)

        const discount = 0

        const finalAmount =
            grandTotal +
            deliveryCharge +
            tax -
            discount

        req.session.cartTotal = grandTotal

        res.render('cart', {
            user,
            cartItems: validCartItems,
            totalItems,
            deliveryCharge,
            totalAmount: grandTotal,
            tax,
            finalAmount,
            message: ''
        })

    } catch (error) {

        console.error(
            'error while loading cart page',
            error
        )

        res.redirect('/pageNotFound')
    }
}

//add to cart
const addToCart = async (req, res) => {
    try{
    const userId = req.session.user
    const {productId, variantId} = req.body

    const [product, variant] = await Promise.all([ 
        Product.findById(productId).populate('category'),
        ProductVariant.findById(variantId)
    ])

    if(!product || !variant){
        return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Product or variant not found'})
    }

    if(variant.stockQuantity <= 0){
        return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Selected variant is out of stock'})
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
            return res.status(STATUS.BAD_REQUEST).json({
                success: false, 
                message: 'Maximum 3 quantity per variant allowed',
                quantity: existingItem.quantity
            })
        }
        if(existingItem.quantity >= variant.stockQuantity){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Not enough stock available', quantity: existingItem.quantity})
        }
        existingItem.quantity += 1
        existingItem.totalPrice = Number(existingItem.quantity) * existingItem.price
        cartDoc.markModified('items')
        await cartDoc.save()
    }else{
        const finalOffer = getFinalOffer(product)
        const { originalPrice, finalPrice } = getProductPrice(product, finalOffer)
        console.log("final price: ", finalOffer, finalPrice, product)
        cartDoc.items.push({
            productId,
            variantId, 
            quantity: 1, 
            price: finalPrice, 
            totalPrice: finalPrice
        })
        
        await cartDoc.save()
    }
        await cartDoc.populate({
            path: 'items.productId items.variantId'
        })

        
    return res.json({
        success: true,
        message: 'Product added to cart',
        cartLength: cartDoc.items.length
    })
}catch(error){
    console.error('Error in add to cart', error)
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
}
}

//remove from cart
const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user
        const productId = req.params.id 

        const user = await User.findById(userId)
                .populate({
                    path: 'cart',
                    populate: {
                        path: 'items.productId items.variantId',
                    }
                })
        if(!user || !user.cart.length){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Cart not found!'})
        }

        let cartDoc = user.cart[0]
        const index = cartDoc.items.findIndex(item =>
             item._id.toString() === productId)
        
        if(index === -1){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Product not found in the cart!'})
        }


        cartDoc.items.splice(index, 1)
        await cartDoc.save()

        return res.status(STATUS.OK).json({success: true, message: 'Product removed successfully from cart'})
    } catch (error) {
        console.error('Error while removing item from the cart')
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'An error occured while removing item from the cart.'})
    }
}

//update quantity
const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user
        const productId = req.params.id
        const {change} = req.body

        const user = await User.findById(userId).populate({
            path: 'cart',
            populate: {
                path: 'items.productId items.variantId'
            }
        })


        const cartDoc = user.cart[0]
        const item = cartDoc.items.id(productId)
        if(!item){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Item not found in the cart!'})
        }

        const stock = item.variantId.stockQuantity
        const currentQty = item.quantity
        const newQty = currentQty + change

        //check limits
        if(newQty < 1){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Minimum quantity is 1'})
        }
        if(newQty > 3){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Maximum 3 quantity per product variant allowed'})
        }
        if(newQty > stock){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Only' + stock + 'is available'})
        }

        //update and save
        console.log("from update quantity: ", newQty, item, )
        item.quantity = newQty
        item.totalPrice = item.price * newQty

        cartDoc.markModified('items')
        await cartDoc.save()

        const updatedTotal = cartDoc.items.reduce((acc, curr) => acc + curr.totalPrice, 0)

        req.session.cartTotal = updatedTotal
        return res.status(STATUS.OK).json({
            success: true,
            newQuantity: item.quantity,
            itemTotal: item.totalPrice,
            grandTotal: updatedTotal
        })
    } catch (error) {
        console.error('Error while updating quantity', error)
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}
module.exports = {
    getCartPage,
    addToCart,
    removeFromCart,
    updateQuantity
}