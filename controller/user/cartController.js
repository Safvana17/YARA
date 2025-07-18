const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const User = require('../../models/userSchema')
const mongoose = require('mongoose')


const getCartPage = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
                .populate({
                    path: 'cart',
                    populate: [{
                        path: 'items.productId',
                        populate: {
                            path: 'category',
                            model: 'Category'
                        }
                    },
                    {
                        path: 'items.variantId',
                    }]
                })

                console.log("username2:",user.name)
        const cartDoc = user.cart[0]
        if(!cartDoc || cartDoc.items.length === 0){
            return res.render('cart', {
                user,
                cartItems: [],
                grandTotal: 0,
                message: "There is nothing in your cart. Let's add some items."
            })
        }

        const validCartItems = []
        for(let i= cartDoc.items.length-1; i>=0; i--){
            const item = cartDoc.items[i]

            if(!item.variantId || (item.variantId.stockQuantity === 0 || item.quantity > item.variantId.stockQuantity)){
                if(item.variantId && item.variantId.stockQuantity === 0){
                    cartDoc.items.splice(i, 1)
                }else if(item.variantId){
                    item.quantity = item.variantId.stockQuantity
                    item.totalPrice = item.price * item.quantity;
                }
            }else if( 
                item.productId &&
                !item.productId.isBlocked &&
                item.productId.category?.isListed &&
                item.variantId.stockQuantity > 0
              ){
                validCartItems.push(item)
            }
        }

        
        await cartDoc.save()


       const grandTotal = validCartItems.reduce((total, item) => total + item.totalPrice, 0)
       const totalItems = validCartItems.reduce((total, item) => total + item.quantity, 0)
       console.log("total:", grandTotal)
       console.log("items:", totalItems)


       req.session.cartTotal = grandTotal


       console.log("username1:",user.name)
       res.render('cart', {
        user,
        cartItems: validCartItems,
        totalItems,
        totalAmount: grandTotal,
        message: ''
       })
    } catch (error) {
        console.error('error while loading cart page', error)
        res.redirect('/pageNotFound')
    }
}

//add to cart
const addToCart = async (req, res) => {
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
            price: Number(product.salePrice), 
            totalPrice: Number(product.salePrice * 1)
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
    return res.status(500).json({success: false, message: 'Internal server error'})
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
            return res.status(404).json({success: false, message: 'Cart not found!'})
        }

        let cartDoc = user.cart[0]
        const index = cartDoc.items.findIndex(item =>
             item._id.toString() === productId)
        
        if(index === -1){
            return res.status(404).json({success: false, message: 'Product not found in the cart!'})
        }


        cartDoc.items.splice(index, 1)
        await cartDoc.save()

        return res.status(200).json({success: true, message: 'Product removed successfully from cart'})
    } catch (error) {
        console.error('Error while removing item from the cart')
        return res.status(500).json({success: false, message: 'An error occured while removing item from the cart.'})
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
            return res.status(404).json({success: false, message: 'Item not found in the cart!'})
        }

        const stock = item.variantId.stockQuantity
        const currentQty = item.quantity
        const newQty = currentQty + change

        //check limits
        if(newQty < 1){
            return res.status(400).json({success: false, message: 'Minimum quantity is 1'})
        }
        if(newQty > 3){
            return res.status(400).json({success: false, message: 'Maximum 3 quantity per product variant allowed'})
        }
        if(newQty > stock){
            return res.status(400).json({success: false, message: 'Only' + stock + 'is available'})
        }

        //update and save
        item.quantity = newQty
        item.totalPrice = item.price * newQty

        cartDoc.markModified('items')
        await cartDoc.save()

        const updatedTotal = cartDoc.items.reduce((acc, curr) => acc + curr.totalPrice, 0)

        req.session.cartTotal = updatedTotal
        return res.status(200).json({
            success: true,
            newQuantity: item.quantity,
            itemTotal: item.totalPrice,
            grandTotal: updatedTotal
        })
    } catch (error) {
        console.error('Error while updating quantity', error)
        return res.status(500).json({success: false, message: 'Internal server error'})
    }
}
module.exports = {
    getCartPage,
    addToCart,
    removeFromCart,
    updateQuantity
}