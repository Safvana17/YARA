const mongoose = require('mongoose')
const {Schema} = mongoose

const cartSchema = new Schema({
    userId: {
        type:Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            required: true
        },
        quantity:{
            type: Number,
            default: 1
        },
        price: {
            type:String,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default:"Placed",
        },
        cancellationReason: {
            type: String,
            default: "none"
        }
    }],
})


const Cart = mongoose.model("Cart",cartSchema)

module.exports = Cart