const STATUS = require('../utils/statusCodes')

const errorHandler = (err, req, res, next) =>{
    console.error(err.stack)
    res.status(STATUS.NOT_FOUND).render('page-404', {message: 'Page not found'})
}

module.exports = errorHandler