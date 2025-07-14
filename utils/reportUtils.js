const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')


function generatePDF(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer){
    const doc = new PDFDocument()
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('conten-disposition', 'attachement; filename="sales_report.pdf"')

    doc.pipe(res)
    doc.fontSize(18).text('Sales Report', {align: 'center'}).moveDown()

    salesData.forEach((item, i) =>{
        doc.fontSize(12).text(
            `${i + 1}. Order ID: ${item.orderId}, user: ${item.user}, Date: ${item.date}, Amount: ₹${item.totalAmount}, Discount: ₹${item.discount}, Offer: ₹${item.offer}`
        )
    })

    doc.moveDown()
    doc.text(`Total Orders: ${totalSale}`)
    doc.text(`Total Amount: ₹${totalAmount}`)
    doc.text(`Total Discount: ₹${totalDiscount}`)
    doc.text(`Total Offer: ₹${totalOffer}`)
    doc.end()
}

async function generateExcel(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Sales Report')

    worksheet.columns = [
        {header: 'Order Id', key: 'orderId', width: 20},
        {header: 'User', key: 'user', width: 20},
        {header: 'Date', key: 'date', width: 15},
        {header: 'Amount', key: 'totalAmount', width: 15},
        {header: 'Discount', key: 'discount', width: 15},
        {header: 'Offer', key: 'offer', width: 15},
        {header: 'Payment', key: 'payment', width: 15},
    ]

    salesData.forEach(row => worksheet.addRow(row))

    worksheet.addRow([])
    worksheet.addRow({
        user: 'TOTALS:',
        totalAmount,
        discount: totalDiscount,
        offer: totalOffer
    })

    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('content-disposition', 'attachment; filename="sales_report.xlsx"')

    await workbook.xlsx.write(res)
    res.send()

}


module.exports = {
    generatePDF,
    generateExcel
}