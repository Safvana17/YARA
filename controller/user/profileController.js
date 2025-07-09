const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require('dotenv')
const session = require('express-session')
const Product = require('../../models/productSchema')

function generateOtp(){
    const digits = "1234567890"
    let otp = ""
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "OTP For password reset",
            text: `Your OTP is: ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions)
        console.log("Email sent:", info.messageId)
        return true
    } catch (error) {
        console.error("Error sending email", error)
        return false
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log("error during password hash", error)
    }
}

//get forgot password
const getForgotPassword = async (req, res) => {
    try {
        res.render('forgot-password',{message: ''})
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

//emailsend
const forgotEmailValid = async (req, res) => {
    try {
        const {email} = req.body
        const findUser = await User.findOne({email: email})
        if(findUser){
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email, otp)
            if(emailSent){
                req.session.userOtp = otp
                req.session.email = email
                res.render('forgotPass-otp')
                console.log('password reset otp:', otp)
            }else{
                res.json({success: false, message: "Failed to send OTP, Please try again"})
            }
        }else{
            res.render('forgot-password',{message: 'User with email does not found!'})
        }
    } catch (error) {
        console.error("Error while verifying email", error)
        res.redirect("/pageNotFound")
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const {otp }= req.body
        if(otp === req.session.userOtp){
            res.json({success: true, redirectUrl: '/reset-password'})
        }else{
            res.json({success: false, message:"OTP not matching!!"})
        }
    } catch (error) {
        res.status(500).json({success: false, message: "An error occured, please try again"})
    }
}

const getResetPassPage = async (req, res) => {
 try {
    res.render('reset-password')
 } catch (error) {
    res.redirect('/pageNotFound')
 }   
}

//resend otp
const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        const emailSent = await sendVerificationEmail(email, otp)
        if(emailSent){
            console.log("Resend otp:", otp)
            res.status(200).json({success: true, message: 'Resend otp successful'})
        }
    } catch (error) {
        console.error("Error in resend otp", error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

const newPassword = async (req, res) => {
    try {
        const {newPass1, newPass2} = req.body
        const email = req.session.email
        if(newPass1 === newPass2){
            const passwordHash = await securePassword(newPass1)
            await User.updateOne(
                {email: email},
                {$set: {password: passwordHash}}
            )
            res.redirect('/login')
        }else{
            res.render('reset-password',{message: "Password do not match"})
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
    
}
//user profile page
const loadUserProfile = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({_id: userId})
        res.render('profile',{
            user: userData
        })
    } catch (error) {
        console.error('Error while loading user profile page', error)
        res.redirect('/pageNotFound')
    }
}
//get change email
const getChangeEmail = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        res.render('changeEmail',{user})
    } catch (error) {
        console.error('Error while loading Change email page', error)
        res.redirect('/pageNotFound')
    }
}

//change email
const changeEmail = async (req, res) => {
    const userId = req.session.user
    try {
        const {email, password} = req.body
        const userExists = await User.findById(userId)

        if(userExists){
            const passwordMatch = await bcrypt.compare(password, userExists.password)
            if(passwordMatch){
                const otp = generateOtp()
                const emailSent = await sendVerificationEmail(email, otp)
                if(emailSent){
                    req.session.userOtp = otp
                    req.session.userData = req.body
                    req.session.email = email
                    res.status(200).json({success: true, message: 'OTP send successfully'})
                    console.log('email send to', email)
                    console.log('otp for email change: ', otp)
                }else{
                    res.json({success: false, message: 'Email error'})
                }
            }else{
                res.json({success: false, message: "Password doesn't match"})
            }
        }else{
            res.json({success: false, message: 'User with email not found!'})
        }
    } catch (error) {
        console.error('Error while confirming user', error)
        res.status(500).json({success: false, message: 'Internal sever error!'})
    }
}

//const otp page for email change
const getEmailchangeOtpPage = async (req, res) => {
    try {
        res.render('changeEmail-otp')
    } catch (error) {
        console.error('Error while loading otp verify page', error)
        res.redirect('/pageNotFound')
    }
}
//verify otp
const verifyChangeEmailOtp = async (req, res) => {
    try {
        const {otp} = req.body
        if(otp === req.session.userOtp){
            res.json({success: true, redirectUrl: '/updateEmail'})
        }
        else{
            res.json({success: false, message:'OTP is not matching!!'})
        }
    } catch (error) {
        console.error('Error while verifying otp', error)
        res.redirect('/pageNotFound')
    }
}

//get update email
const getUpdateEmail = async (req, res) => {
    try {
        res.render('update-email')
    } catch (error) {
        console.error('Error while loading update email', error)
        res.redirect('/pageNotFound')
    }
}

//change email resend otp
const changeEmailResendOtp = async (req, res) => {
    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        const emailSent = await sendVerificationEmail(email, otp)
        if(emailSent){
            console.log('resend otp: ', otp)
            res.status(200).json({success: true, message: 'OTP resend successfully'})
        }
    } catch (error) {
        console.error('Error while resending otp', error)
        res.status(500).json({success: false, message: 'Something went wrong!'})
    }
}
// update email
const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.email
        const emailExists = await User.findOne({email: newEmail})
        if(emailExists){
            res.status(400).json({success: false, message: 'User with this email already exists!!'})
        }else{
            const userId = req.session.user
            await User.findByIdAndUpdate(userId, {$set: {email: newEmail}})
            res.status(200).json({success: true, message: 'Email updated successfully'})
        }
    } catch (error) {
        console.error('Error while updating email', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}
//update profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user
        const {name, phone, gender} = req.body

        await User.findByIdAndUpdate(userId, {
            name: name.trim(),
            phone: phone.trim(),
            gender
        },{new: true})

        res.status(200).json({success: true, message: 'Profile updated'})

    } catch (error) {
        console.error("Error while updating profile", error)
        res.status(500).json({success:false, message: 'Internal server error'})
    }
}

//change profile pic
const updateProfilePic = async (req, res) => {
    try {
        const userId = req.session.user

        if(!req.file){
            return res.status(400).json({success: false, message: 'No file uploaded'})
        }
        const profileImage = req.file.filename
        
        await User.findByIdAndUpdate(userId,{
            profileImage: profileImage
        })

        res.json({success: true, profileImage})
    } catch (error) {
        console.error('Error while changing profile pic')
        res.status(500).json({message: 'Upload failed'})
    }
}

//change password
const changePassword = async (req, res) => {
    try {
        const userId = req.session.user
        const {currentPassword, newPassword, confirmPassword} = req.body

        const userData = await User.findById(userId)
        const passwordMatch = await bcrypt.compare(currentPassword, userData.password)
        if(!passwordMatch){
            return res.status(400).json({success: false, message: 'Incorrecet password'})
        }else{
            if(newPassword !== confirmPassword){
                return res.status(400).json({success: false, message: 'New password and confirm password must be same'})
            }else{
                const passwordHash = await securePassword(newPassword)
                userData.password = passwordHash
                await userData.save()
                res.status(200).json({success: true, message: 'Password changed'})
            }
        }
    } catch (error) {
        console.error("Error while changing password", error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//get address page
const getAddressPage = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        const addressData = await Address.findOne({userId})
        res.render('user-address',{user,addressData})
    } catch (error) {
        console.error('Error while loading error page', error)
        res.redirect('/pageNotFound')
    }
}

//get add address
const getAddAddress = async (req, res) => {
    try {
        res.render('add-address')
    } catch (error) {
        console.error('Error while loading add address page', error)
        res.redirect('/pageNotFound')
    }
}

//add address
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)

        const {name, addressType, houseNo, city, state, landMark,pinCode, phone, altPhone} = req.body

        const userAddress = await Address.findOne({userId: userData._id})
        if(!userAddress){
            const newAddress = new Address({
                userId: userData._id,
                address: [{addressType, name, houseNo, city, state, landMark, pinCode, phone, altPhone}]
            })

            await newAddress.save()
        }else{
            userAddress.address.push({addressType, name, houseNo, city, state, landMark, pinCode, phone, altPhone})
            await userAddress.save()
        }
        res.status(200).json({success: true, message: 'Address added successfully.'})
    } catch (error) {
        console.error('Error while adding new address', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//get edit address page
const getEditAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const addressId = req.params.id

        console.log('Requested addressId:', addressId);


        const user = await User.findById(userId)
        const addressData = await Address.findOne({userId})

        console.log('Available address IDs:', addressData.address.map(a => a._id.toString()));
        const selectedAddress = addressData.address.find(addr => addr._id.toString() === addressId)

        if(!selectedAddress){
            res.status(400).json({success: false, message: 'Selected address not found'})
        }
        res.render('edit-address', {addressData, selectedAddress, addressId, user})
    } catch (error) {
        console.error('Error while loading edit address page', error)
        res.redirect('/pageNotFound')
    }
}

//edit address
const editAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const addressId = req.params.id

        const {name, addressType, houseNo, city, state, landMark,pinCode, phone, altPhone} = req.body
        const findAddress = await Address.findOne({'address._id': addressId})
        if(findAddress){
           await Address.updateOne(
            {'address._id' : addressId},
            {$set: {
                'address.$': {
                    _id: addressId,
                    addressType: addressType,
                    name: name,
                    houseNo: houseNo,
                    city: city,
                    state: state,
                    landMark: landMark,
                    pinCode: pinCode,
                    phone: phone,
                    altPhone: altPhone
                }
            }}
           )
           res.status(200).json({success: true, message: 'Address updated successfully'}) 
        }else{
            res.status(400).json({success: false, message: 'Address not found'})
        }
    } catch (error) {
        console.error('Error while updating address', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}
//delete address
const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id
        const addressData = await Address.findOne({'address._id': addressId})

        if(!addressData){
            return res.status(400).json({success: false, message: 'Address not found'})
        }

        await Address.updateOne({'address._id': addressId},{
            $pull:{
                address: {
                    _id: addressId
                }
            }
        })

        res.status(200).json({success: true, message: 'Address deleted!'})
    } catch (error) {
        console.error("Error while deleting address", error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}

//get refer and earn
const loadReferAndEarn = async (req, res) => {
    try {
        const userId = req.session.user 
        const user = await User.findById(userId)
      res.render('referAndEarn', {user})  
    } catch (error) {
       console.error('Error while loading refer and earn page', error)
       res.redirect('/pageNotFound') 
    }
}
module.exports = {
    getForgotPassword,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    newPassword,
    loadUserProfile,
    getChangeEmail,
    changeEmail,
    getEmailchangeOtpPage,
    verifyChangeEmailOtp,
    getUpdateEmail,
    changeEmailResendOtp,
    updateEmail,
    updateProfilePic,
    updateProfile,
    changePassword,
    getAddressPage,
    getAddAddress,
    addAddress,
    getEditAddress,
    editAddress,
    deleteAddress,
    loadReferAndEarn
}