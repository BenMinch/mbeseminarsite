const fs = require('fs');
const os = require('os');
const path = require('path');
const { Busboy } = require('@fastify/busboy');
const { PythonShell } = require('python-shell');

// Helper function to parse multipart form data
const parseMultipart = (event) => {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] },
    });
    const result = {};

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        result.file = Buffer.concat(chunks);
        result.filename = filename;
        result.contentType = mimetype;
      });
    });

    busboy.on('finish', () => resolve(result));
    busboy.on('error', (err) => reject(err));
    busboy.end(Buffer.from(event.body, 'base64'));
  });
};

exports.handler = async (event) => {
  try {
    // 1. Parse the uploaded file from the request
    const { file, filename } = await parseMultipart(event);
    
    // 2. Create temporary file paths. Netlify functions can write to /tmp
    const tempCsvPath = path.join(os.tmpdir(), filename.replace(/[^a-zA-Z0-9.]/g, ''));
    const tempPdfPath = path.join(os.tmpdir(), 'summary.pdf');

    fs.writeFileSync(tempCsvPath, file);

    // 3. Set up and run the Python script
    const options = {
      mode: 'text',
      pythonPath: 'python', // <-- THIS IS THE FIX
      pythonOptions: ['-u'], // get print results in real-time
      scriptPath: path.dirname(__filename), // path to this function's directory
      args: [tempCsvPath, tempPdfPath], // pass input/output paths to python
    };

    await PythonShell.run('seminar_feedback.py', options);
    
    // 4. Read the generated PDF from the temporary directory
    const pdfData = fs.readFileSync(tempPdfPath);

    // 5. Clean up the temporary files
    fs.unlinkSync(tempCsvPath);
    fs.unlinkSync(tempPdfPath);

    // 6. Return the PDF to the browser
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="seminar_summary.pdf"',
      },
      body: pdfData.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'There was an error processing your file.' }),
    };
  }
};
