const express = require('express')
const env = require('dotenv').config()
const userRouter = require('./routes/userRouter')
const adminRouter = require('./routes/adminRouter')
const nocache = require('nocache')
const path = require('path')
const session = require('express-session')
const db = require('./config/db')
const passport = require('./config/passport')
const MongoStore = require('connect-mongo')
const app = express()

db()

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(session({
    secret:  process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({mongoUrl: process.env.MONGODB_URI}),
    cookie: ({
        secure: false,
        httpOnly : true,
        maxAge: 72 * 60 * 60 * 1000
    })
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(nocache())
app.use((req,res,next)=>{
    res.locals.user = req.session.user || null
    next()
})
app.set('view engine', 'ejs')
app.set('views',[path.join(__dirname,'views/user'), path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname, 'public')))
app.use('/images', express.static('public/images'))

app.use('/admin', adminRouter)
app.use('/', userRouter)

app.listen(process.env.PORT,()=>{
    console.log(`Server started at ${process.env.PORT}`)
})