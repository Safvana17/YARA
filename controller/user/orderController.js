const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Product =require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Order = require('../../models/orderSchema')
const Notification = require('../../models/notificationSchema')
const Coupon = require('../../models/couponSchema')
const razorpayInstance = require('../../utils/razorpayInstance')
const STATUS = require('../../utils/statusCodes')
const puppeteer = require('puppeteer')
const path = require('path')
const ejs = require('ejs')
const fs = require('fs')
const Razorpay = require('razorpay')
const crypto = require('crypto')
const { count } = require('console')
const mongoose = require('mongoose')
const nodemailer = require('nodemailer')


//send refund email
async function sendRefundEmail(paymentId, amount, email) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            },
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: `Refund Initiated`,  
            html:`
              <p>Hi,</p>
              <p>We have initiated your refund of ₹${(amount / 100 ).toFixed(2)} for payment ID: <strong>${paymentId}</strong>.</p>
              <p>The amount will reflect in your account within 5-7 working days.</p>
              <p>Thank you for choosing us.</p>          
              `,
        })
        return info.accepted.length > 0
    } catch (error) {
        console.error('error while sending refund email',error)
    }
}
//create razorpay order
const createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body
        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt:`receipt_order_${Date.now()}`
        }

        const order = await razorpayInstance.orders.create(options)
        res.json(order)
    } catch (error) {
        console.error("Razorpay order error", error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Razorpay order creation failed'})
    }
}

//checking status
function calculateOrderStatus(statuses) {
  if (statuses.every(s => s === 'Cancelled')) return 'Cancelled'
  if (statuses.every(s => s === 'Delivered')) return 'Delivered'
  if(statuses.every(s => s === 'Return Request')) return 'Return Request'
  if(statuses.every(s => s === 'Returned')) return 'Returned'
  if(statuses.some(s => s === 'Delivered')) return 'Partially Delivered'
  if (statuses.includes('Cancelled') && !statuses.every(s => s === 'Cancelled')) return 'Partially Cancelled'
  if (statuses.includes('Returned')) return 'Partially Returned'
  return 'Processing'
}


//verify payment
const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body

        const generateSignature = crypto
              .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
              .update(`${razorpay_order_id}|${razorpay_payment_id}`)
              .digest('hex')

        if(generateSignature === razorpay_signature){
            res.status(STATUS.OK).json({success: true})
        }else{
            res.status(STATUS.BAD_REQUEST).json({ success: false, message: 'Payment verification failed'})
        }
    } catch (error) {
        console.error('Payment verification error', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'internal server error'})
    }
}

