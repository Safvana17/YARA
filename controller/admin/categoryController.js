const { default: mongoose } = require('mongoose')
const Category = require('../../models/categorySchema')
const getBestOfferPrice = require('../../utils/offerHelper')
const Product = require('../../models/productSchema')


const loadCategories = async (req, res) => {
    try {
        let search = ''
        if(req.query.search){
            search = req.query.search
        }
        let page = 1
        if(req.query.page){
            page = parseInt(req.query.page)
        }
        let limit = 3
        const skip = (page - 1)* limit
        const categories = await Category.find({})
                .sort({createdAt: -1})
                .skip(skip)
                .limit(limit)
        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil( totalCategories / limit)
        //console.log(totalCategories, totalPages)
        res.render('category',{
            categories,
            totalPages,
            currentPage: page,
            search
        })
    } catch (error) {
        console.error('Error while loading category page', error)
        res.redirect('/admin/pageerror')
    }
}

//add category
const addCategory = async (req, res) => {
    const {name, description} = req.body
    try {
        const existingCat = await Category.findOne({name: {$regex: new RegExp(`^${name}$`, 'i')}})
        if(existingCat){
            return res.status(400).json({error: 'Category already exists'})
        }
        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message: 'Category added successfully'})
    } catch (error) {
        console.error('Error while adding new category', error)
        return res.status(500).json({error: 'Internal server error'})
    }
}

//list category
const listCategory = async (req, res) => {
    try {
        const id = req.params.id
        await Category.updateOne({_id: id},{$set: {isListed: true}})
        res.redirect('/admin/category')
    } catch (error) {
        console.error('Error while listing categories', error)
        res.redirect('/admin/pageerror')
    }
}

//unlist category
const unlistCategory = async (req, res) => {
    try {
        const id = req.params.id
        await Category.updateOne({_id: id},{$set: {isListed: false}})
        res.redirect('/admin/category')
    } catch (error) {
        console.error('Error while unlisting category', error)
        res.redirect('/admin/pageerror')
    }
}

//get edit category page
const getEditCategory = async (req, res) => {
    try {
        const id = req.params.id
        const category = await Category.findOne({_id: id})
        const error = req.params.error || null
        res.render('edit-category',{
            category,
            error
        })
    } catch (error) {
        console.error('Error while loading edit category page', error)
        res.redirect('/admin/pageerror')
    }
}
//edit category
const editCategory = async (req, res) => {
    try {
        const error = req.params.error
        const id = req.params.id
        const {name, description} = req.body
        const existCat = await Category.findOne({
            name: {$regex: new RegExp(`^${name}$`, 'i')},
            _id: {$ne: id}
        })
        if(existCat){
            return res.status(400).json({error: 'Category alredy existing, please enter another name.'})
        }
        const updateCat = await Category.findByIdAndUpdate(id,{
            name: name,
            description:description
        },{new: true})

        if(updateCat){
            res.status(200).json({message: 'Category updated successfully'})
        }else{
            res.status(404).json({error: 'Category not found'})
        }
    } catch (error) {
        console.error('Error while edit category', error)
        res.redirect('/admin/pageerror')
    }
}

//add offer
const addOffer = async (req, res) => {
    try {
        const categoryId = req.params.id 
        const { offerValue } = req.body

        if(isNaN(offerValue) || offerValue < 1 || offerValue > 90){
            return res.status(400).json({ success: false, message: 'Invalid offer value'})
        }
        const category = await Category.findById(categoryId)
        if(!category || !category.isListed){
            return res.status(400).json({success: false, message: 'Category not found or unlisted'})
        }

        category.categoryOffer = offerValue
        await category.save()

        const products = await Product.find({category: categoryId})

        for(let product of products){
            const productoffer = product.productOffer || 0
            const bestOffer = getBestOfferPrice(
                product.regularPrice,
                productoffer,
                offerValue
            )

            product.salePrice = bestOffer !== null ? bestOffer : product.baseSalePrice
            await product.save()
        }

        //await Category.findByIdAndUpdate(categoryId,{categoryOffer: offerValue})
        res.status(200).json({success: true, message: 'Offer addedd successfully.'})

    } catch (error) {
        console.error('Error while adding offer', error)
        res.status(500).json({success: false, message :'Internal server error'})
    }
}

//remove offer
const removeOffer = async (req, res) => {
    try {
        const categoryId= req.params.id 
        const category = await Category.findById(categoryId)

        category.categoryOffer = 0
        await category.save()

        const products = await Product.find({category: categoryId}) 
        for(let product of products){
            const productoffer = product.productOffer || 0
            if(productoffer === 0){
                product.salePrice = product.baseSalePrice
            }else{
              const bestOffer = getBestOfferPrice(product.regularPrice, product.productOffer, 0)
              product.salePrice = bestOffer 

            }

            await product.save()
        }
        //await Category.findByIdAndUpdate(categoryId, {categoryOffer: 0})
        
        res.status(200).json({success: true, message :'Offer removed'})
    } catch (error) {
        console.error('Error while removing offer', error)
        res.status(500).json({success: false, message: 'Internal server error'})
    }
}
module.exports = {
    loadCategories,
    addCategory,
    listCategory,
    unlistCategory,
    getEditCategory,
    editCategory,
    addOffer,
    removeOffer
}