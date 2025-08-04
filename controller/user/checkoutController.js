const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Cart = require('../../models/cartSchema')
const getBestOfferPrice = require('../../utils/offerHelper')
const Coupon = require('../../models/couponSchema')
const STATUS = require('../../utils/statusCodes')



const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user
        const selectedItemsIds = req.body.selectedItems
        req.session.selectedItemIds = selectedItemsIds
        const selectedIds = Array.isArray(selectedItemsIds)
              ? selectedItemsIds
              : [selectedItemsIds]
        
        const [user, addressDoc, cartDoc] = await Promise.all([ 
            User.findById(userId),
            Address.findOne({userId}),
            Cart.findOne({userId}).populate('items.productId items.variantId')
        ])

        const addresses = addressDoc ?. address || []
        const selectedAddress = addresses.find(addr => addr.isDefault === true)

        const cartItems = cartDoc?.items || []

        //only filtered items
        const filteredItems = cartItems.filter(item => selectedIds.includes(item._id.toString()))

        console.log('selectedAddress:', selectedAddress)
        
        const subTotal = filteredItems.reduce((acc, curr) => acc + curr.totalPrice, 0)
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
            cartItems: filteredItems,
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

const getCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const selectedItemsIds = req.session.selectedItemIds;

        if (!selectedItemsIds || selectedItemsIds.length === 0) {
            return res.redirect('/cart'); // fallback if session expired
        }

        const selectedIds = Array.isArray(selectedItemsIds)
            ? selectedItemsIds
            : [selectedItemsIds];

        const [user, addressDoc, cartDoc] = await Promise.all([
            User.findById(userId),
            Address.findOne({ userId }),
            Cart.findOne({ userId }).populate('items.productId items.variantId'),
        ]);

        const addresses = addressDoc?.address || [];
        const selectedAddress = addresses.find((addr) => addr.isDefault);

        const cartItems = cartDoc?.items || [];
        const filteredItems = cartItems.filter((item) =>
            selectedIds.includes(item._id.toString())
        );

        const subTotal = filteredItems.reduce(
            (acc, curr) => acc + curr.totalPrice,
            0
        );
        const deliveryCharge = subTotal > 1000 ? 0 : 40;
        const discount = 0;
        const tax = Math.round(subTotal * 0.03);
        const finalAmount = subTotal + deliveryCharge + tax - discount;

        req.session.cartTotal = finalAmount;

        res.render('checkout', {
            user,
            addresses,
            selectedAddress,
            cartItems: filteredItems,
            totalAmount: subTotal,
            shippingCharge: deliveryCharge,
            discount,
            tax,
            finalAmount,
            appliedCoupon: req.session.appliedCoupon || null,
        });
    } catch (error) {
        console.error('Error while loading checkout page (GET):', error);
        res.redirect('/pageNotFound');
    }
};


const loadAddaddress = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        console.log('Add address from checkout')
        res.render('addAddress', {user})
    } catch (error) {
        console.error('Error while loading add address page', error)
        res.redirect('/pageNotFound')
    }
}

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)

        let {name, addressType, houseNo, city, state, landMark,pinCode, phone, altPhone, isDefault} = req.body

        isDefault = isDefault === 'on'

        const userAddress = await Address.findOne({userId: userData._id})
        if(isDefault && userAddress){
            // await Address.updateMany({userId}, {'address.isDefault': false})
            userAddress.address.forEach(addr => {
                addr.isDefault = false
            })
        }
        if(!userAddress){
            const newAddress = new Address({
                userId: userData._id,
                address: [{addressType, name, houseNo, city, state, landMark, pinCode, phone, altPhone, isDefault: isDefault || false}]
            })

            await newAddress.save()
        }else{
            userAddress.address.push({addressType, name, houseNo, city, state, landMark, pinCode, phone, altPhone, isDefault: isDefault || false})
            await userAddress.save()
        }
        res.status(STATUS.OK).json({success: true, message: 'Address added successfully.'})
    } catch (error) {
        console.error('Error while adding new address', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
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
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Cart not found!'})
        }

        let cartDoc = user.cart[0]
        const itemIndex = cartDoc.items.findIndex(item => item._id.toString() === productId)

        if(itemIndex === -1){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Item not found in the cart'})
        }

        cartDoc.items.splice(itemIndex, 1)
        await cartDoc.save()

        return res.status(STATUS.OK).json({success: true, message : 'Item removed from the cart'})
    } catch (error) {
        console.error('Error while removing item from cart', error)
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
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
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'something went wrong'})
    }
}

module.exports = { 
    loadCheckout,
    getCheckout,
    loadAddaddress,
    addAddress,
    removeItem,
    getAvailableCoupons,
}