//place order
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user 
        const {selectedAddress, payment, razorpay_payment_id, finalAmount, selectedItemIds} = req.body

         delete req.session.selectedItemIds
        if(!selectedItemIds){
            return res.status(STATUS.BAD_REQUEST).json({sucess: false, message: 'No item selected'})
        }

        const [user, addressDoc, cartDoc] = await Promise.all([
            User.findById(userId),
            Address.findOne({userId}),
            Cart.findOne({userId}).populate('items.productId items.variantId')
        ])


        const address = addressDoc?.address.id(selectedAddress)
        if(!address){
            return res.status(STATUS.NOT_FOUND).json({success: false, message :'Address is not selected!'})
        }

        if(!cartDoc || !cartDoc.items.length){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Cart is empty'})
        }

        const selectedCartItems = cartDoc.items.filter(item => 
            selectedItemIds.includes(item._id.toString())
        )
        //get cart data
        // const cartItems = cartDoc ?. items || []

        if(!selectedCartItems.length){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Selected items not in the cart'})
        }

        //validate and prepare order
        const orderItems = []
        let subTotal = 0

        for(let item of selectedCartItems){
            if(item.quantity > item.variantId.stockQuantity){
                // console.log("Payment method received:", payment);
                // console.log("razorpay_payment_id:", razorpay_payment_id);

                if(payment === 'razorpay' && razorpay_payment_id){
                    console.log("Initiating refund for paymentId:", razorpay_payment_id, "Amount:", finalAmount*100);
                    console.log('online payment')
                    await refundRazorpayPayment(razorpay_payment_id, finalAmount*100, user )
                }
                // console.log('online payment2')
                return res.status(STATUS.BAD_REQUEST).json({success: false, message :`Insuffiecient stock for product ${item.productId.name}`})
            }

            orderItems.push({
                product: item.productId._id,
                variant : item.variantId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice
            })
            subTotal += item.totalPrice
        }

        const shippingCharge = subTotal > 1000 ? 0 : 40

        let appliedCoupon = null
        let discount= 0
        if(req.session.appliedCoupon){
            discount = req.session.appliedCoupon.discount || 0
            appliedCoupon = req.session.appliedCoupon.couponId
            const objectUserId =new mongoose.Types.ObjectId(userId)

            const coupon = await Coupon.findById(appliedCoupon)
            if(coupon){
                coupon.usedCount += 1

                const userEntry = coupon.usedUsers.find(entry => entry?.userId.toString() === userId.toString())
                
                if(userEntry){
                    userEntry.count += 1
                }else{
                    coupon.usedUsers.push({userId, count: 1})
                }

                await coupon.save()
            }
        }

        const tax = Math.round(subTotal * 0.03)
        const totalAmount = shippingCharge + subTotal + tax - discount

        //handle wallet deduction
        if(payment === 'wallet'){
              console.log(' Entered wallet payment block')
            try{
              if(user.wallet < totalAmount) {
                  console.log(' Entered wallet payment block1')
                return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Insufficient wallet amount'})
              }

              console.log(' Entered wallet payment block2')
              user.wallet -= totalAmount

            //save wallet transaction
         user.walletTransaction.push({
                
                date: Date.now(),
                amount: totalAmount,
                status: 'debited',
                method: "order"
            })

             await user.save()

            //  console.log('Wallet before deduction:', user.wallet + totalAmount)
            //  console.log('Wallet after deduction:', user.wallet)
            //  console.log('Saving wallet transaction...')

        }catch(error){
           console.error('Error in wallet selection', error)
           return res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: ' wallet processing error'})
        }
    }
    


        //create order
        const newOrder = new Order({
            userId,
            user,
            address: address.toObject(),
            orderItems: orderItems,
            payment,
            status: 'Processing',
            totalPrice: subTotal,
            shippingCharge,
            tax,
            discount,
            finalAmount: totalAmount,
            appliedCoupon
        })

        await newOrder.save()

        if(req.session.appliedCoupon){
            delete req.session.appliedCoupon
        }

        //decrease stock
        await Promise.all(orderItems.map(item => 
            ProductVariant.findByIdAndUpdate(item.variant,{
                $inc : {stockQuantity: -item.quantity}
            })
        ))

        //clear cart
        console.log('Selected Cart Items:', selectedCartItems)  // Should be array of strings

        const selectedItemIdsToRemove = selectedCartItems.map(item => item._id.toString())
        cartDoc.items = cartDoc.items.filter(item => 
            !selectedItemIdsToRemove.includes(item._id.toString())
        )
        await cartDoc.save()

        res.status(STATUS.OK).json({success: true, message: 'Order placed', orderId: newOrder._id, user})
    } catch (error) {
        console.error(' Error while making an order:', error.message);
        console.error(error.stack);
        console.error('Error while making an order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR ).json({success: false, message: 'Internal server error'})
    }

}

const refundRazorpayPayment = async (paymentId, amount, user) => {
  try {
    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount: amount
    });

    // await Notification.create({
    // message: `₹${(amount / 100).toFixed(2)} has been refunded successfully. The amount will reflect in your account within 5 - 7 working days.`
    // });
    const mailSent = await sendRefundEmail(paymentId, amount, user.email)
    if(mailSent){
        console.log('Email send successfully')
    }else{
        console.log('Not send email')
    }
    console.log('Refund successful:', refund);
  } catch (err) {
    console.error('Refund failed:', err);
    throw new Error('Refund failed');
  }
}



//order success page
const loadOrderSuccessPage = async (req, res) => {
    try {
        const userId = req.session.user 
        const orderId = req.params.id 

        const [user, order] = await Promise.all([
            User.findById(userId),
            Order.findOne({_id: orderId}).populate('orderItems.product orderItems.variant')
        ])

        if(!order){
            return res.status(STATUS.NOT_FOUND).json({ success: false, message: 'Order not found'})
        }

        res.render('order-success', { order, user })
    } catch (error) {
        console.error('Error while loading order success page', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}

//order failure page
const loadOrderFailurePage = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
        const message = req.query.message || 'Something went wrong'
        res.render('order-failed',{user, message} )
    } catch (error) {
        console.error('Error while loading order success page', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}
//order details
const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user 
        const orderId = req.params.id 

        const [user, order] = await Promise.all([
            User.findById(userId),
            Order.findOne({_id: orderId, userId}).populate('orderItems.product orderItems.variant').lean()
        ])

       
        if(!order){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Order not found'})
        }
        console.log(order)
        res.render('order-details', {
            user,
            order
        })
    } catch (error) {
        console.error('Error while loading order details page', error)
        res.redirect('/pageNotFound')
    }
}

