const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')


function generatePDF(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer){
    const doc = new PDFDocument({ margin: 40, size: 'A4'})

    res.setHeader('content-type', 'application/pdf')
    res.setHeader('conten-disposition', 'attachement; filename="sales_report.pdf"')

    doc.pipe(res)
    doc.fontSize(22).fillColor('#333366').text('YARA Sales Report', {align: 'center'}).moveDown(2)

    let y = doc.y
    doc
      .fontSize(12)
      .fillColor('#000')
      .text('SL', 50, y)
      .text('Order ID', 90, y)
      .text('User', 200, y)
      .text('Date', 280, y)
      .text('Amount', 370, y)
      .text('Dicount', 440, y)
      .text('Offer', 510, y)
      .moveDown(0.5)

      y += 20
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()


    y += 10
    salesData.forEach((item, i) =>{
        doc
          .fontSize(10)
          .fillColor('#000')
          .text(`${i + 1}`, 50, y)
          .text(`${item.orderId.slice(0, 6)}`, 90, y)
          .text(`${item.user}`, 200, y)
          .text(`${item.date}`, 280, y)
          .text(`${item.totalAmount}`, 370, y)
          .text(`${item.discount}`, 440, y)
          .text(`${item.offer}`, 510, y)
          .moveDown(0.5)
     y += 20
     if(y > 750){
        doc.addPage()
        y = 50
     }
    })

    y += 30
    doc.moveDown(1)
    doc
        .fontSize(12)
        .fillColor('#000')
        .text(`Total Orders: ${totalSale}`, 50, y)
        .text(`Total Amount: ₹${totalAmount}`, 50, y+20)
        .text(`Total Discount: ₹${totalDiscount}`, 50, y+40)
        .text(`Total Offer: ₹${totalOffer}`,50, y+60)
    doc.end()
}

async function generateExcel(res, salesData, totalSale, totalAmount, totalDiscount, totalOffer) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Sales Report')

    worksheet.columns = [
        { header: 'SL', key: 'sl', width: 6 },
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'User', key: 'user', width: 25 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Offer', key: 'offer', width: 15 },
        { header: 'Payment', key: 'payment', width: 15 },
    ]

    // Add rows
    salesData.forEach((row, i) => {
        worksheet.addRow({ sl: i + 1, ...row })
    })

    // Styling header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF333366' },
    }
    worksheet.getRow(1).alignment = { horizontal: 'center' }

    worksheet.addRow([]) // empty row

    worksheet.addRow({
        user: 'TOTALS:',
        totalAmount,
        discount: totalDiscount,
        offer: totalOffer
    })

    const lastRow = worksheet.lastRow
    lastRow.font = { bold: true }
    lastRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        }
    })

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"')

    await workbook.xlsx.write(res)
    res.end()
}



module.exports = {
    generatePDF,
    generateExcel
}