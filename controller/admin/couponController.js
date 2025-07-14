const Coupon = require('../../models/couponSchema')
const User = require('../../models/userSchema')

const loadCouponPage = async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt : -1 }).lean()
        res.render('coupon', {
            coupons
        })
    } catch (error) {
        console.error('Error while loading coupon page', error)
        res.redirect('/admin/pageerror')
    }
}

//load add coupon page
const loadAddCouponPage = async (req, res) => {
    try {
        res.render('add-coupon')
    } catch (error) {
        console.error('Error while loading add coupon page', error)
        res.redirect('/admin/pageerror')
    }
}

//add coupon
const addCoupon = async (req, res) => {
    try {
        const {code, type, value, minOrderAmount, usageLimit, usagePerUser, startingDate, expiryDate, status } = req.body
        const existing = await Coupon.findOne({code: code.toUpperCase()})
        if(existing){
            return res.status(400).json({success: false, message: 'Coupon already existing'})
        }

        const newCoupon = new Coupon({
           code,
           type,
           value,
           minOrderAmount: minOrderAmount || null,
           usageLimit,
           usagePerUser,
           startingDate,
           expiryDate,
           status
        })

        await newCoupon.save()

        res.status(200).json({success: true, message: 'Coupon added successfully'})
    } catch (error) {
        console.error('Error while adding coupon', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//get edit page
const getEditPage = async (req, res) => {
    try {
        const couponId = req.params.id 
        const coupon = await Coupon.findById(couponId)
        if(!coupon){
            return res.status(404).json({success: false, message: 'Coupon not found!'})
        }
        res.render('edit-coupon',{coupon})
    } catch (error) {
        console.error('Error while loading edit coupon page', error)
        res.redirect('/admin/pageerror')
    }
}

//edit coupon
const editCoupon = async (req, res) => {
    try {
        const couponId = req.params.id 
        const {code, value, type, minOrderAmount, usageLimit, usagePerUser,startingDate, expiryDate, status } = req.body

        const coupon = await Coupon.findById(couponId)
        if(!coupon){
            return res.status(404).json({success: false, message: 'Coupon not found'})
        }

        const existing = await Coupon.findOne({
            code: code.toUpperCase(),
            _id: { $ne: couponId }
        })

        if(existing){
            return res.status(400).json({success: false, message: 'Coupon code already existing'})
        }

        coupon.code = code
        coupon.type = type
        coupon.value = value
        coupon.minOrderAmount = minOrderAmount
        coupon.startingDate = startingDate
        coupon.expiryDate = expiryDate
        coupon.usageLimit = usageLimit
        coupon.usagePerUser = usagePerUser
        coupon.status = status

        await coupon.save()

        res.status(200).json({success: true, message: 'Coupon updated successfully'})
    } catch (error) {
        console.error('Error while updating coupon', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id 
        const coupon = await Coupon.findById(couponId)
        if(!coupon){
            return res.status(404).json({success: false, message: 'Coupon not found'})
        }

        await Coupon.deleteOne({_id: couponId})
        res.status(200).json({ success: false, message: 'Coupon deleted'})
    } catch (error) {
        console.error('Error while deleting coupon', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}
module.exports = {
    loadCouponPage,
    loadAddCouponPage,
    addCoupon,
    getEditPage,
    editCoupon,
    deleteCoupon
}