//get all orders
const getAllOrders = async (req, res) => {
    try {
        const userId = req.session.user 

        const search = req.query.search || ''
        const page = parseInt(req.query.page) || 1
        const limit = 8
        const skip = (page - 1)*limit

        const [user, orders] = await Promise.all([
            User.findById(userId),
            Order.find({userId})
                .populate('orderItems.product orderItems.variant')
                .sort({ createdAt : -1 })
                .skip(skip)
                .limit(limit)
        ])

        const totalOrders = await Order.find({ userId }).countDocuments()
        const totalPages = Math.ceil( totalOrders / limit )
    

        res.render('orders', {
            orders: orders,
            user: user,
            currentPage: page,
            totalPages,
            search,
            currentPath: req.path
        })

    } catch (error) {
        console.error('Error while loading orders page', error)
        res.redirect('/pageNotFound')
    }
}

//get invoice
const getInvoice = async (req, res) => {
    try {
        const userId = req.session.user
        const orderId = req.params.id 
        const user = await User.findById(userId)

        const order = await Order.findOne({_id: orderId, userId}).populate('orderItems.product orderItems.variant')
        if(!order){
            return res.status(404).send('Order not found')
        }
        if(order.status !== 'Delivered'){
            return res.status(STATUS.BAD_REQUEST).send('Invoice is only available for delivered item!.')
        }

        console.log(order.orderItems[0].product.productImage[0])
        if(!order.invoiceDate){
            order.invoiceDate = new Date()
            await order.save()
        }

        //launch the browser and open a new blank page
        const browser = await puppeteer.launch()
        const page = await browser.newPage()

        //render ejs invoice to html string
        const invoicePath = path.join(__dirname,'../../views/user/invoice.ejs')
        const html = await ejs.renderFile(invoicePath, { order })

        //set content and generate pdf
        await page.setContent(html, { waitUntil: 'networkidle0' })

        const invoiceDir = path.join(__dirname, "../../public/invoices")
        if(!fs.existsSync(invoiceDir)){
            fs.mkdirSync(invoiceDir, {recursive: true})
        }

        const fileName = `invoice-${order.orderId}.pdf`
        const filePath = path.join(invoiceDir, fileName)

        //send the pdf file
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        })

        await browser.close()

        res.download(filePath, fileName, (err) =>{
            if(err){
                console.error('Error sending file', err)
                res.status(500).send("Error generating invoice")
            }
        })
    } catch (error) {
        console.error('Error generating invoice', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).send('Error generating invoice')
    }
}

//return order
const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user
        const {reason } = req.body
        const orderId = req.params.id

        const [user, order] = await Promise.all([
            User.findById(userId),
            Order.findOne({_id: orderId, userId})
        ])

        if(!order){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Order not found!'})
        }
        if(['returned'].includes(order.status)){
             return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Order Alredy returned.'})
        }

        for(let item of order.orderItems){
            item.itemStatus = 'Return Request'
        }

        order.status = 'Return Request'
        order.cancelReason = reason
        await order.save()

        await Notification.create({
            message: `Return requested for entire order (${orderId}) by ${user.name}`
        })

        return res.status(STATUS.OK).json({success: true, message: 'Order return request submitted'})
    } catch (error) {
        console.error('Error while cancelling order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}

//cancel order
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user
        const {reason} = req.body
        const orderId = req.params.id

        const [user, order] = await Promise.all([
            User.findById(userId),
            Order.findOne({_id: orderId, userId})
        ])

        if(!order){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Order not found'})
        }

        if(['Cancelled', 'Delivered'].includes(order.status)){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Delivered order cannot be cancelled'})
        }

        for(let item of order.orderItems){
            if(item.itemStatus !== 'Cancelled'){
            item.itemStatus = 'Cancelled'
            const variant = await ProductVariant.findById(item.variant._id)
            if(variant){
                variant.stockQuantity += item.quantity
                await variant.save()
            }
        }
        }

        order.status = 'Cancelled'
        order.cancelReason = reason
        await order.save()

        if(order.payment === 'razorpay' || order.payment === 'wallet'){
            const refundAmount = order.finalAmount
            user.wallet += refundAmount

            user.walletTransaction.push({
                amount: refundAmount,
                status: 'credited',
                method: 'refund',
                description: `Refund for ${order.status.toLowerCase()} order ${order.orderId}.`
            })

            await user.save()
        }


        res.status(STATUS.OK).json({success: true, message: 'Order cancelled!'})
    } catch (error) {
        console.error('Error while cancelling order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}

//apply coupon
const applyCoupon = async (req, res) => {
    try {
        const {code} = req.body
        const userId = req.session.user.toString()
        console.log("code:", code)
        const coupon = await Coupon.findOne({code: code.toUpperCase(), status: true})
        console.log('coupons:', coupon)
        if(!coupon){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Invalide coupon code'})
        }

        const now = new Date()
        if(now < coupon.startingDate || now > coupon.expiryDate){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Coupon is not active'})
        }

        
        if( coupon.usedCount >= coupon.usageLimit){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: `Coupon usage limite exceeded`})
        }

        const userUsage = coupon.usedUsers.find(entry => entry.userId?.toString() === userId)
        const userUsedCount = userUsage ? userUsage.count : 0
        if(userUsedCount >= coupon.usagePerUser){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: `you already used this coupon ${coupon.usagePerUser} times`})
        }

        const cartTotal = req.session.cartTotal 
        if(cartTotal < coupon.minOrderAmount){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: `Minimum order ₹${coupon.minOrderAmount}`})
        }

        const discount = coupon.type === 'percentage' ? Math.floor(cartTotal * coupon.value / 100) : coupon.value
        
        const newTotal = cartTotal - discount
        req.session.appliedCoupon = {
            code: coupon.code,
            discount,
            couponId: coupon._id 
        }
        res.status(STATUS.OK).json({discount, newTotal})

    } catch (error) {
        console.error('Error while applying coupon', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({message: 'Something went wrong'})
    }
}
//remove coupon 
const deleteCoupon = async (req, res) => {
    try {
        delete req.session.appliedCoupon
        res.sendStatus(STATUS.OK)
    } catch (error) {
        console.error('Error while deleting coupon', error)
        res.sendStatus(STATUS.INTERNAL_SERVER_ERROR)
    }
}

