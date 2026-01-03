const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function listFields() {
    const pdfBytes = fs.readFileSync('../new_pt_packet_2025.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log("Found " + fields.length + " fields:");
    fields.forEach(field => {
        const type = field.constructor.name;
        const name = field.getName();
        console.log(`- ${name} (${type})`);
    });
}

listFields();
