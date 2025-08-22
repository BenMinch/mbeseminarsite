const { Busboy } = require('@fastify/busboy');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

// Helper function to parse multipart form data
const parseMultipart = (event) => {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] },
    });
    const result = { file: null };

    busboy.on('file', (fieldname, file) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => { result.file = Buffer.concat(chunks); });
    });

    busboy.on('finish', () => resolve(result));
    busboy.on('error', (err) => reject(err));
    busboy.end(Buffer.from(event.body, 'base64'));
  });
};

// Helper function to parse CSV buffer
const parseCsv = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Helper function to draw a text page
const drawTextPage = (doc, title, items) => {
  doc.addPage({ margin: 50 });
  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(12).font('Helvetica');
  items.forEach(item => {
    if (item.trim()) {
      doc.text(`• ${item.trim()}`, { indent: 20, paragraphGap: 10 });
    }
  });
};

exports.handler = async (event) => {
  try {
    // 1. PARSE THE UPLOADED CSV
    const { file } = await parseMultipart(event);
    if (!file) throw new Error('File not found in upload.');
    
    const data = await parseCsv(file);

    // 2. PROCESS THE DATA (similar to the Python script)
    const feedbackHeaders = Object.keys(data[0]).filter(h => h.includes('['));
    const numericData = data.map(row => {
        return feedbackHeaders.map(header => {
            const value = String(row[header]).split(':')[0];
            return parseFloat(value) || 0;
        });
    });
    
    const columnNames = ['Importance', 'Methods', 'Results', 'Discussion', 'Research Quality', 'Presentation Quality'];
    const totalScores = numericData.flat().filter(score => score > 0);
    const meanScore = totalScores.reduce((a, b) => a + b, 0) / totalScores.length;

    const keyTakeaways = data.map(row => row[Object.keys(row)[6]]).filter(Boolean);
    const strengths = data.map(row => row[Object.keys(row)[7]]).filter(Boolean);
    const improvements = data.map(row => row[Object.keys(row)[8]]).filter(Boolean);


    // 3. GENERATE THE PDF
    const pdfBuffer = await new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // --- Page 1: Heatmap ---
      doc.fontSize(18).font('Helvetica-Bold').text('Seminar Feedback Heatmap', { align: 'center' });
      doc.moveDown(2);
      
      const heatmapStartY = 150;
      const cellWidth = 80;
      const cellHeight = 25;
      const maxScore = 5; // Assuming scores are out of 5 for color calculation
      
      // Draw Column Headers
      doc.fontSize(10).font('Helvetica-Bold');
      columnNames.forEach((name, i) => {
        doc.text(name.replace(' ', '\n'), 50 + i * cellWidth, heatmapStartY - 50, { width: cellWidth, align: 'center' });
      });

      // Draw Heatmap Cells
      numericData.forEach((row, rowIndex) => {
        row.forEach((score, colIndex) => {
          const x = 50 + colIndex * cellWidth;
          const y = heatmapStartY + rowIndex * cellHeight;
          const blue = (score / maxScore) * 255;
          const red = 255 - blue;
          // [R, G, B] color
          const color = [red, 0, blue]; 

          doc.rect(x, y, cellWidth, cellHeight).fill(color);
          doc.fillColor('white').text(score.toFixed(1), x, y + 8, { width: cellWidth, align: 'center' });
        });
      });
      doc.font('Helvetica').fontSize(12).fillColor('black').text('Responses', 20, heatmapStartY + (numericData.length * cellHeight) / 2, { rotation: -90 });
      
      // --- Page 2: Mean Overall Score ---
      doc.addPage();
      doc.fontSize(40).font('Helvetica-Bold').text(meanScore.toFixed(2), { align: 'center' }, doc.page.height / 2 - 50);
      doc.fontSize(20).font('Helvetica').text('Mean Overall Score', { align: 'center' });

      // --- Subsequent Pages: Qualitative Feedback ---
      drawTextPage(doc, 'Key Takeaways', keyTakeaways);
      drawTextPage(doc, 'Speaker Strengths', strengths);
      drawTextPage(doc, 'Suggestions for Improvement', improvements);
      
      doc.end();
    });

    // 4. RETURN THE PDF RESPONSE
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="seminar_summary.pdf"',
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
