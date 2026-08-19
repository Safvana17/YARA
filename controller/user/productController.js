const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const ProductVariant = require('../../models/productVariantSchema')
const Brand = require('../../models/brandSchema')
const Category = require('../../models/categorySchema')
const STATUS = require('../../utils/statusCodes')
const { getFinalOffer } = require('../../utils/getFinalOffer')
const { getProductPrice } = require('../../utils/productPriceCalculator')

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user
        const productId = req.query.id 

        const [userData, productData, productVariant] = await Promise.all([ 
            User.findById(userId),
            Product.findById(productId).populate('category').populate('brand'),
            ProductVariant.find({productId: productId})
        ])
        const category = productData.category
        if(productData.isBlocked){
            res.redirect('/')
        }

        const relatedProducts = await Product.find({
            category: productData.category._id,
            _id: {$ne: productData._id}
        }).limit(8)


        const finalOffer = getFinalOffer(productData)
        
        const {originalPrice, finalPrice} = getProductPrice(productData, finalOffer)

        const totalStock = productVariant.reduce((sum, v) => sum+v.stockQuantity, 0)
        res.render('product-details',{
            user: userData,
            product: productData,
            relatedProducts,
            finalOffer,
            finalPrice,
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