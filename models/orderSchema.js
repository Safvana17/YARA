const mongoose = require('mongoose')
const {Schema} = mongoose
const {v4:uuidv4} = require('uuid')

const orderSchema = new Schema({
    orderId: {
        type:String,
        default: ()=>uuidv4(),
        unique: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variant: {
           type: Schema.Types.ObjectId,
           ref: 'ProductVariant',
           required: true
        },
        quantity: {
            type:Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        itemStatus: {
            type: String,
            default: 'Confirmed'
        },
        itemCancelReason: {
            type: String,
            default: ''
        }

    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        required: true
    },
    shippingCharge: {
        type: Number,
        required: true
    },
    finalAmount: {
        type:Number,
        required: true
    },
    address: {
        type: Schema.Types.Mixed,
        //ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ["Pending","Processing","Shipped","Delivered","Failed","Cancelled","Return Request","Returned","Rejected","Out for delivery", "Partially Cancelled", "Partially Returned"],
    },
    cancelReason: {
        type: String
    },
    payment: {
    type: String,
    enum: ["cod", "wallet", "razorpay"],
    default: "cod",
    },
    createdAt: {
        type: Date,
        default:Date.now,
        required: true
    },
    appliedCoupon: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    }
})


const Order = mongoose.model("Order",orderSchema)

module.exports = Order