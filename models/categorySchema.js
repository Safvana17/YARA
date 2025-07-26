const mongoose = require('mongoose')
const {Schema} = mongoose

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description:{
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    offerStartDate: {
       type: Date,
       default: null
    },
    offerEndDate: {
        type: Date,
        default: null
    },
    isOfferActive: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const Category = mongoose.model('Category', categorySchema)
module.exports = Category