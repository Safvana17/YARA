const multer = require('multer')



const {CloudinaryStorage} = require('multer-storage-cloudinary')
const cloudinary = require('../utils/cloudinary')


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