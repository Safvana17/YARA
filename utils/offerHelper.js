function getBestOfferPrice(salePrice, productOffer =0, categoryOffer = 0){

    const maxOffer = Math.max(productOffer, categoryOffer)
    if(maxOffer === 0) return null
    const discount = (salePrice * maxOffer) / 100
    

    return Math.round(salePrice - discount)
}

module.exports = getBestOfferPrice