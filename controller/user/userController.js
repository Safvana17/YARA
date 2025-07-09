const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require('../../models/brandSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
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
async function sentOtpMail(otp, email){
  try{
     const transporter = nodemailer.createTransport({
        service: 'gmail',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD
        }
     })
     const info = await transporter.sendMail({
        from: process.env.NODEMAILER_EMAIL,
        to: email,
        subject: `Your OTP Code`,
        text: `Your OTP for sign up is ${otp}`,
        html:`<p>Your <b>OTP</b> is: <strong>${otp}</strong></p>`
     })
     return info.accepted.length > 0
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
        const otpAge = req.session.otpCreatedAt - Date.now()
        if(otpAge > 1 * 60 * 1000){
            return res.status(400).json({success: false, message: "OTP Expired, please request new one"})
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
            
                    if(user.referralCode){
            const referrer = await User.findOne({ referalCode: user.referralCode})
            if(referrer) referredBy = referrer._id

            //credit 50
            referrer.wallet += 50
            referrer.walletTransaction.push({
                amount: 50,
                status: 'credited',
                method: 'reward',
                description: `Referral reward for inviting ${user.name}`
            })
            referrer.redeemedUsers.push(newUser?._id)

            await referrer.save()
            }
           //const user = req.session.userData
           const passHash = await securePassword(user.password)
           const newUser = new User({
            name: user.name,
            email: user.email,
            phone: user.phone,
            password: passHash,
            referalCode: referralcode,
            
           })

           await newUser.save()

        // if(user.referralCode){
        //     const referrer = await User.findOne({ referalCode: user.referralCode})
        //     if(referrer) referredBy = referrer

        //     //credit 50
        //     referrer.wallet += 50
        //     referrer.walletTransaction.push({
        //         amount: 50,
        //         status: 'credited',
        //         method: 'reward',
        //         description: `Referral reward for inviting ${user.name}`
        //     })
        //     referrer.redeemedUsers.push(newUser?._id)

        //     await referrer.save()
        //     }
           req.session.user = newUser._id
           res.status(200).json({success: true, redirectUrl: "/"})
        }else{
            res.status(500).json({success:false, message: "Invalid OTP, Please try again later"})
        }
        
    } catch (error) {
        console.error("Error verifying OTP",error)
        res.status(500).json({success: false, message: "Internal server error"})
    }
}
//resend otp
const resendOTP = async (req, res) => {
    try {
        const {email} = req.session.userData
        if(!email){
            res.status(400).json({success: false, message:"Email not found"})
        }
        const otp = generateOtp()
        req.session.otp = otp
        const emailsent = await sentOtpMail(otp, email)
        console.log('resend otp:',otp)
        if(emailsent){
            req.session.otpCreatedAt = Date.now()
           res.status(200).json({success: true, message: "OTP Resend successfully"})
        }else{
            res.status(500).json({success: false, message:"Failed to resend otp, please try again"})
        }
    } catch (error) {
        console.error("Error occured while resend OTP", error)
        res.status(500).json({success: false, message: "Internal server error"})
    }
}

//home page
const loadHome = async (req, res) => {
    try {
        const userId = req.session.user

        const categories = await Category.find({isListed: true})
        const brands = await Brand.find({isBlocked: false})
        const latestProduct = await Product.find({
            isBlocked: false,
            category: {$in: categories.map(c => c._id)}
        })
        .sort({ createdAt: -1})
        .limit(12)
        if(userId){
            const userData = await User.findOne({_id: userId})
            if(!userData.isBlocked){
                  res.render('home',{
                     user: userData,
                     latestproducts: latestProduct,
                    brands
                  })
            }else{
                res.render('home', {
                    user: null,
                    latestProducts: latestProduct,
                    brands
                })
            }
        }else{
            res.render('home',{
                user: null,
                latestproducts: latestProduct,
                brands
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
        if(req.session.user){
            return res.redirect('/')
        }
        res.render('login')
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

        const categories = await Category.find({ isListed: true})
        const categoryIds = categories.map((category)=> category._id.toString())

        const brands = await Brand.find({isBlocked: false})
        const brandNames = brands.map((brand) => brand.brandName)

        const {category, brand, gt, lt, page = 1, sortBy, query} = req.query

        const limit = 9
        const skip = ( page - 1 ) * limit

        
        const filter = {
            isBlocked: false,
            category: { $in: categoryIds},
        }
        if(category) filter.category = category
        if (brand) {
              const brandDoc = await Brand.findOne({ brandName: brand });
              if (brandDoc) {
                filter.brand = brandDoc._id;
              } else {
                 filter.brand = {$in: brands.map((b => b._id))}
              }
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


const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        let search = req.query.query || ''

        // Fetch only unblocked brands
        const brands = await Brand.find({ isBlocked: false }).lean();
        const allowedBrandNames = brands.map(b => b.brandName);

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());

        let searchResult = [];

        // If session already has filtered products
        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase()) &&
                allowedBrandNames.includes(product.brand)
            );
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds },
                brand: { $in: allowedBrandNames }
            }).lean();
        }

        // Sort and paginate
        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const itemsPerPage = 6;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        return res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count: searchResult.length,
        });

    } catch (error) {
        console.log("Error in searchProducts:", error);
        return res.redirect("/pagenotfound");
    }
};
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
    searchProducts
}