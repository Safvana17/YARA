const User = require('../models/userSchema')

const adminAuth = (req, res, next) => {
    if(req.session.adminId){
        User.findOne({_id:req.session.adminId, isAdmin: true})
            .then((admin)=>{
                if(admin){
                    next()
                }else{
                    res.redirect('/admin/login')
                }
            })
            .catch((error)=>{
                console.error("ERror in adminauth middleware", error)
                res.status(500).json('Internal server error')
            })
    }else{
        res.redirect('/admin/login')
    }
}

const userAuth = (req, res, next) =>{
    if(req.session.user){
        User.findById(req.session.user)
            .then((data)=>{
                if(data && !data.isBlocked){
                    next()
                }else{
                    res.redirect('/login')
                }
            })
            .catch((error)=>{
                console.error("Error in userauth middleware", error)
                res.status(500).json("Internal server error")
            })     
    }else{
        res.redirect('/login')
    }
}
module.exports = {
    adminAuth,
    userAuth
}