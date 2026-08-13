const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require('../../models/brandSchema')
const Order = require('../../models/orderSchema')
const Banner = require('../../models/bannerSchema')
const STATUS = require('../../utils/statusCodes')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const { Resend } = require('resend')
const env = require('dotenv')
const { name } = require('ejs')


//generate referral code
function generateReferralCodeFromName(name){
    const clearName = name.replace(/\s+/g, '').toUpperCase() // remove spaces 
    const namePart = clearName.substring(0, 5).padEnd(5, 'X') //get first 5 letters, add X if it is not 5 characters
    const randomDigits = Math.floor(100 + Math.random() * 900)  // reandom 3 digit number

    return `YR${namePart}${randomDigits}`
}


//sign up page
const loadSignup = async (req, res) => {
    try {
        res.render('signup')
    } catch (error) {
        console.error('Error while loading signup page', error)
        req.redirect('/pageNotFound')
    }
}


//otp
function generateOtp(){
    const digits = "1234567890"
    let otp = ""
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

//send OTP
async function sentOtpMail(otp, email){
    const resend = new Resend(process.env.RESEND_API_KEY)
  try{
     const {data, error} = await resend.emails.send({
        from: process.env.RESEND_EMAIL,
        to: 'safvana277@gmail.com',
        subject: `Your OTP Code`,
        text: `Your OTP for sign up is ${otp}`,
        html:`<p>Your <b>OTP</b> is: <strong>${otp}</strong></p>`
     })
     
     if(error) {
        console.log("Error sending OTP:", error)
        return false
     }
     console.log("email sent: ", data.id)
     return true

    }catch(error){
        console.error("error sending otp", error)
    }
}


//sign up
const signup = async (req, res) => {
    try {
        const {name, email, phone, password, confirmpassword, referralCode} = req.body
        if(password !== confirmpassword){
            return res.render('signup',{message: "password do not match"})
        }
        const findUser = await User.findOne({email})
        if(findUser){
            return res.render('signup',{message: "User already exists"})
        }
        const otp = generateOtp()
        const mailSent = await sentOtpMail(otp, email)
        if(!mailSent){
           return res.json('Email send error')
        }

        
        req.session.otp = otp
        req.session.userData = {name, email, phone, password, referralCode}
        req.session.otpCreatedAt = Date.now()
        res.render('verify-otpsignup')
        console.log("otp sent", otp)
    } catch (error) {
        console.error('Error during sign up',error)
        res.redirect('/pageNotFound')
    }
}

//password hash
const securePassword = async(password) =>{
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.error("Error while hashing password", error)
    }
}


//verify otp
const verifyOtp = async (req, res) => {
    try {
        const {otp} = req.body
        console.log("Entered otp is:",otp)
        const otpAge = Date.now () - req.session.otpCreatedAt 
        if(otpAge > 1 * 60 * 1000){
            return res.status(STATUS.BAD_REQUEST).json({success: false, message: "OTP Expired, please request new one"})
        }
        if(otp === req.session.otp){
            const user = req.session.userData
            let referralcode 
            let referredBy = null
            let isUnique = false
            while(!isUnique){
                referralcode = generateReferralCodeFromName(user.name)
                const existing = await User.findOne({ referalCode: referralcode})
                if(!existing) isUnique = true
            }

           const passHash = await securePassword(user.password)
           const newUser = new User({
            name: user.name,
            email: user.email,
            phone: user.phone,
            password: passHash,
            referalCode: referralcode,
            
           })

           await newUser.save()

        if(user.referralCode){
            const referrer = await User.findOne({ referalCode: user.referralCode})
            if(referrer) referredBy = referrer

            //credit 50
            referrer.wallet += 100
           
            referrer.walletTransaction.push({
                amount: 100,
                status: 'credited',
                method: 'reward',
                description: `Referral reward for inviting ${user.name}`
            })
            referrer.redeemedUsers.push(newUser?._id)

            await referrer.save()

            newUser.wallet += 50
            newUser.walletTransaction.push({
                amount: 50,
                status: 'credited',
                method: 'reward',
                description: `Referral bonus for using ${referrer.name}'s code`
            })
            }

            await newUser.save()
            
           req.session.user = newUser._id
           res.status(STATUS.OK).json({success: true, redirectUrl: "/login"})
        }else{
            res.status(STATUS.INTERNAL_SERVER_ERROR).json({success:false, message: "Invalid OTP, Please try again later"})
        }
        
    } catch (error) {
        console.error("Error verifying OTP",error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: "Internal server error"})
    }
}


//resend otp
const resendOTP = async (req, res) => {
    try {
        const {email} = req.session.userData
        if(!email){
            res.status(STATUS.BAD_REQUEST).json({success: false, message:"Email not found"})
        }
        const otp = generateOtp()
        req.session.otp = otp
        const emailsent = await sentOtpMail(otp, email)
        console.log('resend otp:',otp)
        if(emailsent){
            req.session.otpCreatedAt = Date.now()
           res.status(STATUS.OK).json({success: true, message: "OTP Resend successfully"})
        }else{
            res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message:"Failed to resend otp, please try again"})
        }
    } catch (error) {
        console.error("Error occured while resend OTP", error)
        res.status(STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: "Internal server error"})
    }
}

