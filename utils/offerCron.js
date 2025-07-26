const cron = require('node-cron')
const Product = require('../models/productSchema')
const Category = require('../models/categorySchema')
const getBestOfferPrice = require('../utils/offerHelper')


cron.schedule('*/5 * * * *', async () => {
    try {
       const currentDate = new Date()

       //update category offer
       const categories = await Category.find()
       for(const category of categories){
        const isActive = category.offerStartDate <= currentDate && category.offerEndDate >= currentDate
        if(category.isOfferActive !== isActive){
            category.isOfferActive = isActive
            await category.save()
        }
       }

       //update product offers
       const products = await Product.find().populate('category')
       for(const product of products){
        const isProductOfferActive = product.offerStartDate <= currentDate && product.offerEndDate >= currentDate
        if(product.isOfferActive !== isProductOfferActive){
            product.isOfferActive = isProductOfferActive
        }

        const categoryOffer = product.category?.isOfferActive ? product.category.categoryOffer : 0
        const productOffer = product.isOfferActive ? product.productOffer : 0

        const bestPrice = getBestOfferPrice(product.baseSalePrice || product.salePrice, productOffer, categoryOffer)
        product.salePrice = bestPrice || product.baseSalePrice || product.salePrice

        await product.save()

       }

       console.log('Offer cron job completed at', new Date().toLocaleDateString())
    } catch (error) {
        console.error('Cron job error:', error)
    }
})