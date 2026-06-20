const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('PDF Form Filling & Signing - Test Document', {
    x: 50,
    y: 750,
    size: 20,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('Personal Information', {
    x: 50,
    y: 700,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Name:', {
    x: 50,
    y: 660,
    size: 12,
    font: helveticaFont,
  });

  page.drawText('Email:', {
    x: 50,
    y: 620,
    size: 12,
    font: helveticaFont,
  });

  page.drawText('Phone:', {
    x: 50,
    y: 580,
    size: 12,
    font: helveticaFont,
  });

  page.drawText('Address:', {
    x: 50,
    y: 540,
    size: 12,
    font: helveticaFont,
  });

  const form = pdfDoc.getForm();

  const nameField = form.createTextField('name');
  nameField.addToPage(page, { x: 110, y: 650, width: 200, height: 20 });
  nameField.setFontSize(12);

  const emailField = form.createTextField('email');
  emailField.addToPage(page, { x: 110, y: 610, width: 250, height: 20 });
  emailField.setFontSize(12);

  const phoneField = form.createTextField('phone');
  phoneField.addToPage(page, { x: 110, y: 570, width: 150, height: 20 });
  phoneField.setFontSize(12);

  const addressField = form.createTextField('address');
  addressField.addToPage(page, { x: 110, y: 530, width: 350, height: 20 });
  addressField.setFontSize(12);

  page.drawText('Options', {
    x: 50,
    y: 480,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  const checkBox1 = form.createCheckBox('agree');
  checkBox1.addToPage(page, { x: 50, y: 445, width: 16, height: 16 });
  page.drawText('I agree that the above information is true and valid', {
    x: 75,
    y: 448,
    size: 12,
    font: helveticaFont,
  });

  const checkBox2 = form.createCheckBox('newsletter');
  checkBox2.addToPage(page, { x: 50, y: 415, width: 16, height: 16 });
  page.drawText('Subscribe to our newsletter', {
    x: 75,
    y: 418,
    size: 12,
    font: helveticaFont,
  });

  const checkBox3 = form.createCheckBox('terms');
  checkBox3.addToPage(page, { x: 50, y: 385, width: 16, height: 16 });
  page.drawText('I have read and accept the terms of service', {
    x: 75,
    y: 388,
    size: 12,
    font: helveticaFont,
  });

  page.drawText('Signature', {
    x: 50,
    y: 330,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Sign here:', {
    x: 50,
    y: 290,
    size: 12,
    font: helveticaFont,
  });

  page.drawRectangle({
    x: 50,
    y: 220,
    width: 300,
    height: 60,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  page.drawText('Date:', {
    x: 370,
    y: 260,
    size: 12,
    font: helveticaFont,
  });

  const dateField = form.createTextField('date');
  dateField.addToPage(page, { x: 410, y: 252, width: 120, height: 20 });
  dateField.setFontSize(12);

  const pdfBytes = await pdfDoc.save();
  
  const outputPath = path.join(__dirname, 'public', 'samples', 'sample-form.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  
  console.log('Test PDF created:', outputPath);
}

createTestPDF().catch(console.error);
