const User = require('../../models/userSchema')
const razorpayInstance = require('../../utils/razorpayInstance')
const STATUS = require('../../utils/statusCodes')
const Razorpay = require('razorpay')
const crypto = require('crypto')

const loadWalletPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const search = req.query.search || ''
        const limit = 8
        const skip = (page - 1)*limit
        const userId = req.session.user 
        const user = await User.findById(userId)
        const walletTransactions = user?.walletTransaction || []
        const count = walletTransactions.length
        const totalPages = Math.ceil( count / limit)
        console.log('totalPages:',totalPages)
        const paginatedTransaction = walletTransactions.sort((a, b)=> new Date(b.date) - new Date(a.date)).slice(skip, skip+limit)
        res.render('wallet', { 
            user,
            walletTransactions:paginatedTransaction,
            search,
            currentPage: page,
            totalPages,
            currentPath: req.path
        })
    } catch (error) {
        console.error('Error while loading wallet page', error)
        res.redirect('/pageNotFound')
    }
}

//add money
const getAddMoneyWallet = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
        res.render('add-wallet-money', {user})
    } catch (error) {
        console.error('Error while loading add wallet money page', error)
        res.redirect('/pageNotFound')
    }
}

//add money
const addMoneyWallet = async (req, res) => {
    try {
        const { amount } = req.body

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `wallet_rcpt_${Date.now()}`
        }

        const order = await razorpayInstance.orders.create(options)
        res.json(order)
    } catch (error) {
        console.error('Error creating razorpay order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Failed to create order'})
    }
}

//verify wallet payment
const verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount} = req.body

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`)
        const generatedSignature = hmac.digest('hex')

        if(generatedSignature === razorpay_signature){
            const user = await User.findById(req.session.user)

            //add money
            user.wallet += amount

            user.walletTransaction.push({
                date: new Date(),
                status: "credited",
                amount,
                method: 'razorpay'
            })

            await user.save()

            return res.json({success: true})
        }else{
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: 'Inavalid signature'})
        }
    } catch (error) {
        console.error('wallet payment verification error', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'verification error'})
    }
}
module.exports = {
    loadWalletPage,
    getAddMoneyWallet,
    addMoneyWallet,
    verifyWalletPayment
}