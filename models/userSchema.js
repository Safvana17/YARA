const mongoose = require('mongoose')
const {Schema} = mongoose


const userSchema = new Schema({
    name: {
      type:String,
      required: true
    },
    email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null
  },
  googleId:{
    type: String,
    unique: true,
    sparse: true
  },
  gender: {
    type: String,
    enum: ["Male","Female","Other"],
    required: false
  },
  wallet: {
    type: Number,
    default: 0
  },
  referalCode: {
    type: String,
    unique: true,
    sparse: true
  },
  redeemed: {
    type: Boolean,
    default: false
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  profileImage: {
    type: [String],
    required: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin:{
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: "Cart"
  }],
  wishlist:[{
    type: Schema.Types.ObjectId,
    ref:"Wishlist"
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "Order"
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category"
    },
    brand: {
      type: String
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
},{timestamps:true})



const User = mongoose.model('User',userSchema)

module.exports = User