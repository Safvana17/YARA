const User = require('../../models/userSchema')
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

module.exports = {
    getForgotPassword,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    newPassword
}