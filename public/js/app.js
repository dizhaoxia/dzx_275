const PDFJS = window['pdfjsLib'];

PDFJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  baseScale: 1.0,
  pdfBytes: null,
  formFields: {},
  signatures: [],
  pageViewport: null,
};

const elements = {
  fileInput: document.getElementById('fileInput'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  currentPage: document.getElementById('currentPage'),
  totalPages: document.getElementById('totalPages'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  zoomLevel: document.getElementById('zoomLevel'),
  pdfContainer: document.getElementById('pdfContainer'),
  pdfPlaceholder: document.getElementById('pdfPlaceholder'),
  pdfWrapper: document.getElementById('pdfWrapper'),
  pdfCanvas: document.getElementById('pdfCanvas'),
  formFieldsLayer: document.getElementById('formFieldsLayer'),
  signaturesLayer: document.getElementById('signaturesLayer'),
  signatureBtn: document.getElementById('signatureBtn'),
  flattenBtn: document.getElementById('flattenBtn'),
  signatureModal: document.getElementById('signatureModal'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalClose: document.getElementById('modalClose'),
  signatureCanvas: document.getElementById('signatureCanvas'),
  clearSignature: document.getElementById('clearSignature'),
  undoSignature: document.getElementById('undoSignature'),
  penSize: document.getElementById('penSize'),
  penColor: document.getElementById('penColor'),
  cancelSignature: document.getElementById('cancelSignature'),
  confirmSignature: document.getElementById('confirmSignature'),
};

let signatureCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let strokeHistory = [];
let currentStroke = [];

function init() {
  bindEvents();
  initSignatureCanvas();
}

function bindEvents() {
  elements.fileInput.addEventListener('change', handleFileUpload);
  elements.loadSampleBtn.addEventListener('click', loadSamplePdf);
  elements.prevPage.addEventListener('click', () => changePage(-1));
  elements.nextPage.addEventListener('click', () => changePage(1));
  elements.zoomIn.addEventListener('click', () => setZoom(state.scale * 1.2));
  elements.zoomOut.addEventListener('click', () => setZoom(state.scale / 1.2));

  elements.signatureBtn.addEventListener('click', openSignatureModal);
  elements.flattenBtn.addEventListener('click', flattenAndDownload);

  elements.modalOverlay.addEventListener('click', closeSignatureModal);
  elements.modalClose.addEventListener('click', closeSignatureModal);
  elements.cancelSignature.addEventListener('click', closeSignatureModal);
  elements.confirmSignature.addEventListener('click', confirmSignature);
  elements.clearSignature.addEventListener('click', clearSignatureCanvas);
  elements.undoSignature.addEventListener('click', undoLastStroke);
  elements.penSize.addEventListener('input', updatePenStyle);
  elements.penColor.addEventListener('input', updatePenStyle);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = function(event) {
    const typedArray = new Uint8Array(event.target.result);
    state.pdfBytes = typedArray;
    loadPdf(typedArray);
  };
  fileReader.readAsArrayBuffer(file);
}

async function loadSamplePdf() {
  try {
    const response = await fetch('/samples/sample-form.pdf');
    const arrayBuffer = await response.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    state.pdfBytes = typedArray;
    loadPdf(typedArray);
  } catch (error) {
    console.error('加载示例PDF失败:', error);
    alert('加载示例PDF失败');
  }
}

async function loadPdf(data) {
  try {
    const loadingTask = PDFJS.getDocument({ data: data });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;
    state.formFields = {};
    state.signatures = [];

    elements.totalPages.textContent = state.totalPages;
    elements.currentPage.textContent = state.currentPage;
    elements.prevPage.disabled = true;
    elements.nextPage.disabled = state.totalPages <= 1;
    elements.flattenBtn.disabled = false;
    elements.pdfPlaceholder.style.display = 'none';
    elements.pdfWrapper.style.display = 'block';

    await renderPage(state.currentPage);
  } catch (error) {
    console.error('加载PDF失败:', error);
    alert('加载PDF失败，请检查文件格式');
  }
}

async function renderPage(pageNum) {
  const page = await state.pdfDoc.getPage(pageNum);
  
  const containerWidth = elements.pdfContainer.clientWidth - 40;
  const viewport = page.getViewport({ scale: 1 });
  state.baseScale = Math.min(containerWidth / viewport.width, 1.5);
  state.scale = state.baseScale;

  const scaledViewport = page.getViewport({ scale: state.scale });
  state.pageViewport = scaledViewport;

  const canvas = elements.pdfCanvas;
  const context = canvas.getContext('2d');
  canvas.height = scaledViewport.height;
  canvas.width = scaledViewport.width;

  elements.pdfWrapper.style.width = scaledViewport.width + 'px';
  elements.formFieldsLayer.style.width = scaledViewport.width + 'px';
  elements.formFieldsLayer.style.height = scaledViewport.height + 'px';
  elements.signaturesLayer.style.width = scaledViewport.width + 'px';
  elements.signaturesLayer.style.height = scaledViewport.height + 'px';

  elements.zoomLevel.textContent = Math.round(state.scale * 100);

  const renderContext = {
    canvasContext: context,
    viewport: scaledViewport,
  };

  await page.render(renderContext).promise;

  await renderFormFields(page);
  renderSignatures();
}

async function renderFormFields(page) {
  elements.formFieldsLayer.innerHTML = '';

  try {
    const annotations = await page.getAnnotations();
    
    annotations.forEach(annotation => {
      if (annotation.subtype === 'Widget') {
        const fieldType = annotation.fieldType;
        const fieldName = annotation.fieldName;
        const rect = annotation.rect;

        const viewport = page.getViewport({ scale: state.scale });
        
        const left = rect[0] * state.scale;
        const bottom = rect[1] * state.scale;
        const width = (rect[2] - rect[0]) * state.scale;
        const height = (rect[3] - rect[1]) * state.scale;
        
        const top = viewport.height - bottom - height;

        if (!state.formFields[state.currentPage]) {
          state.formFields[state.currentPage] = [];
        }

        let existingField = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
        let fieldValue = annotation.fieldValue || '';
        if (existingField) {
          fieldValue = existingField.value;
        } else {
          state.formFields[state.currentPage].push({
            fieldName: fieldName,
            fieldType: fieldType,
            rect: rect,
            value: fieldValue,
          });
        }

        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.style.left = left + 'px';
        fieldDiv.style.top = top + 'px';
        fieldDiv.style.width = width + 'px';
        fieldDiv.style.height = height + 'px';

        if (fieldType === 'Tx') {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = fieldValue || '';
          input.dataset.fieldName = fieldName;
          input.style.fontSize = (height * 0.6) + 'px';
          
          input.addEventListener('input', (e) => {
            updateFieldValue(fieldName, e.target.value);
          });
          
          fieldDiv.appendChild(input);
        } else if (fieldType === 'Btn') {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = fieldValue === 'Yes' || fieldValue === true;
          input.dataset.fieldName = fieldName;
          
          input.addEventListener('change', (e) => {
            updateFieldValue(fieldName, e.target.checked ? 'Yes' : 'Off');
          });
          
          fieldDiv.appendChild(input);
        }

        elements.formFieldsLayer.appendChild(fieldDiv);
      }
    });
  } catch (error) {
    console.log('解析表单字段时出现问题（可能没有表单）:', error);
  }
}

function updateFieldValue(fieldName, value) {
  if (!state.formFields[state.currentPage]) return;
  
  const field = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
  if (field) {
    field.value = value;
  }
}

function changePage(delta) {
  const newPage = state.currentPage + delta;
  if (newPage < 1 || newPage > state.totalPages) return;

  state.currentPage = newPage;
  elements.currentPage.textContent = state.currentPage;
  elements.prevPage.disabled = state.currentPage <= 1;
  elements.nextPage.disabled = state.currentPage >= state.totalPages;

  renderPage(state.currentPage);
}

function setZoom(newScale) {
  if (newScale < 0.3 || newScale > 3) return;
  
  state.scale = newScale;
  renderPage(state.currentPage);
}

function initSignatureCanvas() {
  const canvas = elements.signatureCanvas;
  signatureCtx = canvas.getContext('2d');
  
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  signatureCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
  signatureCtx.strokeStyle = '#000000';
  signatureCtx.lineWidth = 3;

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
}

function getCanvasPos(e) {
  const canvas = elements.signatureCanvas;
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function startDrawing(e) {
  isDrawing = true;
  const pos = getCanvasPos(e);
  lastX = pos.x;
  lastY = pos.y;
  currentStroke = [{ x: lastX, y: lastY }];
  
  signatureCtx.beginPath();
  signatureCtx.moveTo(lastX, lastY);
}

function draw(e) {
  if (!isDrawing) return;
  
  const pos = getCanvasPos(e);
  
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
  
  currentStroke.push({ x: pos.x, y: pos.y });
  lastX = pos.x;
  lastY = pos.y;
}

function stopDrawing() {
  if (isDrawing && currentStroke.length > 0) {
    strokeHistory.push([...currentStroke]);
    currentStroke = [];
  }
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  startDrawing(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  draw(mouseEvent);
}

function clearSignatureCanvas() {
  const canvas = elements.signatureCanvas;
  signatureCtx.clearRect(0, 0, canvas.width, canvas.height);
  strokeHistory = [];
  currentStroke = [];
}

function undoLastStroke() {
  if (strokeHistory.length === 0) return;
  
  strokeHistory.pop();
  redrawSignature();
}

function redrawSignature() {
  const canvas = elements.signatureCanvas;
  signatureCtx.clearRect(0, 0, canvas.width, canvas.height);
  
  strokeHistory.forEach(stroke => {
    if (stroke.length < 2) return;
    
    signatureCtx.beginPath();
    signatureCtx.moveTo(stroke[0].x, stroke[0].y);
    
    for (let i = 1; i < stroke.length; i++) {
      signatureCtx.lineTo(stroke[i].x, stroke[i].y);
    }
    
    signatureCtx.stroke();
  });
}

function updatePenStyle() {
  signatureCtx.lineWidth = parseInt(elements.penSize.value);
  signatureCtx.strokeStyle = elements.penColor.value;
}

function openSignatureModal() {
  elements.signatureModal.style.display = 'flex';
  clearSignatureCanvas();
  
  setTimeout(() => {
    const canvas = elements.signatureCanvas;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    signatureCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    updatePenStyle();
  }, 100);
}

function closeSignatureModal() {
  elements.signatureModal.style.display = 'none';
}

function confirmSignature() {
  const canvas = elements.signatureCanvas;
  
  let hasContent = false;
  const imageData = signatureCtx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 0) {
      hasContent = true;
      break;
    }
  }
  
  if (!hasContent) {
    alert('请先绘制签名');
    return;
  }

  const signatureDataUrl = canvas.toDataURL('image/png');
  
  const signature = {
    id: Date.now(),
    page: state.currentPage,
    dataUrl: signatureDataUrl,
    x: 50,
    y: 50,
    width: 150,
    height: 75,
  };
  
  state.signatures.push(signature);
  closeSignatureModal();
  renderSignatures();
}

function renderSignatures() {
  elements.signaturesLayer.innerHTML = '';
  
  const pageSignatures = state.signatures.filter(s => s.page === state.currentPage);
  
  pageSignatures.forEach(sig => {
    const sigDiv = document.createElement('div');
    sigDiv.className = 'signature-item';
    sigDiv.dataset.id = sig.id;
    sigDiv.style.left = sig.x + 'px';
    sigDiv.style.top = sig.y + 'px';
    sigDiv.style.width = sig.width + 'px';
    sigDiv.style.height = sig.height + 'px';

    const img = document.createElement('img');
    img.src = sig.dataUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    sigDiv.appendChild(img);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'signature-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSignature(sig.id);
    });
    sigDiv.appendChild(deleteBtn);

    makeDraggable(sigDiv, sig);

    elements.signaturesLayer.appendChild(sigDiv);
  });
}

function makeDraggable(element, signature) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  element.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('signature-delete')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = signature.x;
    initialY = signature.y;
    
    element.style.zIndex = '100';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newX = initialX + deltaX;
    let newY = initialY + deltaY;
    
    const layerRect = elements.signaturesLayer.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();
    
    newX = Math.max(0, Math.min(newX, layerRect.width - elemRect.width));
    newY = Math.max(0, Math.min(newY, layerRect.height - elemRect.height));
    
    signature.x = newX;
    signature.y = newY;
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.zIndex = '';
    }
  });

  element.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('signature-delete')) return;
    
    isDragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    initialX = signature.x;
    initialY = signature.y;
    
    element.style.zIndex = '100';
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    
    let newX = initialX + deltaX;
    let newY = initialY + deltaY;
    
    const layerRect = elements.signaturesLayer.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();
    
    newX = Math.max(0, Math.min(newX, layerRect.width - elemRect.width));
    newY = Math.max(0, Math.min(newY, layerRect.height - elemRect.height));
    
    signature.x = newX;
    signature.y = newY;
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
  });

  document.addEventListener('touchend', () => {
    if (isDragging) {
      isDragging = false;
      element.style.zIndex = '';
    }
  });
}

