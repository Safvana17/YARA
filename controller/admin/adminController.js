const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const bcrypt = require('bcrypt')
const moment = require('moment')
const {generatePDF, generateExcel } = require('../../utils/reportUtils')

const loadLogin = async (req, res) => {
    try {
        res.render('admin-login')
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
}
//admin login
const login = async (req, res) => {
    try {
        const {email, password} = req.body
        const admin = await User.findOne({email: email, isAdmin: true})
        if(admin){
            const passMatch = await bcrypt.compare(password, admin.password)
            if(passMatch){
                req.session.admin = true
                req.session.adminId = admin._id
                return res.redirect('/admin')
            }else{
                return res.redirect('/admin/login')
            }
        }else{
            return res.redirect('/admin/login')
        }
    } catch (error) {
        console.error('Error while admin login', error)
        return res.redirect('/admin/pageerror')
    }
}
// //dashbord
// const loadDashboard = async (req, res) => {
//    if(req.session.admin){
//     try {
//         res.render('dashboard')
//     } catch (error) {
//         res.redirect('/admin/pageerror')
//     }
//    }
// }

//logout
const logout = async (req, res) => {
    try {
        req.session.destroy((err) =>{
            if(err){
                console.error('Error while logout', err)
                res.redirect('/admin/pageerror')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.error('Error during logout', error)
        res.redirect('/admin/pageerror')
    }
}

//page error
const pageError = async (req, res) => {
    res.render('admin-error')
}


//sales report
const getReport = async (req, res) => {
    try {

        const page = req.query.page || 1
        const search = req.query.search || ''
        const limit = 10
        const skip = ( page - 1 ) * limit
        const {rangeType, startDate, endDate, format } = req.query 
        const matchedQuery = {status:  {$nin: ['Returned', 'Cancelled', 'Processing' ] } }

        if(rangeType === 'custom' && startDate && endDate){
            matchedQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23,59,59,999))
            }
        }else if( rangeType === 'day'){
            const today = moment().startOf('day')
            matchedQuery.createdAt = {
                $lte: moment(today).endOf('day').toDate(), $gte: today.toDate()
            }
        }else if(rangeType === 'week'){
            matchedQuery.createdAt = {
                $gte: moment().startOf('week').toDate(),
                $lte: moment().endOf('week').toDate()
            }
        }else if(rangeType === 'month'){
            matchedQuery.createdAt = {
                $gte: moment().startOf('month').toDate(),
                $lte: moment().endOf('month').toDate()
            }
        }

        let orderQuery = Order.find(matchedQuery)
              .populate('userId')
              .populate('orderItems.product')
              .populate('orderItems.variant')
              .sort({createdAt: -1})

        const orders = await orderQuery
        let totalSale = orders.length
        let totalAmount = 0
        let totalDiscount = 0
        let totalOffer = 0

        const salesData = orders.map(order => {
             let orderTotal = order.finalAmount || 0
             let discount = order.discount || 0
             let offer = 0

             order.orderItems.forEach(item =>{
                const product = item.product
                const quantity = item.quantity
                if(product?.regularPrice && product?.salePrice){
                    const offerAmount = (product.regularPrice - product.salePrice) * quantity
                    offer += offerAmount
                }
             })

             totalAmount += orderTotal
             totalDiscount += discount
             totalOffer += offer
        if(!format){
            orderQuery = orderQuery.skip(skip).limit(limit)
        }
             return {
                orderId: order.orderId,
                user: order.userId.name,
                date: moment(order.createdAt).format('YYYY-MM-DD'),
                totalAmount: orderTotal,
                discount: discount,
                payment: order.payment,
                offer: offer
             }
        })

        //download logic
        if(format === 'pdf'){
            return generatePDF(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer)
        }else if(format === 'excel'){
            return generateExcel(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer)
        }

        //pagination
        const count = await Order.find(matchedQuery).countDocuments()
        const totalPages = Math.ceil( count / limit )

        res.render('salesReport',{
            salesData,
            totalSale,
            totalAmount,
            totalDiscount,
            totalOffer,
            currentPage: page,
            totalPages,
            search,
            rangeType,
            startDate,
            endDate
        })
    } catch (error) {
        console.error('Error while loading sales report page', error)
        res.redirect('/admin/pageerror')
    }
}




module.exports = {
    loadLogin,
    login,
    logout, 
    pageError,
    getReport
}