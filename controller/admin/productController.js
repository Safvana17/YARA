const { Schema, default: mongoose } = require('mongoose')
const Product = require('../../models/productSchema')
const ProductVariant = require('../../models/productVariantSchema')
const { loadBrands } = require('./brandController')
const Brand = require('../../models/brandSchema')
const Category = require('../../models/categorySchema')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')



const getTotalStock = async (productId) => {
    const result = await ProductVariant.aggregate([
        {$match: {productId: new mongoose.Types.ObjectId(productId)}},
        {$group: {_id: null, totalStock: {$sum: "$stockQuantity"}}}
    ])
    return result.length > 0 ? result[0].totalStock : 0
}
const LoadProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const search = req.query.search || ''
        const limit = 5
        const skip = ( page - 1 ) * limit
        let filter = {
            name: {$regex: search, $options: 'i'}
        }
        const products = await Product.find(filter)
              .populate('category')
              .populate('brand')
              .skip(skip)
              .limit(limit)
         
        const countProducts = await Product.countDocuments(filter)
        const totalPages = Math.ceil( countProducts / limit)

        const productsWithStock = []
        for(let product of products){
            const totalStock = await getTotalStock(product._id)
            productsWithStock.push({...product._doc, totalStock})
        }
        let sum = 0
        for(let product of products){
            sum += product.regularPrice 
        }
        
        res.render('products',{
            products: productsWithStock,
            currentPage: page,
            totalPages,
            search,
            sum
        })
    } catch (error) {
        console.error('Error while loading products page', error)
        res.redirect('/admin/pageerror')
    }
}

//get add product page
const getAddProducts = async (req, res) => {
    try {
        const category = await Category.find({isListed: true})
        const brand = await Brand.find({isBlocked: false})
        res.render('product-add', {
            category,
            brand
        })
    } catch (error) {
        console.error('Error while loading add product page', error)
        res.redirect('/admin/pageerror')
    }
}

//add products
const addProducts = async (req, res) => {
    try {
        const {name, description, categoryId, brand, regularPrice, salePrice, color} = req.body

        const ProductExists = await Product.findOne({name: {$regex: new RegExp(`^${name}$`, 'i')}})
        if(ProductExists){
            return res.status(400).json({success: false, message: 'Product already exists, please try another name'})
        }

        const uploadDir = path.join(__dirname, '../../public/images')
        if(!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, {recursive: true})
        }

        const imageFilenames = []
        for(let i=1; i<= 5; i++){
          const croppedImageData = req.body[`croppedImages${i}`]

          const filename = Date.now() + "-" + `cropped-image-${i}` + ".webp";
          const filepath = path.join(uploadDir, filename);

          if(croppedImageData && croppedImageData.startsWith('data:image')){
            const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, '')
            const imageBuffer = Buffer.from(base64Data, 'base64')

            await sharp(imageBuffer)
                  .webp({quality: 80})
                  .toFile(filepath)

            imageFilenames.push(`images/${filename}`)
          }
        }
 
        console.log(Object.keys(req.body)) // To check what croppedImages# keys you're receiving

        if(imageFilenames.length < 5){
            return res.status(400).json({success: false, message: 'Please upload all 5 product images'})
        }

        const category = await Category.findById(categoryId)
        if(!category){
            return res.status(400).json({success: false, message: 'Category not found'})
        }


       const newProduct = new Product({
        name,
        description,
        brand,
        category,
        regularPrice,
        salePrice,
        color,
        createdAt: new Date(),
        productImage: imageFilenames
       })

       await newProduct.save()

       const totalStock = await getTotalStock(newProduct._id)

       const variants = req.body.variants
       if(variants && typeof variants === 'object'){
        const variantArray = Object.values(variants)
        console.log('Parsed Variants:', variantArray)

        for(let variant of variantArray){
            const newVariant = new ProductVariant({
                productId: newProduct._id,
                sku: variant.sku,
                size: variant.size,
                salePrice: variant.price,
                stockQuantity: variant.stockQuantity

            })
            await newVariant.save()
        }
       }
       return res.status(200).json({success: true, message: "Product added successfully"})
    } catch (error) {
        console.error("Error while adding product", error)
       return res.status(500).json({success: false, message: 'Error saving product'})      
    }
}

//block product
const blockProduct = async (req, res) => {
    try {
        const id = req.params.id
        await Product.updateOne({_id: id},{$set: {isBlocked: true}})
        res.status(200).json({success: true, message: 'product blocked'})
    } catch (error) {
        console.error('error while block product', error)
        res.status(500).json({success: false, message: 'Error unblocking products'})
    }
}

//unblock product
const unblockProduct = async (req, res) => {
    try {
        const id = req.params.id
        await Product.updateOne({_id: id},{$set: {isBlocked: false}})
        return res.status(200).json({success: true, message: 'Product unblocked'})
    } catch (error) {
        console.error("Error while unblock product", error)
        return res.status(500).json({success: false, message: 'Error unblock product'})
    }
}

