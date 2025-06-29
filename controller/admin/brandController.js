const Brand = require('../../models/brandSchema')
const Category = require('../../models/categorySchema')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')


const loadBrands = async (req, res) => {
    try {
        let page = req.query.page || 1
        let search = req.query.search || ''
        let limit = 4
        let skip = (page - 1) * limit
        const brands = await Brand.find({}) 
              .sort({createdAt: -1})
              .skip(skip)
              .limit(limit)
        const totalBrands = await Brand.countDocuments()
        const totalPages = Math.ceil( totalBrands / limit )
        res.render('brands',{
            brands,
            totalPages,
            currentPage: page,
            search
        })
    } catch (error) {
        console.error('Error while loading brand page', error)
        res.redirect('/admin/pageerror')
    }
}

//add brand
const addBrand = async (req, res) => {
    try {
        const {brandName } = req.body
        if(!brandName || !req.file){
            return res.status(400).json({error:'All fields are required'})
        }
        const exixtingBrand = await Brand.findOne({brandName: {$regex: new RegExp(`^${brandName}$`, 'i')}})
        if(exixtingBrand){
            return res.status(400).json({error: 'Brand already exists'})
        }

        const filename = `brand_${Date.now()}.jpeg`
        const outputPath = path.join(__dirname,'../../public/images', filename)

        await sharp(req.file.buffer)
              .resize(300, 300)
              .jpeg({quality: 80})
              .toFile(outputPath)

        const imageUrl = `/images/${filename}`
        const newBrand = new Brand({
            brandName,
            brandImage: [imageUrl],
        })

        await newBrand.save()

        return res.status(200).json({message: 'Brand added successfully'})
    } catch (error) {
        console.error('Error adding brand', error)
        res.status(500).json({error: "Something went wrong while adding brand"})
    }
}

//block brand
const blockBrand = async (req, res) => {
    try {
        const id = req.params.id
        await Brand.updateOne({_id: id}, {$set: {isBlocked: true}})
        res.redirect('/admin/brands')
    } catch (error) {
        console.error("Error while blocking brand", error)
        res.redirect('/admin/pageerror')
    }
}

//unblock brand
const unblockBrand = async (req, res) => {
    try {
        const id = req.params.id
        await Brand.updateOne({_id: id}, {$set: {isBlocked: false}})
        res.redirect('/admin/brands')
    } catch (error) {
        console.error("Error while unblocking brand", error)
        res.redirect('/admin/pageerror')
    }
}

//delete brand
const deleteBrand = async (req, res) => {
    try {
        const id = req.params.id
        await Brand.findByIdAndDelete(id)
        res.redirect('/admin/brands')
    } catch (error) {
        console.error('Error while deleting brand', error)
        res.redirect('/admin/pageerror')
    }
}
module.exports = {
    loadBrands,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}