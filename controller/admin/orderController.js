const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Coupon = require('../../models/couponSchema')
const PDFDocument = require('pdfkit')


//checking status
function calculateOrderStatus(statuses) {
  if (statuses.every(s => s === 'Cancelled')) return 'Cancelled'
  if (statuses.every(s => s === 'Delivered')) return 'Delivered'
  if(statuses.every(s => s === 'Return Request')) return 'Return Request'
  if(statuses.every(s => s === 'Returned')) return 'Returned'
  if(statuses.some(s => s === 'Delivered')) return 'Partially Delivered '
  if (statuses.includes('Cancelled') && !statuses.every(s => s === 'Cancelled')) return 'Partially Cancelled'
  if (statuses.includes('Returned')) return 'Partially Returned'
  return 'Processing'
}

const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const search = req.query.search || ''
        const limit = 7
        const skip = ( page - 1 ) * limit

        const doc = {}
        if(search){
            doc.$or = [
                {orderId : { $regex: search, $options: 'i'}},
                {status: { $regex: search, $options: 'i'}}
            ]
        }

        const orders = await Order.find(doc)
            .populate('userId', 'name email')
            .sort({ createdAt : -1})
            .skip(skip)
            .limit(limit)

        const count = await Order.find().countDocuments()

        const totalPages = Math.ceil( count / limit )

        res.render('admin-orders',{
            orders,
            currentPage: page,
            totalPages,
            search
        })
    } catch (error) {
        console.error('Error occured during load orders page', error)
        res.redirect('/admin/pageerror')
    }
}

//order details
const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id 
        const order = await Order.findById(orderId)
              .populate('userId', 'name email phone')
              .populate('orderItems.product')
              .populate('orderItems.variant')
        
        if(!order){
            return res.status(404).send('Order not found!')
        }

        const allReturnRequested = order.orderItems.every(item => item.itemStatus === 'Return Request')
        res.render('orderDetails',{order, allReturnRequested})
    } catch (error) {
        console.error('Error while loading order details page', error)
        res.redirect('/admin/pageerror')
    }
}

//update order status
const updateOrderStatus = async (req, res) => {
    try {
        const {orderId, itemId} = req.params
        const {status} = req.body
        const order = await Order.findById(orderId)

        if(!order){
            return res.status(400).json({success: false, message: 'Order not found'})
        }

        if(order.status === 'Cancelled'){
            return res.status(400).json({success: false, message: 'Cannot change the status of cancelled order'})
        }
        const item = order.orderItems.id(itemId)
        if(!item){
            return res.status(404).json({success: false, message: 'Item not found'})
        }
        if(item.itemStatus === 'Cancelled'){
            return res.status(400).json({success: false, message: 'Cannot update cancelled item'})
        }


        const validStatus = ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Returned']

        if(!validStatus.includes(status)){
            return res.status(400).json({success: false, message: 'Invalid status update'})
        }

        // for(let item of order.orderItems){
        //     if(item.itemStatus !== 'Cancelled'){
        //         item.itemStatus = status
        //     }
        // }
        // order.status = status
        item.itemStatus = status
        const statuses = order.orderItems.map(i => i.itemStatus)
        if(statuses.every(s => s === 'Cancelled')) order.status = 'Cancelled'
        else if(statuses.every(s => s === 'Delivered')) order.status = 'Delivered'
        else if(statuses.includes('Delivered')) order.status = 'Partially Delivered'
        else order.status = 'Partially Cancelled'

        await order.save()

        res.status(200).json({success: true, message: 'Order status upadated successfully'})

    } catch (error) {
        console.error('Error while updating the status', error)
        res.status(500).json({success: false, message :'Internal server error'})
    }
}

