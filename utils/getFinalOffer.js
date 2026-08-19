
const getActiveOffer = (offer, isActive, startDate, endDate) => {
    if (!isActive || !offer || offer <= 0) {
        return 0
    }

    const now = new Date()

    if (startDate && now < new Date(startDate)) {
        return 0
    }

    if (endDate && now > new Date(endDate)) {
        return 0
    }

    return offer
}

const getFinalOffer = (product) => {
    const productOffer = getActiveOffer(
        product.productOffer,
        product.isOfferActive,
        product.offerStartDate,
        product.offerEndDate
    )

    const categoryOffer = getActiveOffer(
        product.category?.categoryOffer,
        product.category?.isOfferActive,
        product.category?.offerStartDate,
        product.category?.offerEndDate
    )

    return Math.max(productOffer, categoryOffer)
}

module.exports = {
    getFinalOffer
}