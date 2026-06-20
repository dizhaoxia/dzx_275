const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 850]);
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('PDF Form Filling & Signing - Comprehensive Test', {
    x: 50,
    y: 810,
    size: 18,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });

  const form = pdfDoc.getForm();
  let yPos = 770;

  page.drawText('1. Basic Information (Text Fields)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  const textFields = [
    { name: 'name', label: 'Name:', x: 50, width: 200, required: true },
    { name: 'email', label: 'Email:', x: 50, width: 250, required: true },
    { name: 'phone', label: 'Phone:', x: 320, width: 180, required: false },
    { name: 'address', label: 'Address:', x: 50, width: 450, required: false },
  ];

  for (const field of textFields) {
    page.drawText(field.label + (field.required ? ' *' : ''), {
      x: field.x,
      y: yPos + 15,
      size: 12,
      font: helveticaFont,
    });
    
    const textField = form.createTextField(field.name);
    textField.addToPage(page, { x: field.x + 60, y: yPos, width: field.width, height: 22 });
    textField.setFontSize(12);
    if (field.required) {
      textField.enableRequired();
    }
    
    yPos -= 35;
  }

  yPos -= 10;
  page.drawText('2. Gender Selection (Radio Buttons)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  const radioOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const radioField = form.createRadioGroup('gender');
  radioField.enableRequired();
  
  radioOptions.forEach((opt, i) => {
    const x = 80 + i * 120;
    radioField.addOptionToPage(opt, page, { x, y: yPos - 5, width: 16, height: 16 });
    page.drawText(opt, {
      x: x + 22,
      y: yPos,
      size: 12,
      font: helveticaFont,
    });
  });
  yPos -= 35;

  yPos -= 10;
  page.drawText('3. Country (Dropdown List)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  page.drawText('Country: *', {
    x: 50,
    y: yPos + 15,
    size: 12,
    font: helveticaFont,
  });

  const countryField = form.createDropdown('country');
  countryField.addToPage(page, { x: 110, y: yPos, width: 200, height: 22 });
  countryField.setOptions(['Please select...', 'China', 'USA', 'Japan', 'Korea', 'UK', 'France', 'Germany']);
  countryField.setFontSize(12);
  countryField.enableRequired();

  page.drawText('City: *', {
    x: 330,
    y: yPos + 15,
    size: 12,
    font: helveticaFont,
  });

  const cityField = form.createDropdown('city');
  cityField.addToPage(page, { x: 380, y: yPos, width: 170, height: 22 });
  cityField.setOptions(['Please select country first']);
  cityField.setFontSize(12);
  cityField.enableRequired();
  yPos -= 35;

  yPos -= 10;
  page.drawText('4. Skills (List Box - Multi-select)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  page.drawText('Programming Languages (multi-select):', {
    x: 50,
    y: yPos + 60,
    size: 12,
    font: helveticaFont,
  });

  const skillsField = form.createDropdown('skills');
  skillsField.addToPage(page, { x: 180, y: yPos, width: 200, height: 80 });
  skillsField.setOptions([
    'JavaScript',
    'Python',
    'Java',
    'TypeScript',
    'Go',
    'Rust',
    'C++',
    'Swift',
    'Kotlin',
    'PHP',
  ]);
  skillsField.setFontSize(12);
  skillsField.enableMultiselect();
  yPos -= 90;

  yPos -= 10;
  page.drawText('5. Discount Information (Field Linkage Demo)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  const discountCheck = form.createCheckBox('hasDiscount');
  discountCheck.addToPage(page, { x: 50, y: yPos - 5, width: 16, height: 16 });
  page.drawText('I have a discount code', {
    x: 75,
    y: yPos,
    size: 12,
    font: helveticaFont,
  });

  page.drawText('Discount Code:', {
    x: 200,
    y: yPos + 3,
    size: 12,
    font: helveticaFont,
  });
  const discountField = form.createTextField('discountCode');
  discountField.addToPage(page, { x: 300, y: yPos - 8, width: 150, height: 22 });
  discountField.setFontSize(12);
  yPos -= 35;

  yPos -= 10;
  page.drawText('6. Agreement (Checkboxes)', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  const checkboxes = [
    { name: 'agree', label: 'I agree that the above information is true and valid *', required: true },
    { name: 'newsletter', label: 'Subscribe to our newsletter', required: false },
    { name: 'terms', label: 'I have read and accept the terms of service *', required: true },
  ];

  for (const cb of checkboxes) {
    const checkbox = form.createCheckBox(cb.name);
    checkbox.addToPage(page, { x: 50, y: yPos - 5, width: 16, height: 16 });
    if (cb.required) {
      checkbox.enableRequired();
    }
    page.drawText(cb.label, {
      x: 75,
      y: yPos,
      size: 12,
      font: helveticaFont,
    });
    yPos -= 28;
  }

  yPos -= 10;
  page.drawText('7. Signature Area', {
    x: 50,
    y: yPos,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 30;

  page.drawText('Signature (click area to sign):', {
    x: 50,
    y: yPos + 40,
    size: 12,
    font: helveticaFont,
  });

  page.drawRectangle({
    x: 110,
    y: yPos,
    width: 250,
    height: 60,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 2,
    color: rgb(0.98, 0.98, 0.98),
  });
  
  page.drawText('Sign here', {
    x: 190,
    y: yPos + 28,
    size: 14,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  });

  page.drawText('Date: *', {
    x: 380,
    y: yPos + 40,
    size: 12,
    font: helveticaFont,
  });

  const dateField = form.createTextField('date');
  dateField.addToPage(page, { x: 420, y: yPos + 25, width: 130, height: 22 });
  dateField.setFontSize(12);
  dateField.enableRequired();

  page.drawText('* Fields marked with asterisk are required', {
    x: 50,
    y: 30,
    size: 10,
    font: helveticaFont,
    color: rgb(0.8, 0, 0),
  });

  page.drawText('Tips: Use Undo/Redo to revert mistakes. Three signature methods available.', {
    x: 50,
    y: 15,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  
  const outputPath = path.join(__dirname, 'public', 'samples', 'sample-form.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  
  console.log('✅ Test PDF created successfully:', outputPath);
  console.log('   Field types: Text(Tx), Radio Button, Dropdown');
  console.log('                ListBox, Checkbox, Signature(Sig)');
  console.log('   Features: Field linkage, Required validation, Undo/Redo, Multi-engine rendering');
}

createTestPDF().catch(console.error);
