const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})


module.exports = mongoose.model('Notification', notificationSchema)