//delte item order
const deleteItemOrder = async (req, res) => {
    try {
        const userId = req.session.user
        const {orderId, itemId} = req.params
        const {reason} = req.body

        const [user, order ] = await Promise.all([
               User.findById(userId),
               Order.findById(orderId)
        ])

        if(!order){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Order not found!'})
        }

        const item = await order.orderItems.id(itemId)
        if(!item){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Item not found!'})
        }

        if (item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: 'Item already cancelled or returned.' });
        }

        await ProductVariant.findByIdAndUpdate(item.variant,{
          $inc: { stockQuantity: item.quantity}
        })


        item.itemStatus = 'Cancelled'
        item.itemCancelReason = reason
       

        if(order.payment === 'razorpay' || order.payment === 'wallet' ){
            const refundAmount = item.price * item.quantity
            user.wallet += refundAmount
            order.finalAmount -= refundAmount

            user.walletTransaction.push({
                amount: refundAmount,
                status: 'credited',
                method: 'refund',
                description: `Refund for ${order.status.toLowerCase()} order ${order.orderId}.`
            })

            await Promise.all([user.save(), order.save()])
        }else{
            await order.save()
        }

        // Recalculate overall orderStatus
        order.status = calculateOrderStatus(order.orderItems.map(i => i.itemStatus));
        await order.save();

        res.status(STATUS.OK).json({success: true, message: 'Order cancelled'})
    } catch (error) {
        console.error('Error while cancelling item from order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}

//return item
const returnItemOrder = async (req, res) => {
    try {
        const userId = req.session.user
        const {reason } = req.body
        const {orderId, itemId} = req.params
        const [order, user ] = await Promise.all([
            Order.findOne({_id: orderId, userId}),
            User.findById(userId)
        ])
        
        if(!order){
            return res.status(STATUS.NOT_FOUND).json({success: false, message: 'Order not found!'})
        }
        const item = await order.orderItems.id(itemId)
        if(['returned'].includes(item.itemStatus)){
             return res.status(STATUS.BAD_REQUEST).json({success: false, message: 'Order Alredy returned.'})
        }

        item.itemStatus = 'Return Request'
        item.itemCancelReason = reason
        await order.save()


        // Recalculate overall orderStatus
        order.status = calculateOrderStatus(order.orderItems.map(i => i.itemStatus));
        await order.save();

        const product = await Product.findById(item.product)
        

        await Notification.create({
            message: `Return requested for item (${product.name}) in order ${orderId.slice(-6)} by ${user.name}`
        })

        return res.status(STATUS.OK).json({success: true, message: 'Order return request submitted'})
    } catch (error) {
        console.error('Error while cancelling order', error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal server error'})
    }
}

module.exports = {
    placeOrder,
    orderDetails,
    getAllOrders,
    getInvoice,
    returnOrder,
    cancelOrder,
    createRazorpayOrder,
    verifyPayment,
    loadOrderSuccessPage,
    loadOrderFailurePage,
    applyCoupon,
    deleteCoupon,
    deleteItemOrder,
    returnItemOrder
}