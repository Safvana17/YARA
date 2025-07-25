const mongoose = require('mongoose')
const {Schema} = mongoose


const productSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        default: 0
    },
    baseSalePrice: {type: Number},
    productOffer: {
        type: Number,
        default: 0
    },
    productImage: {
        type: [String],
        required: true
    },
    color: {
        type: String,
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status:{
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },
},{timestamps:true})


const Product = mongoose.model("Product",productSchema)

module.exports = Product