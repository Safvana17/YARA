const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Brand = require('../../models/brandSchema')
const Category = require('../../models/categorySchema')

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id 
        const productData = await Product.findById(productId).populate('category').populate('brand')
        const category = productData.category
        const productVariant = await ProductVariant.find({productId: productId})

        if(productData.isBlocked){
            res.redirect('/')
        }

        const relatedProducts = await Product.find({
            category: productData.category._id,
            _id: {$ne: productData._id}
        }).limit(8)

        const totalStock = productVariant.reduce((sum, v) => sum+v.stockQuantity, 0)
        res.render('product-details',{
            user: userData,
            product: productData,
            relatedProducts,
            category: category,
            variants: productVariant,
            totalStock
        })
    } catch (error) {
        console.error('Error while loading product details page', error)
        res.redirect('/pageNotFound')
    }
    
}

module.exports = {
    productDetails
}