
const getProductPrice = (product, offer) => {
    const salePrice = product.baseSalePrice
    if (!offer) {
        return {
            originalPrice: salePrice,
            finalPrice: salePrice,
        }
    }

    const finalPrice =  Math.round(salePrice - (salePrice * offer / 100))
    return {
        originalPrice: salePrice,
        finalPrice,
    }
}

module.exports = {
    getProductPrice
}