const multer = require('multer')

// Use memory storage to work with sharp
// const storage = multer.memoryStorage()

// const upload = multer({ storage })

// module.exports = upload

const {CloudinaryStorage} = require('multer-storage-cloudinary')
const cloudinary = require('../utils/cloudinary')
//const { width, height } = require('pdfkit/js/page')

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'yara-images',
        allowed_formats: ['jpeg', 'png','jpg','webp'],
        //transformation: [{width:800, height: 800, crop: 'limit'}]
    }
})


const upload = multer({ storage })

module.exports = upload