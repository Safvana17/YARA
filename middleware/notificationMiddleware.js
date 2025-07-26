const Notification = require('../models/notificationSchema')

const notificationMiddleware = async (req, res, next) => {
    try {
        const fifteenDaysAgo = new Date()
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

        const notifications = await Notification.find({ createdAt: { $gte: fifteenDaysAgo}})
              .sort({ createdAt: -1})
              .lean()

        const unreadCount = notifications.filter(n => !n.isRead).length
        res.locals.notifications = notifications
        res.locals.unreadCount = unreadCount

        next()
    } catch (error) {
        console.error('Notification middleware error', error)
        res.locals.notifications = []
        res.locals.unreadCount = 0
        next()
    }
}

module.exports = notificationMiddleware