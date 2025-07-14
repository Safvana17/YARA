const mongoose = require('mongoose')
const {Schema} = mongoose

const productVariantSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    sku: {
        type: String,
        required: true,
        trim:true
    },
    size: {
        type: String,
        required: true
    },
    stockQuantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    productOffer:{
        type: Number,
        default: 0
    },
    appliedOffer: {
        type: {
            offerType: String, //"product" | "subcategory" | "category"
            offerValue: Number
        },
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

productVariantSchema.index({ productId: 1 })

const ProductVariant = mongoose.model("ProductVariant",productVariantSchema)
module.exports = ProductVariant