function removeSignature(id) {
  state.signatures = state.signatures.filter(s => s.id !== id);
  renderSignatures();
}

async function flattenAndDownload() {
  if (!state.pdfBytes) return;

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const pdfDoc = await PDFDocument.load(state.pdfBytes);

    const form = pdfDoc.getForm();
    const fields = form.getFields();

    for (const pageNum in state.formFields) {
      const pageFields = state.formFields[pageNum];
      for (const fieldData of pageFields) {
        try {
          const field = form.getField(fieldData.fieldName);
          if (field) {
            if (fieldData.fieldType === 'Tx') {
              field.setText(fieldData.value || '');
            } else if (fieldData.fieldType === 'Btn') {
              if (fieldData.value === 'Yes' || fieldData.value === true) {
                field.check();
              } else {
                field.uncheck();
              }
            }
          }
        } catch (e) {
          console.log('字段处理跳过:', fieldData.fieldName, e.message);
        }
      }
    }

    for (const sig of state.signatures) {
      const page = pdfDoc.getPage(sig.page - 1);
      const pageHeight = page.getHeight();
      const pageWidth = page.getWidth();

      const viewport = state.pageViewport;
      const scaleFactor = pageWidth / viewport.width;

      const sigImage = await pdfDoc.embedPng(sig.dataUrl);

      const x = sig.x * scaleFactor;
      const y = pageHeight - (sig.y + sig.height) * scaleFactor;
      const width = sig.width * scaleFactor;
      const height = sig.height * scaleFactor;

      page.drawImage(sigImage, {
        x: x,
        y: y,
        width: width,
        height: height,
      });
    }

    form.flatten();

    const pdfBytes = await pdfDoc.save();

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed_document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('扁平化输出失败:', error);
    alert('生成PDF失败: ' + error.message);
  }
}

init();
