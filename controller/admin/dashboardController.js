const Order = require('../../models/orderSchema')
const Brand = require('../../models/brandSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const moment = require('moment')


//dashbord
const loadDashboard = async (req, res) => {
   if(req.session.admin){
    try {
        res.render('dashboard')
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
   }
}

//get dashboard data
const getDashboardData = async (req, res) => {
    try {
        const filter = req.query.filter || 'yearly'
        const start = req.query.start
        const end = req.query.end

        let dateFilter = {}


        if(filter === 'custom' && start && end){
            dateFilter = {
                createdAt: {
                   $gte: new Date(start),
                   $lte: moment(end).endOf('day').toDate()
                }
            }           
        }

        const matchStage = {
            ...dateFilter,
            status: {$nin: ['Cancelled', 'Returned']}
        }

        const matchAllStage = {...dateFilter}

        let groupStage
        if(filter === 'monthly'){
            groupStage = {
                _id: {
                    year: {$year: '$createdAt' },
                    month: {$month: '$createdAt'}
                },
                totalSales: {$sum: '$finalAmount'},
                count: {$sum: 1}
            }
        }else if(filter === 'custom'){
            groupStage = {
                _id: {
                    year: { $year: '$createdAt'},
                    month: {$month: '$createdAt'},
                    day: {$dayOfMonth: '$createdAt'}
                },
                totalSales: {$sum: '$finalAmount'},
                count: {$sum: 1}
            }
        }else if(filter === 'weekly'){
            groupStage = {
                _id: {
                    year: {$year: '$createdAt'},
                    week: {$isoWeek: '$createdAt'}
                },
                totalSales: {$sum: '$finalAmount'},
                count: {$sum: 1}
            }
        }else{
            groupStage = {
                _id: {
                    year: {$year: '$createdAt'}
                },
                totalSales: {$sum: '$finalAmount'},
                count: {$sum: 1}
            }
        }


        const salesChart = await Order.aggregate([
            {$match: matchStage},
            {$group: groupStage},
            {$sort: {"_id.year":1, "_id.month": 1, "_id.day": 1, "_id.week": 1}}
        ])

        //best selling product
        const bestProducts = await Order.aggregate([
            {$unwind: '$orderItems'},
            {$group: {
                _id: '$orderItems.product',
                totalQty: {$sum: '$orderItems.quantity'}
               }
            },
            {$sort: {totalQty: -1}},
            {$limit: 5},
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {$unwind: '$product'},
            {$project: {name: '$product.name', totalQty: 1}}
        ])

        //best selling categories
        const bestCategories = await Order.aggregate([
            {$unwind: '$orderItems'},
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {$unwind: '$product'},
            {
                $group: {
                    _id: '$product.category',
                    totalQty: {$sum: '$orderItems.quantity'}
                }
            },
            {$sort: {totalQty: -1}},
            {$limit: 5},
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {$unwind: '$category'},
            {$project: {name: '$category.name', totalQty: 1}}
        ])

        //best selling brands
        const bestBrands = await Order.aggregate([
            {$unwind: '$orderItems'},
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {$unwind: '$product'},
            {
                $group: {
                    _id: '$product.brand',
                    totalQty: {$sum: "$orderItems.quantity"}
                }
            },
            {$sort: {totalQty: -1}},
            {$limit: 5},
            {
                $lookup: {
                    from: 'brands',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'brand'
                }
            },
            {$unwind: '$brand'},
            {$project: {name: '$brand.brandName', totalQty: 1}}
        ])


        
     // Totals
       const totalOrdersAgg = await Order.aggregate([
            { $match: matchAllStage }, // Filter based on date or other conditions
            { $unwind: '$orderItems' },
            {
                $group: {
                _id: null,
                totalOrders: { $sum: '$orderItems.quantity' }
                }
            }
        ]);

        const totalOrders = totalOrdersAgg[0]?.totalOrders || 0;


        const totalRevenueAgg = await Order.aggregate([
        {
            $match: {
            status: { $nin: ['Cancelled', 'Returned'] }, // Skip fully refunded orders
            ...dateFilter
            }
        },
        {
            $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' }
            }
        }
        ]);

        const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;


    // const totalCancels = await Order.countDocuments({ ...matchAllStage, status: 'Cancelled' });
    const cancelledCount = await Order.aggregate([
        
        {$unwind: '$orderItems'},
        {$match: {'orderItems.itemStatus': 'Cancelled' ,...dateFilter}},
        {$count: 'totalCancels'}
    ])
    const returnedCount = await Order.aggregate([
        {$unwind: '$orderItems'},
        {$match: {'orderItems.itemStatus': 'Returned', ...dateFilter}},
        {$count: 'totalReturns'}
    ])

        //status for pie chart
        const orderStatus = await Order.aggregate([
            {$unwind: '$orderItems'},
            {
                
                $group: {
                    _id: '$orderItems.itemStatus',
                    count: {$sum: 1}
                }
            }
        ])


        const totalCancels = cancelledCount[0]?.totalCancels || 0
        const totalReturns = returnedCount[0]?.totalReturns || 0
        res.json({
            totalCancels,
            totalOrders,
            totalReturns,
            totalRevenue,
            salesChart,
            bestProducts,
            bestCategories,
            bestBrands,
            orderStatus
        })
    } catch (error) {
        console.error('Error while generating dashboard data', error)
        res.status(500).json({error: 'Failed to load dashboard dta'})
    }
}

module.exports = {
    loadDashboard,
    getDashboardData
}