//home page
const loadHome = async (req, res) => {
    try {
        const userId = req.session.user
        const categories = await Category.find({isListed: true})
        const [brands, trendingProducts, latestProduct, activeBanner ] = await Promise.all([ 
            Brand.find({isBlocked: false}),
            Order.aggregate([
                {$unwind: '$orderItems'},
                {
                    $group: {
                        _id: '$orderItems.product',
                        totalQty: {$sum: '$orderItems.quantity'}
                    }
                },
                {$sort: {totalQty: -1 } },
                
                {
                    $lookup: {
                        from: 'products',
                        foreignField: "_id",
                        localField: "_id",
                        as: 'product'
                    }
                },
                {$unwind: '$product'},
                {$match: {'product.isBlocked': false}},
                {$limit: 12},
                {
                    $project: {
                        _id: '$product._id',
                        name: '$product.name',
                        productImage: '$product.productImage',
                        salePrice: '$product.salePrice',
                        // totalQty: 1
                    }
                }
            ]),
            Product.find({
                isBlocked: false,
                category: {$in: categories.map(c => c._id)}
            })
            .sort({ createdAt: -1})
            .limit(12),
            Banner.find({isActive: true}).sort({startDate: -1})
        ])
        console.log(activeBanner)

        if(userId){
            const userData = await User.findOne({_id: userId})
            if(!userData.isBlocked){
                  res.render('home',{
                     user: userData,
                     latestproducts: latestProduct,
                     trendingProducts,
                    brands,
                    activeBanner
                  })
            }else{
                res.render('home', {
                    user: null,
                    latestproducts: latestProduct,
                    trendingProducts,
                    brands,
                    activeBanner
                })
            }
        }else{
            res.render('home',{
                user: null,
                latestproducts: latestProduct,
                trendingProducts,
                brands,
                activeBanner
            })
        }
    } catch (error) {
        console.error('Error while loading home page', error)
        res.redirect('/pageNotFound')
    }
}

//loginpage
const loadLogin = async (req, res) => {
    try {
        if(!req.session.user){
            return res.render('login')
        }else {
            res.redirect('/')
        }
    } catch (error) {
        console.error("Error while loading login page")
        res.redirect('/pageNotFound')
    }
}

//login
const login = async (req, res) => {
    try {
        const {email, password} = req.body
        const findUser = await User.findOne({isAdmin: 0, email: email})
        if(!findUser){
            return res.render('login',{message: "User doesn't exists.."})
        }
        if(findUser.isBlocked){
            return res.render('login', {message: "User is blocked by admin."})
        }
        const passwordMatch = await bcrypt.compare(password, findUser.password)
        if(!passwordMatch){
            return res.render('login', {message: "Password doesn't match, please try again"})
        }
        req.session.user =findUser.id  
        res.redirect('/')
        
    } catch (error) {
        console.error("Error while login", error)
        res.render('login', {message:"Error during login, please try again later"})
    }
}

//logout
const logout = async (req, res) => {
    try {
        req.session.destroy((err)=>{
            if(err){
                console.error('Error in destruction session', err)
                res.redirect('/pageNotFound')
            }
            return res.redirect('/login')
        })
    } catch (error) {
        console.error('Error during logout', error)
        res.redirect('/pageNotFound')
    }
}

//page not found
const pageNotFound = async (req, res) => {
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user
        const userData = await User.findOne({_id: user})

        const [categories, brands ] = await Promise.all([ 
            Category.find({ isListed: true}),
            Brand.find({isBlocked: false})
        ])

        const categoryIds = categories.map((category)=> category._id.toString())
        const brandNames = brands.map((brand) => brand.brandName)

        const {category, brand, gt, lt, page = 1, sortBy, query} = req.query

        const limit = 9
        const skip = ( page - 1 ) * limit

        // const allProducts = await Product.find().select('name');
        // console.log(allProducts.map(p => p.name));

        const filter = {
            isBlocked: false,
            category: { $in: categoryIds},
        }
        if(category){
            const categoryDoc = await Category.findOne({name: category, isListed: true})
            if(categoryDoc){
                filter.category = categoryDoc._id
            }else{
                filter.category = null
            }
        }
        if (brand) {
              const brandDoc = await Brand.findOne({ brandName: brand, isBlocked: false});
              if (brandDoc) {
                filter.brand = brandDoc._id;
              } else {
                 filter.brand = null
              }
         }else{
            filter.brand = {$in: brands.map((b => b._id))}
         }

        if(gt && lt) filter.salePrice = {$gte: parseInt(gt), $lt: parseInt(lt)}
        if(query) filter.name = {$regex: query, $options: 'i'}


        let sortOptions = { createdAt: -1 } //newest first
        if(sortBy === 'lowToHigh') sortOptions = { salePrice: 1 }
        else if(sortBy === 'highToLow') sortOptions = { salePrice: -1 }
        else if(sortBy === 'aToZ') sortOptions = { name: 1}
        else if(sortBy === 'zToA') sortOptions = { name: -1 }


        const totalProducts = await Product.countDocuments(filter)
        const products = await Product.find(filter).populate('brand').sort(sortOptions).skip(skip).limit(limit)
        const totalPages = Math.ceil( totalProducts / limit )

        res.render('shop',{
            user: userData,
            products,
            category: categories,
            brand: brands,
            totalProducts,
            currentPage: parseInt(page),
            totalPages,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            priceRange: gt && lt ? {gt, lt} : null,
            sortBy: sortBy || '',
            query: query || ''
        })
    } catch (error) {
        console.error('Error while loading shopping page', error)
        res.redirect('/pageNotFound')
    }
}


module.exports = {
    loadSignup,
    loadHome,
    loadLogin,
    login,
    signup,
    verifyOtp,
    resendOTP,
    logout,
    pageNotFound,
    loadShoppingPage,
    
}