//get edit product page
const getEditProduct = async (req, res) => {
    try {
        const id = req.params.id
        const product = await Product.findOne({_id: id}).populate('category')
        const category = await Category.find({})
        const brand = await Brand.find({isBlocked: false})
        const variants = await ProductVariant.find({productId: id}).lean()

        if(!product){
            return res.status(404).send('Product not found')
        }
        console.log('variants:', variants)
        res.render('edit-product',{
            product,
            category,
            brand,
            variants
        })
    } catch (error) {
        console.error('Error while loading edit product page', error)
        res.redirect('/admin/pageerror')
    }
}

//edit product details
const editProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const {name, description, categoryId, brand, regularPrice, salePrice, color} = req.body
        const existingProduct = await Product.findOne({
            name:{$regex: new RegExp(`^${name}$`, 'i')},
            _id: {$ne: productId}
        })

        if(existingProduct){
            return res.status(400).json({status: false, message: 'Product with this name already existing, Please try another name.'})
        }

        const updatedProduct = {
            name,
            description,
            categoryId,
            brand,
            regularPrice,
            salePrice,
            color
        }

        const product = await Product.findById(productId)
        if(!product){
            return res.status(404).json({status: false, message: 'Product not found'})
        }

        for(let i=1; i<= 5; i++){
            const croppedImageData = req.body[`croppedImage${i}`]

            if(croppedImageData && croppedImageData.startsWith('data: image')){
                const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, '')
                const imageBuffer = Buffer.from(base64Data, 'base64')

                const filename = Date.now() + '-' + `cropped-image-${i}` + ".webp"
                const filepath = path.join(__dirname, '../../public/images', filename)

                await sharp(imageBuffer)
                      .webp({quality: 80})
                      .toFile(filepath)

                const imagePath = `images/${filename}`

                if(product.productImage[i-1]){
                    product.productImage[i-1] = imagePath
                }else {
                    product.productImage.push(imagePath)
                }
            }else if(req.files && req.files[`image${i}`]){
                const file = req.files[`image${i}`][0]
                const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "") + ".webp"
                const filepath = path.join(__dirname, "../../public/images", filename)


                await sharp(file.buffer)
                      .resize(800, 800, {fit: "inside", withoutEnlargement: true})
                      .webp({quality: 80})
                      .toFile(filepath)

                const imagePath = `images/${filename}`

                if(product.productImage[i-1]){
                    product.productImage[i-1] = imagePath
                }else {
                    product.productImage.push(imagePath)
                }
            }
        }

        Object.assign(product, updatedProduct)

        await product.save()


        const submittedVariants = Array.isArray(req.body.variants) 
    ? req.body.variants 
    : Object.values(req.body.variants);  // handle if sent as object

const existingVariants = await ProductVariant.find({ productId: productId }).lean();

const existingMap = new Map();
existingVariants.forEach(v => {
    existingMap.set(v._id.toString(), v);
});

const submittedMap = new Map();
const toInsert = [];
const toUpdate = [];

for (let variant of submittedVariants) {
    const isNew = !variant._id;

    if (isNew) {
        // Insert new variant
        toInsert.push({
            productId: productId,
            sku: variant.sku,
            size: variant.size,
            salePrice: variant.price,
            stockQuantity: variant.stock
        });
    } else {
        const existing = existingMap.get(variant._id);
        if (!existing) continue;

        submittedMap.set(variant._id, true);

        // Check if fields differ before updating
        if (
            existing.sku !== variant.sku ||
            existing.size !== variant.size ||
            existing.salePrice !== parseFloat(variant.price) ||
            existing.stockQuantity !== parseInt(variant.stock)
        ) {
            toUpdate.push({
                _id: variant._id,
                sku: variant.sku,
                size: variant.size,
                salePrice: variant.price,
                stockQuantity: variant.stock
            });
        }
    }
}

// Execute DB ops
for (let updateVariant of toUpdate) {
    await ProductVariant.findByIdAndUpdate(updateVariant._id, updateVariant);
}

if (toInsert.length > 0) {
    await ProductVariant.insertMany(toInsert);
}


const toDelete = existingVariants
    .filter(v => !submittedMap.has(v._id.toString()))
    .map(v => v._id);

if (toDelete.length > 0) {
    await ProductVariant.deleteMany({ _id: { $in: toDelete } });
}

    res.json({success: true, message: "Product updated successfully"})
    } catch (error) {
        console.error("Error in editproduct", error)
        res.status(500).json({success: false, message: 'An error occured while updating product details'})
    }
}

//delete single image
const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer, imageIndex } = req.body;
        const product = await Product.findById(productIdToServer)

        if(!product){
            return res.status(400).json({success: true, message: 'Product not found!'})
        }
        product.productImage.splice(imageIndex, 1)
        await product.save()

        const imagePath = path.join(__dirname, '../../public', imageNameToServer)

        if(fs.existsSync(imagePath)){
            fs.unlinkSync(imagePath)
            console.log(`Image ${imageNameToServer} deleted successfully`)
        }else{
            console.log(`Image ${imageNameToServer}  not found`)
        }
        res.json({status: true, message: 'Image deleted successfully'})

    } catch (error) {
        console.error("Error while deleting image", error)
        res.status(500).json({status: false, message: 'An error occured while deleting image'})
    }
}
module.exports = {
    LoadProducts,
    getAddProducts,
    addProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}
