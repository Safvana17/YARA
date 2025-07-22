const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
//customer page
const loadCustomers = async (req, res) => {
    try {
        let search = ''
        if(req.query.search){
            search = req.query.search
        }
        let page = 1
        if(req.query.page){
            page = parseInt(req.query.page)
        }
        let limit = 3
        const user = await User.find({
            isAdmin: false,
            $or: [
                {name: {$regex: ".*" + search + ".*", $options: "i"}},
                {email: {$regex: ".*" + search + ".*", $options: "i"}}
            ]
        })
        .limit(limit)
        .skip(( page - 1 )* limit)
        .exec()

        const count = await User.find({
            isAdmin: false,
            $or: [
                {name: {$regex: ".*" + search + ".*", $options: "i"}},
                {email: {$regex: ".*" + search + ".*", $options: "i"}}
            ]
        }).countDocuments()

        const totalPages = Math.ceil(count / limit)
        res.render('customers',{
            user,
            totalPages,
            currentPage: page,
            limit,
            search,
        })
    } catch (error) {
        console.error('Error while loading user info', error)
        res.status(500).json('Internal server error')
    }
    
}

//block customer
const blockCustomer = async (req, res) => {
    try {
        const id = req.params.id
        await User.updateOne({_id: id},{$set: {isBlocked: true}})
        res.redirect('/admin/customers')
    } catch (error) {
        console.error('Error while blocking user', error)
        res.redirect('/admin/pageerror')
    }
    
}

//unblock user
const unblockCustomer =async (req, res) => {
    try {
        const id = req.params.id
        await User.updateOne({_id: id}, {$set: {isBlocked: false}})
        res.redirect('/admin/customers')
    } catch (error) {
        console.error('Error while unblocking user', error)
        res.redirect('/admin/pageerror')
    }
}

//view specific customer info
const customerInfo = async (req, res) => {
    try {
        const id = req.params.id
        const limit = 10
        const page = parseInt(req.query.page) || 1
        const search = req.query.search || ''
        const skip = (page-1)*limit
        const user = await User.findById(id)
        const addressData = await Address.findOne({userId: id}).lean()
        const orders = await Order.find({userId: id})
              .populate('orderItems.product orderItems.variant')
              .sort({createdAt: -1})
              .lean()
              .skip(skip)
              .limit(limit)

        const count = await Order.find({userId: id}).countDocuments()
        const totalPages = Math.ceil( count / limit )
        // console.log('address:',addressData, 'orders:',orders, 'user:',user)
        res.render('customerinfo',{
            user, 
            addressData, 
            orders,
            search,
            totalPages,
            currentPage: page
        })
    } catch (error) {
        console.error('Error while viewing user info', error)
        res.redirect('/admin/pageerror')
    }
    
}


module.exports = {
    loadCustomers,
    blockCustomer,
    unblockCustomer,
    customerInfo
}