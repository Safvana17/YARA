const express = require('express')
const adminController = require('../controller/admin/adminController')
const customerController = require('../controller/admin/customerController')
const categoryController = require('../controller/admin/categoryController')
const brandController = require('../controller/admin/brandController')
const productController = require('../controller/admin/productController')
const orderController = require('../controller/admin/orderController')
const couponController = require('../controller/admin/couponController')
const dashboardController = require('../controller/admin/dashboardController')
const {adminAuth, userAuth} = require('../middleware/auth')
const upload = require('../middleware/multerConfig')
const router = express.Router()

router.get('/pageerror', adminController.pageError)
router.get('/login', adminController.loadLogin)
router.post('/login', adminController.login)
router.get('/logout', adminController.logout)

//customer management
router.get('/customers',adminAuth,customerController.loadCustomers)
router.get('/block/:id', adminAuth, customerController.blockCustomer)
router.get('/unblock/:id',adminAuth, customerController.unblockCustomer)
router.get('/viewcustomer/:id', adminAuth, customerController.customerInfo)

//category management
router.get('/category', adminAuth, categoryController.loadCategories)
router.post('/addcategory', adminAuth, categoryController.addCategory)
router.get('/category/:id/list', adminAuth, categoryController.listCategory)
router.get('/category/:id/unlist', adminAuth, categoryController.unlistCategory)
router.get('/category/edit/:id', adminAuth, categoryController.getEditCategory)
router.post('/category/edit/:id', adminAuth, categoryController.editCategory)
router.post('/category/add-category-offer/:id', adminAuth, categoryController.addOffer)
router.delete('/category/remove-category-offer/:id', adminAuth, categoryController.removeOffer)

//brand management
router.get('/brands', adminAuth, brandController.loadBrands)
router.post('/brand/add', adminAuth,upload.single('brandImage'), brandController.addBrand)
router.get('/brand/block/:id', adminAuth, brandController.blockBrand)
router.get('/brand/unblock/:id', adminAuth, brandController.unblockBrand)
router.get('/brand/delete/:id', adminAuth, brandController.deleteBrand)

//product management
router.get('/products', adminAuth, productController.LoadProducts)
router.get('/add-products', adminAuth, productController.getAddProducts)
router.post('/add-product', adminAuth,upload.fields([
    {name: 'image1', maxCount: 1},
    {name: 'image2', maxCount: 1},
    {name: 'image3', maxCount: 1},
    {name: 'image4', maxCount: 1},
    {name: 'image5', maxCount: 1}
]),
 productController.addProducts)
 router.post('/product/block/:id', adminAuth, productController.blockProduct)
 router.post('/product/unblock/:id', adminAuth, productController.unblockProduct)
 router.get('/edit-product/:id', adminAuth, productController.getEditProduct)
 router.post('/editProduct/:id', adminAuth,
    upload.fields([
        {name: 'image1', maxCount: 1},
        {name: 'image2', maxCount: 1},
        {name: 'image3', maxCount: 1},
        {name: 'image4', maxCount: 1},
        {name: 'image5', maxCount: 1}
    ]) ,productController.editProduct)
 router.post('/deleteImage', adminAuth, productController.deleteSingleImage)
 router.post('/product/add-product-offer/:id', adminAuth, productController.addOffer)
router.delete('/product/remove-product-offer/:id', adminAuth, productController.removeOffer)

//order managemnet
router.get('/orders', adminAuth, orderController.getOrders)
router.get('/order-details/:id', adminAuth, orderController.viewOrderDetails)
router.post('/update-order-status/:orderId/:itemId', adminAuth, orderController.updateOrderStatus)
router.get('/download-invoice/:id', adminAuth, orderController.getInvoice)
router.post('/approve-return/:id', adminAuth, orderController.approveReturnRequest)
router.post('/cancel-return/:id', adminAuth, orderController.cancelReturnRequest)
router.post('/approve-item-return/:orderId/:itemId', (req, res, next) => {
  console.log("Route middleware hit");
  next();
}, adminAuth, orderController.approveItemReturnRequest);

router.post('/cancel-item-return/:orderId/:itemId', adminAuth, orderController.cancelItemReturnRequest)

//coupon management
router.get('/coupons', adminAuth, couponController.loadCouponPage)
router.get('/coupons/add', adminAuth, couponController.loadAddCouponPage)
router.post('/coupons/add', adminAuth, couponController.addCoupon)
router.get('/coupons/edit/:id', adminAuth, couponController.getEditPage)
router.post('/coupons/edit/:id', adminAuth, couponController.editCoupon)
router.delete('/coupons/delete/:id', adminAuth, couponController.deleteCoupon)

//sales report
router.get('/report', adminAuth, adminController.getReport)
router.get('/report/generate', adminAuth, adminController.getReport)

//dashboard
router.get('/',adminAuth, dashboardController.loadDashboard)
router.get('/dashboard-data', dashboardController.getDashboardData)




module.exports = router