const User = require('../../models/userSchema')
const bcrypt = require('bcrypt')

const loadLogin = async (req, res) => {
    try {
        res.render('admin-login')
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
}
//admin login
const login = async (req, res) => {
    try {
        const {email, password} = req.body
        const admin = await User.findOne({email: email, isAdmin: true})
        if(admin){
            const passMatch = await bcrypt.compare(password, admin.password)
            if(passMatch){
                req.session.admin = true
                req.session.adminId = admin._id
                return res.redirect('/admin')
            }else{
                return res.redirect('/admin/login')
            }
        }else{
            return res.redirect('/admin/login')
        }
    } catch (error) {
        console.error('Error while admin login', error)
        return res.redirect('/admin/pageerror')
    }
}
//dashbord
const loadDashboard = async (req, res) => {
   if(req.session.admin){
    try {
        res.render('dashboard')
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
   }
}

//logout
const logout = async (req, res) => {
    try {
        req.session.destroy((err) =>{
            if(err){
                console.error('Error while logout', err)
                res.redirect('/admin/pageerror')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.error('Error during logout', error)
        res.redirect('/admin/pageerror')
    }
}

//page error
const pageError = async (req, res) => {
    res.render('admin-error')
}
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout, 
    pageError
}