//download invoice
const getInvoice = async (req, res) => {
    try {
        const orderId  = req.params.id 
        const order = await Order.findById(orderId)
             .populate('userId')
             .populate('orderItems.product')
             .populate('orderItems.variant')
        
        if(!order){
            return res.status(404).send('Order not found')
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        
        const doc = new PDFDocument({ margin: 50 })
        doc.pipe(res)

        //invoice content
        doc.fontSize(24).text('YARA', {align: 'center'})
        doc.fontSize(12).text('yaratly@gmail.com', {align: 'center'})
        doc.fontSize(12).text('Thalassery', {align: 'center'})
        doc.fontSize(12).text('Kannur', {align: 'center'})
        doc.moveDown(2)
        doc.fontSize(18).text('INVOICE', {align: 'center'})
        doc.moveDown(3)

        //order details
            
        doc.fontSize(14).text(`Order ID: ${order.orderId}`);
        doc.fontSize(14).text(`Date: ${order.createdAt.toDateString()}`);
        doc.fontSize(14).text(`Status: ${order.status}`);
        doc.fontSize(14).text(`Customer: ${order.userId.name}`);
        doc.fontSize(14).text(`Email: ${order.userId.email}`);
        doc.fontSize(14).text(`Phone: ${order.userId.phone}`);
        doc.fontSize(14).text(`Address: ${order.address.houseNo}, ${order.address.city}, ${order.address.landMark},${order.address.pinCode}, ${order.address.state}`);
        doc.moveDown();
          
        
        doc.fontSize(16).text('Items:', {underline: true})
        order.orderItems.forEach((item, i) =>{
            doc.fontSize(12).text(`${i + 1}. ${item.product.name} - ${item.variant.size} - Qty: ${item.quantity} - ₹${item.price}`)
        })
        doc.moveDown(2)

       //total
        doc.fontSize(12).text(`Subtotal: Rs.${order.totalPrice}`);
        doc.text(`Discount: Rs.${order.discount}`);
        doc.text(`Delivery Charge: Rs.${order.shippingCharge}`);
        doc.text(`Tax: Rs.${order.tax}`);
        doc.text(`Final Amount: Rs.${order.finalAmount}`);
        doc.text(`Payment Method: ${order.payment}`);
        doc.text(`Order Status: ${order.status}`);
        doc.moveDown(5);
        doc.fontSize(12).text('Thank you for shopping with us!', { align: 'center' }); 
        doc.fontSize(12).text('For any questions or concerns regarding this invoice, please contact our customer support!', { align: 'center' });  
        
        doc.end()
    } catch (error) {
        console.error('Error while downloading invoice', error)
        res.redirect('/admin/pageerror')
    }
}

//approve return
const approveReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.id 
        const order = await Order.findById(orderId)
        const user = await User.findById(order.userId._id)

        if(!order){
            return res.status(404).json({success: false, message: 'Order not found!'})
        }

        if(order.status !== 'Return Request'){
            return res.status(400).json({success: false, message: 'Order is not in return state'})
        }

        //restock product
        for(let item of order.orderItems){
            item.itemStatus = 'Returned'
            const variant = await ProductVariant.findById(item.variant._id)
            if(variant){
                variant.stockQuantity += item.quantity
                await variant.save()
            }
        }

        order.status = 'Returned'
        await order.save()

        //creidit wallet
        const refundAmount = order.finalAmount
        user.wallet += refundAmount

        user.walletTransaction.push({
            amount: refundAmount,
            status: 'credited',
            method: 'refund',
            description: `Refund for returned order ${order.orderId}`
        })

        await user.save()

        
        res.status(200).json({success: true, message: 'Oreder return request approved!'})
    } catch (error) {
        console.error('Error while approving return request', error)
        re.s.status(500).json({success: false, message: 'Internal server error'})
    }
}

//cancel return request
const cancelReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.id 
        const order = await Order.findById(orderId)

        if(!order){
            return res.status(404).json({success: false, message: 'Order not found'})
        }

        if(order.status !== 'Return Request'){
            return res.status(400).json({success: false, message: 'Order not in return state!'})
        }

        for(let item of order.orderItems){
            item.itemStatus = 'Rejected'
        }
        order.status = 'Rejected'
        order.cancelReason = ''
        await order.save()

        res.status(200).json({success: true, message: 'Return request rejected!'})
    } catch (error) {
        console.error('Error while rejecting return request', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//approve return
const approveItemReturnRequest = async (req, res) => {
    console.log('i')
    try {
        const {orderId, itemId} = req.params
        console.log("Route Params:", req.params);
        const order = await Order.findById(orderId)
        const user = await User.findById(order.userId._id)

        if(!order){
            return res.status(404).json({success: false, message: 'Order not found!'})
        }

        const item = order.orderItems.id(itemId)
        if(item.itemStatus !== 'Return Request'){
           return res.status(400).json({success: false, message: 'Order is not in return state'})
        }
        //restock product
        await ProductVariant.findByIdAndUpdate(item.variant, {
            $inc: {stockQuantity: item.quantity}
        })

        item.itemStatus = 'Returned'
       

        //creidit wallet
        const refundAmount = item.price * item.quantity
        user.wallet += refundAmount
        order.finalAmount -= refundAmount

        user.walletTransaction.push({
            amount: refundAmount,
            status: 'credited',
            method: 'refund',
            description: `Refund for returned order ${order.orderId}`
        })

        await Promise.all([order.save(), user.save()])

        order.status = calculateOrderStatus(order.orderItems.map(i => i.itemStatus));
        await order.save();
        
        res.status(200).json({success: true, message: 'Item return request approved!'})
    } catch (error) {
        console.error('Error while approving return request', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//cancel return request
const cancelItemReturnRequest = async (req, res) => {
    try {
        const {orderId, itemId} = req.params
        const order = await Order.findById(orderId)

        if(!order){
            return res.status(404).json({success: false, message: 'Order not found'})
        }

        const item = order.orderItems.id(itemId)
        if(!item){
            return res.status(404).json({success: false, message: 'Item not found'})
        }

        if(item.itemStatus !== 'Return Request'){
            return res.status(400).json({success: false, message: 'Item not in return state!'})
        }

        item.itemStatus = 'Rejected'
        item.itemCancelReason = ''
        await order.save()

        res.status(200).json({success: true, message: 'Return request rejected!'})
    } catch (error) {
        console.error('Error while rejecting return request', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}
module.exports = {
    getOrders,
    viewOrderDetails,
    updateOrderStatus,
    getInvoice,
    approveReturnRequest,
    cancelReturnRequest,
    approveItemReturnRequest,
    cancelItemReturnRequest
}