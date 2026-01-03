const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function createGrid() {
    const pdfBytes = fs.readFileSync('../new_pt_packet_2025.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Only process pages 2, 3, 4 (Indices 2, 3, 4 for Pages 3, 4, 5)
    // 0-indexed: Page 1=0, Page 3=2
    const targetIndices = [2, 3, 4];

    targetIndices.forEach(idx => {
        if (idx < pages.length) {
            const page = pages[idx];
            const { width, height } = page.getSize();

            // Draw grid lines every 50 units
            for (let x = 0; x < width; x += 50) {
                page.drawLine({
                    start: { x, y: 0 },
                    end: { x, y: height },
                    color: rgb(0.8, 0.8, 0.8),
                    thickness: 1,
                    opacity: 0.5
                });
                page.drawText(`${x}`, { x: x + 2, y: 10, size: 8, color: rgb(1, 0, 0) });
            }

            for (let y = 0; y < height; y += 50) {
                page.drawLine({
                    start: { x: 0, y },
                    end: { x: width, y },
                    color: rgb(0.8, 0.8, 0.8),
                    thickness: 1,
                    opacity: 0.5
                });
                page.drawText(`${y}`, { x: 5, y: y + 2, size: 8, color: rgb(1, 0, 0) });
            }
        }
    });

    const pdfOut = await pdfDoc.save();
    fs.writeFileSync('debug_grid.pdf', pdfOut);
    console.log("Created debug_grid.pdf");
}

createGrid();
