const multer = require('multer')

// Use memory storage to work with sharp
const storage = multer.memoryStorage()

const upload = multer({ storage })

module.exports = upload
