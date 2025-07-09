function getBestOfferPrice(regularPrice, productOffer =0, categoryOffer = 0){

    const maxOffer = Math.max(productOffer, categoryOffer)
    if(maxOffer === 0) return null
    const discount = (regularPrice * maxOffer) / 100
    

    return Math.round(regularPrice - discount)
}

module.exports = getBestOfferPrice