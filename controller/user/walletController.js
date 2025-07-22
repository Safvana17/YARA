const User = require('../../models/userSchema')
const razorpayInstance = require('../../utils/razorpayInstance')
const Razorpay = require('razorpay')
const crypto = require('crypto')

const loadWalletPage = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
        res.render('wallet', { user})
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
        res.status(500).json({success: false, message: 'Failed to create order'})
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
            return res.status(400).json({ success: false, message: 'Inavalid signature'})
        }
    } catch (error) {
        console.error('wallet payment verification error', error)
        res.status(500).json({success: false, message: 'verification error'})
    }
}
module.exports = {
    loadWalletPage,
    getAddMoneyWallet,
    addMoneyWallet,
    verifyWalletPayment
}