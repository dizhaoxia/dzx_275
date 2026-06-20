const PDFJS = window['pdfjsLib'];

PDFJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  baseScale: 1.0,
  baseScaleInitialized: false,
  pdfBytes: null,
  originalPdfBytes: null,
  formFields: {},
  signatures: [],
  pageViewport: null,
  renderEngine: 'pdfjs',
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  fieldLinkages: {},
  requiredFields: {},
  pendingSignature: null,
  signatureMode: 'draw',
  uploadedSignatureDataUrl: null,
  textSignatureDataUrl: null,
  signatureAdjust: {
    scale: 100,
    rotate: 0,
    opacity: 100,
  },
  selectedSignatureId: null,
  pdfiumModule: null,
  pdfiumInitialized: false,
  isPdfiumLoading: false,
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
  validateBtn: document.getElementById('validateBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  engineSelect: document.getElementById('engineSelect'),
  signatureModal: document.getElementById('signatureModal'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalClose: document.getElementById('modalClose'),
  signatureCanvas: document.getElementById('signatureCanvas'),
  clearSignature: document.getElementById('clearSignature'),
  undoSignature: document.getElementById('undoSignature'),
  penSize: document.getElementById('penSize'),
  penSizeValue: document.getElementById('penSizeValue'),
  penColor: document.getElementById('penColor'),
  cancelSignature: document.getElementById('cancelSignature'),
  confirmSignature: document.getElementById('confirmSignature'),
  signatureImageInput: document.getElementById('signatureImageInput'),
  uploadArea: document.getElementById('uploadArea'),
  uploadedSignaturePreview: document.getElementById('uploadedSignaturePreview'),
  signatureTextInput: document.getElementById('signatureTextInput'),
  handwritingFontSelect: document.getElementById('handwritingFontSelect'),
  textSignatureCanvas: document.getElementById('textSignatureCanvas'),
  textSignatureSize: document.getElementById('textSignatureSize'),
  textSignatureColor: document.getElementById('textSignatureColor'),
  signatureAdjustPanel: document.getElementById('signatureAdjustPanel'),
  adjustScale: document.getElementById('adjustScale'),
  adjustScaleValue: document.getElementById('adjustScaleValue'),
  adjustRotate: document.getElementById('adjustRotate'),
  adjustRotateValue: document.getElementById('adjustRotateValue'),
  adjustOpacity: document.getElementById('adjustOpacity'),
  adjustOpacityValue: document.getElementById('adjustOpacityValue'),
  validationToast: document.getElementById('validationToast'),
};

let signatureCtx = null;
let textSignatureCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let strokeHistory = [];
let currentStroke = [];
let currentPenStyle = { width: 3, color: '#000000' };

const handwritingFonts = {
  cursive: {
    family: 'cursive',
    style: 'normal',
    weight: '400',
    transform: 'none',
  },
  brush: {
    family: 'Brush Script MT, cursive',
    style: 'italic',
    weight: '400',
    transform: 'skewX(-5deg)',
  },
  elegant: {
    family: 'Palatino, serif',
    style: 'italic',
    weight: '300',
    transform: 'none',
  },
  modern: {
    family: 'Arial, sans-serif',
    style: 'normal',
    weight: '500',
    transform: 'skewX(-3deg)',
  },
};

function init() {
  bindEvents();
  initSignatureCanvas();
  initTextSignatureCanvas();
  loadPdfium();
  setupFieldLinkages();
}

function bindEvents() {
  elements.fileInput.addEventListener('change', handleFileUpload);
  elements.loadSampleBtn.addEventListener('click', loadSamplePdf);
  elements.prevPage.addEventListener('click', () => changePage(-1));
  elements.nextPage.addEventListener('click', () => changePage(1));
  elements.zoomIn.addEventListener('click', () => setZoom(state.scale * 1.2));
  elements.zoomOut.addEventListener('click', () => setZoom(state.scale / 1.2));
  elements.engineSelect.addEventListener('change', handleEngineChange);
  elements.undoBtn.addEventListener('click', undoAction);
  elements.redoBtn.addEventListener('click', redoAction);
  elements.validateBtn.addEventListener('click', validateForm);

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

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', handleTabSwitch);
  });

  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', handleColorPreset);
  });

  elements.uploadArea.addEventListener('click', () => elements.signatureImageInput.click());
  elements.signatureImageInput.addEventListener('change', handleSignatureImageUpload);
  elements.uploadArea.addEventListener('dragover', handleDragOver);
  elements.uploadArea.addEventListener('dragleave', handleDragLeave);
  elements.uploadArea.addEventListener('drop', handleDrop);

  elements.signatureTextInput.addEventListener('input', updateTextSignature);
  elements.handwritingFontSelect.addEventListener('change', updateTextSignature);
  elements.textSignatureSize.addEventListener('input', updateTextSignature);
  elements.textSignatureColor.addEventListener('input', updateTextSignature);

  elements.adjustScale.addEventListener('input', updateSignatureAdjust);
  elements.adjustRotate.addEventListener('input', updateSignatureAdjust);
  elements.adjustOpacity.addEventListener('input', updateSignatureAdjust);
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
  signatureCtx.strokeStyle = currentPenStyle.color;
  signatureCtx.lineWidth = currentPenStyle.width;

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
}

function initTextSignatureCanvas() {
  const canvas = elements.textSignatureCanvas;
  textSignatureCtx = canvas.getContext('2d');
  
  const width = 400;
  const height = 200;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  textSignatureCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  updateTextSignature();
}

async function loadPdfium() {
  try {
    state.isPdfiumLoading = true;
    console.log('正在加载 PDFium WASM 模块...');
    
    const cdnUrls = [
      'https://unpkg.com/pdfium-wasm@latest/dist/pdfium.js',
      'https://cdn.jsdelivr.net/npm/pdfium-wasm@latest/dist/pdfium.js',
    ];
    
    let loaded = false;
    
    for (const url of cdnUrls) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = () => {
            if (window.PDFium) {
              resolve();
            } else {
              reject(new Error('PDFium not found on window'));
            }
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        state.pdfiumModule = await window.PDFium();
        state.pdfiumInitialized = true;
        state.isPdfiumLoading = false;
        console.log('PDFium WASM 模块加载成功');
        loaded = true;
        break;
      } catch (e) {
        console.log('PDFium CDN 加载失败，尝试下一个:', url);
      }
    }
    
    if (!loaded) {
      state.isPdfiumLoading = false;
      console.log('PDFium WASM 模块加载失败，将继续使用 PDF.js');
    }
  } catch (error) {
    state.isPdfiumLoading = false;
    console.log('PDFium WASM 加载失败:', error);
  }
}

function setupFieldLinkages() {
  state.fieldLinkages = {
    'country': {
      trigger: 'change',
      target: 'city',
      handler: (value) => {
        const cityMap = {
          'China': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'],
          'USA': ['New York', 'Los Angeles', 'Chicago', 'San Francisco'],
          'Japan': ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'],
          'UK': ['London', 'Manchester', 'Birmingham', 'Liverpool'],
          'Germany': ['Berlin', 'Munich', 'Frankfurt', 'Hamburg'],
          'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse'],
          'Korea': ['Seoul', 'Busan', 'Incheon', 'Daegu'],
        };
        return cityMap[value] || [];
      },
    },
    'hasDiscount': {
      trigger: 'change',
      target: 'discountCode',
      handler: (value) => {
        if (value === 'Yes' || value === true) {
          return { required: true, placeholder: 'Enter discount code' };
        }
        return { required: false, placeholder: '', value: '' };
      },
    },
  };
}

function saveToHistory(actionType, data) {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  const snapshot = {
    type: actionType,
    timestamp: Date.now(),
    data: data,
    formFields: JSON.parse(JSON.stringify(state.formFields)),
    signatures: JSON.parse(JSON.stringify(state.signatures)),
  };

  state.history.push(snapshot);
  
  if (state.history.length > state.maxHistorySize) {
    state.history.shift();
  } else {
    state.historyIndex++;
  }

  updateUndoRedoButtons();
}

function undoAction() {
  if (state.historyIndex <= 0) return;

  state.historyIndex--;
  const snapshot = state.history[state.historyIndex];
  
  state.formFields = JSON.parse(JSON.stringify(snapshot.formFields));
  state.signatures = JSON.parse(JSON.stringify(snapshot.signatures));
  
  renderPage(state.currentPage);
  updateUndoRedoButtons();
  showToast('已撤销操作', 'success');
}

function redoAction() {
  if (state.historyIndex >= state.history.length - 1) return;

  state.historyIndex++;
  const snapshot = state.history[state.historyIndex];
  
  state.formFields = JSON.parse(JSON.stringify(snapshot.formFields));
  state.signatures = JSON.parse(JSON.stringify(snapshot.signatures));
  
  renderPage(state.currentPage);
  updateUndoRedoButtons();
  showToast('已重做操作', 'success');
}

function updateUndoRedoButtons() {
  elements.undoBtn.disabled = state.historyIndex <= 0;
  elements.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = function(event) {
    const typedArray = new Uint8Array(event.target.result);
    state.pdfBytes = typedArray;
    state.originalPdfBytes = new Uint8Array(typedArray);
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
    state.originalPdfBytes = new Uint8Array(typedArray);
    loadPdf(typedArray);
  } catch (error) {
    console.error('加载示例PDF失败:', error);
    alert('加载示例PDF失败');
  }
}

async function loadPdf(data) {
  try {
    showLoading('正在加载PDF...');
    
    if (state.renderEngine === 'pdfium' && state.pdfiumInitialized) {
      await loadPdfWithPdfium(data);
    } else {
      await loadPdfWithPdfjs(data);
    }
    
    state.history = [];
    state.historyIndex = -1;
    saveToHistory('load', null);
    
    hideLoading();
  } catch (error) {
    hideLoading();
    console.error('加载PDF失败:', error);
    alert('加载PDF失败，请检查文件格式');
  }
}

async function loadPdfWithPdfjs(data) {
  const loadingTask = PDFJS.getDocument({ data: data });
  state.pdfDoc = await loadingTask.promise;
  state.totalPages = state.pdfDoc.numPages;
  state.currentPage = 1;
  state.formFields = {};
  state.signatures = [];
  state.baseScaleInitialized = false;

  updateToolbarState();
  await renderPage(state.currentPage);
}

async function loadPdfWithPdfium(data) {
  try {
    const pdfium = state.pdfiumModule;
    const doc = await pdfium.loadDocument(data);
    state.pdfDoc = doc;
    state.totalPages = await doc.getPageCount();
    state.currentPage = 1;
    state.formFields = {};
    state.signatures = [];
    state.baseScaleInitialized = false;

    updateToolbarState();
    await renderPageWithPdfium(state.currentPage);
  } catch (error) {
    console.warn('PDFium 渲染失败，回退到 PDF.js:', error);
    state.renderEngine = 'pdfjs';
    elements.engineSelect.value = 'pdfjs';
    await loadPdfWithPdfjs(data);
  }
}

function updateToolbarState() {
  elements.totalPages.textContent = state.totalPages;
  elements.currentPage.textContent = state.currentPage;
  elements.prevPage.disabled = true;
  elements.nextPage.disabled = state.totalPages <= 1;
  elements.flattenBtn.disabled = false;
  elements.validateBtn.disabled = false;
  elements.pdfPlaceholder.style.display = 'none';
  elements.pdfWrapper.style.display = 'block';
}

async function handleEngineChange(e) {
  state.renderEngine = e.target.value;
  
  if (state.renderEngine === 'pdfium' && !state.pdfiumInitialized) {
    if (state.isPdfiumLoading) {
      showToast('PDFium 正在加载中，请稍候...', 'error');
      elements.engineSelect.value = 'pdfjs';
      return;
    }
    showToast('PDFium 未加载，将继续使用 PDF.js', 'error');
    elements.engineSelect.value = 'pdfjs';
    return;
  }
  
  if (state.pdfBytes) {
    await loadPdf(state.pdfBytes);
  }
}

async function renderPage(pageNum) {
  if (state.renderEngine === 'pdfium' && state.pdfiumInitialized) {
    await renderPageWithPdfium(pageNum);
  } else {
    await renderPageWithPdfjs(pageNum);
  }
}

async function renderPageWithPdfjs(pageNum) {
  const page = await state.pdfDoc.getPage(pageNum);
  
  const containerWidth = elements.pdfContainer.clientWidth - 40;
  const viewport = page.getViewport({ scale: 1 });
  
  if (!state.baseScaleInitialized) {
    state.baseScale = Math.min(containerWidth / viewport.width, 1.5);
    state.scale = state.baseScale;
    state.baseScaleInitialized = true;
  }

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

async function renderPageWithPdfium(pageNum) {
  try {
    const page = await state.pdfDoc.getPage(pageNum - 1);
    
    const containerWidth = elements.pdfContainer.clientWidth - 40;
    const size = await page.getSize();
    
    if (!state.baseScaleInitialized) {
      state.baseScale = Math.min(containerWidth / size.width, 1.5);
      state.scale = state.baseScale;
      state.baseScaleInitialized = true;
    }

    const scaledWidth = Math.floor(size.width * state.scale);
    const scaledHeight = Math.floor(size.height * state.scale);

    const canvas = elements.pdfCanvas;
    canvas.height = scaledHeight;
    canvas.width = scaledWidth;

    elements.pdfWrapper.style.width = scaledWidth + 'px';
    elements.formFieldsLayer.style.width = scaledWidth + 'px';
    elements.formFieldsLayer.style.height = scaledHeight + 'px';
    elements.signaturesLayer.style.width = scaledWidth + 'px';
    elements.signaturesLayer.style.height = scaledHeight + 'px';

    elements.zoomLevel.textContent = Math.round(state.scale * 100);

    const imageData = await page.render({
      scale: state.scale,
      renderAnnotations: true,
    });

    const context = canvas.getContext('2d');
    const imgData = new ImageData(
      new Uint8ClampedArray(imageData),
      scaledWidth,
      scaledHeight
    );
    context.putImageData(imgData, 0, 0);

    state.pageViewport = {
      width: scaledWidth,
      height: scaledHeight,
    };

    const annotations = await page.getAnnotations();
    await renderFormFieldsFromAnnotations(annotations, size);
    renderSignatures();
  } catch (error) {
    console.error('PDFium 渲染页面失败:', error);
    throw error;
  }
}

async function renderFormFields(page) {
  elements.formFieldsLayer.innerHTML = '';

  try {
    const annotations = await page.getAnnotations();
    const viewport = page.getViewport({ scale: 1 });
    await processAnnotations(annotations, viewport);
  } catch (error) {
    console.log('解析表单字段时出现问题（可能没有表单）:', error);
  }
}

async function renderFormFieldsFromAnnotations(annotations, pageSize) {
  elements.formFieldsLayer.innerHTML = '';
  
  try {
    const viewport = { width: pageSize.width, height: pageSize.height };
    await processAnnotations(annotations, viewport);
  } catch (error) {
    console.log('解析表单字段时出现问题:', error);
  }
}

async function processAnnotations(annotations, viewport) {
  const radioGroups = {};

  annotations.forEach(annotation => {
    if (annotation.subtype === 'Widget') {
      const fieldType = annotation.fieldType;
      const fieldName = annotation.fieldName;
      const rect = annotation.rect;

      const left = rect[0] * state.scale;
      const bottom = rect[1] * state.scale;
      const width = (rect[2] - rect[0]) * state.scale;
      const height = (rect[3] - rect[1]) * state.scale;
      
      const top = (viewport.height - rect[3]) * state.scale;

      if (!state.formFields[state.currentPage]) {
        state.formFields[state.currentPage] = [];
      }

      let existingField = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
      let fieldValue = annotation.fieldValue || '';
      if (existingField) {
        fieldValue = existingField.value;
      } else {
        const fieldData = {
          fieldName: fieldName,
          fieldType: fieldType,
          rect: rect,
          value: fieldValue,
          required: annotation.required || false,
          options: annotation.options || [],
          defaultValue: annotation.defaultValue || '',
          readonly: annotation.readonly || false,
        };
        state.formFields[state.currentPage].push(fieldData);
        
        if (fieldData.required) {
          state.requiredFields[fieldName] = fieldData;
        }
      }

      if (fieldType === 'Btn') {
        const flags = annotation.fieldFlags || {};
        if (flags.radio) {
          if (!radioGroups[fieldName]) {
            radioGroups[fieldName] = [];
          }
          radioGroups[fieldName].push({ annotation, left, top, width, height, fieldValue });
          return;
        }
      }

      renderFieldElement(fieldType, fieldName, left, top, width, height, fieldValue, annotation);
    }
  });

  Object.keys(radioGroups).forEach(groupName => {
    renderRadioGroup(groupName, radioGroups[groupName]);
  });
}

function renderFieldElement(fieldType, fieldName, left, top, width, height, fieldValue, annotation) {
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'form-field';
  fieldDiv.style.left = left + 'px';
  fieldDiv.style.top = top + 'px';
  fieldDiv.style.width = width + 'px';
  fieldDiv.style.height = height + 'px';
  fieldDiv.dataset.fieldName = fieldName;

  const fieldData = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
  if (fieldData && fieldData.required) {
    fieldDiv.classList.add('required');
  }

  if (fieldType === 'Tx') {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = fieldValue || '';
    input.dataset.fieldName = fieldName;
    input.style.fontSize = (height * 0.6) + 'px';
    if (annotation.readonly) input.readOnly = true;
    
    input.addEventListener('input', (e) => {
      handleFieldInput(fieldName, e.target.value);
    });
    
    input.addEventListener('blur', (e) => {
      validateField(fieldName, e.target.value);
    });
    
    fieldDiv.appendChild(input);
  } else if (fieldType === 'Btn') {
    const flags = annotation.fieldFlags || {};
    if (flags.pushButton) {
      const button = document.createElement('button');
      button.textContent = annotation.buttonLabel || '按钮';
      button.className = 'btn btn-small';
      button.style.width = '100%';
      button.style.height = '100%';
      button.style.padding = '0';
      button.style.fontSize = (height * 0.4) + 'px';
      
      button.addEventListener('click', () => {
        console.log('按钮被点击:', fieldName);
      });
      
      fieldDiv.appendChild(button);
    } else {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = fieldValue === 'Yes' || fieldValue === true;
      input.dataset.fieldName = fieldName;
      if (annotation.readonly) input.disabled = true;
      
      input.addEventListener('change', (e) => {
        const value = e.target.checked ? 'Yes' : 'Off';
        handleFieldInput(fieldName, value);
        checkFieldLinkage(fieldName, value);
      });
      
      fieldDiv.appendChild(input);
    }
  } else if (fieldType === 'Ch') {
    const flags = annotation.fieldFlags || {};
    const options = annotation.options || [];
    
    if (flags.combo) {
      const select = document.createElement('select');
      select.dataset.fieldName = fieldName;
      select.style.fontSize = (height * 0.6) + 'px';
      if (annotation.readonly) select.disabled = true;
      
      if (flags.edit) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = fieldValue || '';
        input.dataset.fieldName = fieldName;
        input.style.fontSize = (height * 0.6) + 'px';
        
        input.addEventListener('input', (e) => {
          handleFieldInput(fieldName, e.target.value);
        });
        
        fieldDiv.appendChild(input);
      } else {
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = typeof opt === 'string' ? opt : opt.value;
          option.textContent = typeof opt === 'string' ? opt : opt.label;
          if (option.value === fieldValue) {
            option.selected = true;
          }
          select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
          handleFieldInput(fieldName, e.target.value);
          checkFieldLinkage(fieldName, e.target.value);
        });
        
        fieldDiv.appendChild(select);
      }
    } else {
      const select = document.createElement('select');
      select.multiple = flags.multiSelect || false;
      select.size = Math.min(options.length, 5);
      select.dataset.fieldName = fieldName;
      select.style.fontSize = (height * 0.5) + 'px';
      if (annotation.readonly) select.disabled = true;
      
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = typeof opt === 'string' ? opt : opt.value;
        option.textContent = typeof opt === 'string' ? opt : opt.label;
        
        if (Array.isArray(fieldValue)) {
          option.selected = fieldValue.includes(option.value);
        } else {
          option.selected = option.value === fieldValue;
        }
        
        select.appendChild(option);
      });
      
      select.addEventListener('change', (e) => {
        const values = Array.from(e.target.selectedOptions).map(o => o.value);
        const finalValue = select.multiple ? values : values[0] || '';
        handleFieldInput(fieldName, finalValue);
      });
      
      fieldDiv.appendChild(select);
    }
  } else if (fieldType === 'Sig') {
    fieldDiv.innerHTML = '<div style="width:100%;height:100%;border:2px dashed #999;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">签名域</div>';
    fieldDiv.style.cursor = 'pointer';
    fieldDiv.addEventListener('click', () => {
      openSignatureModal(fieldName);
    });
  }

  elements.formFieldsLayer.appendChild(fieldDiv);
}

function renderRadioGroup(groupName, options) {
  const fieldData = state.formFields[state.currentPage].find(f => f.fieldName === groupName);
  const selectedValue = fieldData ? fieldData.value : '';

  const groupDiv = document.createElement('div');
  groupDiv.className = 'form-field radio-group';
  groupDiv.dataset.fieldName = groupName;
  
  if (fieldData && fieldData.required) {
    groupDiv.classList.add('required');
  }

  options.forEach((opt, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'radio-option';
    
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = groupName;
    input.value = opt.fieldValue || `option${index}`;
    input.id = `${groupName}_${index}`;
    input.checked = input.value === selectedValue;
    if (opt.annotation.readonly) input.disabled = true;
    
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = opt.annotation.buttonLabel || opt.annotation.fieldValue || `选项${index + 1}`;
    
    input.addEventListener('change', (e) => {
      handleFieldInput(groupName, e.target.value);
      checkFieldLinkage(groupName, e.target.value);
    });
    
    optionDiv.appendChild(input);
    optionDiv.appendChild(label);
    groupDiv.appendChild(optionDiv);
  });

  const firstOpt = options[0];
  groupDiv.style.left = firstOpt.left + 'px';
  groupDiv.style.top = firstOpt.top + 'px';
  
  const maxRight = Math.max(...options.map(o => o.left + o.width));
  const maxBottom = Math.max(...options.map(o => o.top + o.height));
  groupDiv.style.width = (maxRight - firstOpt.left) + 'px';
  groupDiv.style.height = (maxBottom - firstOpt.top) + 'px';

  elements.formFieldsLayer.appendChild(groupDiv);
}

function handleFieldInput(fieldName, value) {
  const oldValue = updateFieldValue(fieldName, value);
  if (oldValue !== value) {
    saveToHistory('field_change', { fieldName, oldValue, newValue: value });
  }
}

function updateFieldValue(fieldName, value) {
  if (!state.formFields[state.currentPage]) return null;
  
  const field = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
  if (field) {
    const oldValue = field.value;
    field.value = value;
    return oldValue;
  }
  return null;
}

function checkFieldLinkage(fieldName, value) {
  const linkage = state.fieldLinkages[fieldName];
  if (!linkage) return;

  const targetField = linkage.target;
  const result = linkage.handler(value);

  if (Array.isArray(result)) {
    updateDropdownOptions(targetField, result);
  } else if (typeof result === 'object') {
    updateFieldProperties(targetField, result);
  }
}

function updateDropdownOptions(fieldName, options) {
  const fieldDiv = document.querySelector(`.form-field[data-field-name="${fieldName}"]`);
  if (!fieldDiv) return;

  const select = fieldDiv.querySelector('select');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '';
  
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '请选择...';
  select.appendChild(defaultOption);
  
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (opt === currentValue) option.selected = true;
    select.appendChild(option);
  });

  const field = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
  if (field) {
    field.options = options;
  }
}

function updateFieldProperties(fieldName, props) {
  const fieldDiv = document.querySelector(`.form-field[data-field-name="${fieldName}"]`);
  if (!fieldDiv) return;

  const input = fieldDiv.querySelector('input, select');
  if (!input) return;

  if (props.required !== undefined) {
    const field = state.formFields[state.currentPage].find(f => f.fieldName === fieldName);
    if (field) field.required = props.required;
    
    if (props.required) {
      fieldDiv.classList.add('required');
      state.requiredFields[fieldName] = field;
    } else {
      fieldDiv.classList.remove('required');
      delete state.requiredFields[fieldName];
    }
  }

  if (props.placeholder !== undefined && input.type === 'text') {
    input.placeholder = props.placeholder;
  }

  if (props.value !== undefined) {
    input.value = props.value;
    handleFieldInput(fieldName, props.value);
  }
}

function validateField(fieldName, value) {
  const field = state.formFields[state.currentPage]?.find(f => f.fieldName === fieldName);
  if (!field) return { valid: true };

  const errors = [];

  if (field.required && !value) {
    errors.push('此字段为必填项');
  }

  if (errors.length > 0) {
    showFieldError(fieldName, errors[0]);
    return { valid: false, errors };
  } else {
    clearFieldError(fieldName);
    return { valid: true };
  }
}

function showFieldError(fieldName, message) {
  const fieldDiv = document.querySelector(`.form-field[data-field-name="${fieldName}"]`);
  if (!fieldDiv) return;

  fieldDiv.classList.add('error');
  
  let errorMsg = fieldDiv.querySelector('.error-message');
  if (!errorMsg) {
    errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    fieldDiv.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
}

function clearFieldError(fieldName) {
  const fieldDiv = document.querySelector(`.form-field[data-field-name="${fieldName}"]`);
  if (!fieldDiv) return;

  fieldDiv.classList.remove('error');
  const errorMsg = fieldDiv.querySelector('.error-message');
  if (errorMsg) {
    errorMsg.remove();
  }
}

function validateForm() {
  const allErrors = [];
  
  for (const pageNum in state.formFields) {
    const pageFields = state.formFields[pageNum];
    for (const field of pageFields) {
      if (field.required) {
        const value = field.value;
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          allErrors.push({
            fieldName: field.fieldName,
            page: parseInt(pageNum),
            message: `字段 "${field.fieldName}" 为必填项`,
          });
        }
      }
    }
  }

  if (allErrors.length > 0) {
    showValidationToast(allErrors, 'error');
    
    if (parseInt(allErrors[0].page) !== state.currentPage) {
      changePage(parseInt(allErrors[0].page) - state.currentPage);
    }
    
    setTimeout(() => {
      showFieldError(allErrors[0].fieldName, allErrors[0].message);
    }, 100);
  } else {
    showValidationToast([], 'success');
  }

  return allErrors.length === 0;
}

function showValidationToast(errors, type) {
  const toast = elements.validationToast;
  toast.className = `validation-toast ${type}`;
  
  let html = '<h3>';
  if (type === 'success') {
    html += '✅ 表单校验通过';
  } else {
    html += '❌ 表单校验失败';
  }
  html += '</h3>';
  
  if (errors.length > 0) {
    html += '<ul>';
    errors.forEach(err => {
      html += `<li>第 ${err.page} 页: ${err.message}</li>`;
    });
    html += '</ul>';
  } else {
    html += '<ul><li>所有必填字段已填写完成</li></ul>';
  }
  
  toast.innerHTML = html;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

function showToast(message, type) {
  const toast = elements.validationToast;
  toast.className = `validation-toast ${type}`;
  
  let html = '<h3>';
  if (type === 'success') {
    html += '✅ ';
  } else {
    html += '❌ ';
  }
  html += message + '</h3>';
  
  toast.innerHTML = html;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function showLoading(message) {
  let loading = document.querySelector('.loading-indicator');
  if (!loading) {
    loading = document.createElement('div');
    loading.className = 'loading-indicator';
    document.body.appendChild(loading);
  }
  loading.textContent = message;
  loading.classList.add('show');
}

function hideLoading() {
  const loading = document.querySelector('.loading-indicator');
  if (loading) {
    loading.classList.remove('show');
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

function handleTabSwitch(e) {
  const tab = e.target.dataset.tab;
  state.signatureMode = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tab}` ? 'block' : 'none';
  });

  if (tab === 'upload' || tab === 'text') {
    elements.signatureAdjustPanel.style.display = 'block';
  } else {
    elements.signatureAdjustPanel.style.display = 'none';
  }
  
  if (tab === 'text') {
    initTextSignatureCanvas();
  }
}

function handleColorPreset(e) {
  const color = e.target.dataset.color;
  elements.penColor.value = color;
  currentPenStyle.color = color;
  updatePenStyle();
  
  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });
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
  currentStroke = [{ x: lastX, y: lastY, ...currentPenStyle }];
  
  signatureCtx.beginPath();
  signatureCtx.moveTo(lastX, lastY);
}

function draw(e) {
  if (!isDrawing) return;
  
  const pos = getCanvasPos(e);
  
  signatureCtx.strokeStyle = currentPenStyle.color;
  signatureCtx.lineWidth = currentPenStyle.width;
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
  
  currentStroke.push({ x: pos.x, y: pos.y, ...currentPenStyle });
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
    signatureCtx.strokeStyle = stroke[0].color;
    signatureCtx.lineWidth = stroke[0].width;
    
    for (let i = 1; i < stroke.length; i++) {
      signatureCtx.lineTo(stroke[i].x, stroke[i].y);
    }
    
    signatureCtx.stroke();
  });
}

function updatePenStyle() {
  currentPenStyle.width = parseInt(elements.penSize.value);
  currentPenStyle.color = elements.penColor.value;
  elements.penSizeValue.textContent = currentPenStyle.width + 'px';
  
  signatureCtx.lineWidth = currentPenStyle.width;
  signatureCtx.strokeStyle = currentPenStyle.color;
}

function handleDragOver(e) {
  e.preventDefault();
  elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  elements.uploadArea.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    processSignatureImage(files[0]);
  }
}

function handleSignatureImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    processSignatureImage(file);
  }
}

function processSignatureImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    state.uploadedSignatureDataUrl = e.target.result;
    elements.uploadedSignaturePreview.src = state.uploadedSignatureDataUrl;
    elements.uploadedSignaturePreview.style.display = 'block';
    elements.uploadArea.querySelector('.upload-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function updateTextSignature() {
  const text = elements.signatureTextInput.value || '签名';
  const fontName = elements.handwritingFontSelect.value;
  const fontSize = parseInt(elements.textSignatureSize.value);
  const color = elements.textSignatureColor.value;
  const font = handwritingFonts[fontName];
  
  const canvas = elements.textSignatureCanvas;
  const drawWidth = canvas.width / window.devicePixelRatio;
  const drawHeight = canvas.height / window.devicePixelRatio;
  
  if (drawWidth === 0 || drawHeight === 0) {
    initTextSignatureCanvas();
    return;
  }
  
  textSignatureCtx.clearRect(0, 0, canvas.width, canvas.height);
  
  textSignatureCtx.font = `${font.style} ${font.weight} ${fontSize}px ${font.family}`;
  textSignatureCtx.fillStyle = color;
  textSignatureCtx.textBaseline = 'middle';
  textSignatureCtx.textAlign = 'center';
  
  if (font.transform === 'skewX(-5deg)') {
    textSignatureCtx.save();
    textSignatureCtx.transform(1, 0, -0.1, 1, 0, 0);
  } else if (font.transform === 'skewX(-3deg)') {
    textSignatureCtx.save();
    textSignatureCtx.transform(1, 0, -0.05, 1, 0, 0);
  }
  
  textSignatureCtx.fillText(text, drawWidth / 2, drawHeight / 2);
  
  if (font.transform !== 'none') {
    textSignatureCtx.restore();
  }
  
  state.textSignatureDataUrl = canvas.toDataURL('image/png');
}

function updateSignatureAdjust() {
  state.signatureAdjust.scale = parseInt(elements.adjustScale.value);
  state.signatureAdjust.rotate = parseInt(elements.adjustRotate.value);
  state.signatureAdjust.opacity = parseInt(elements.adjustOpacity.value);
  
  elements.adjustScaleValue.textContent = state.signatureAdjust.scale + '%';
  elements.adjustRotateValue.textContent = state.signatureAdjust.rotate + '°';
  elements.adjustOpacityValue.textContent = state.signatureAdjust.opacity + '%';
}

function openSignatureModal(targetFieldName = null) {
  state.pendingSignature = {
    targetFieldName,
    scale: state.signatureAdjust.scale,
    rotate: state.signatureAdjust.rotate,
    opacity: state.signatureAdjust.opacity,
  };
  
  resetSignatureModal();
  elements.signatureModal.style.display = 'flex';
  
  setTimeout(() => {
    const canvas = elements.signatureCanvas;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    signatureCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    updatePenStyle();
    
    initTextSignatureCanvas();
  }, 100);
}

function resetSignatureModal() {
  state.signatureMode = 'draw';
  state.uploadedSignatureDataUrl = null;
  state.textSignatureDataUrl = null;
  state.signatureAdjust = { scale: 100, rotate: 0, opacity: 100 };
  
  elements.adjustScale.value = 100;
  elements.adjustRotate.value = 0;
  elements.adjustOpacity.value = 100;
  elements.adjustScaleValue.textContent = '100%';
  elements.adjustRotateValue.textContent = '0°';
  elements.adjustOpacityValue.textContent = '100%';
  
  elements.signatureTextInput.value = '';
  elements.uploadedSignaturePreview.style.display = 'none';
  elements.uploadArea.querySelector('.upload-placeholder').style.display = 'flex';
  elements.signatureAdjustPanel.style.display = 'none';
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'draw');
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === 'tab-draw' ? 'block' : 'none';
  });
  
  clearSignatureCanvas();
}

function closeSignatureModal() {
  elements.signatureModal.style.display = 'none';
  state.pendingSignature = null;
}

async function confirmSignature() {
  let signatureDataUrl = null;
  
  if (state.signatureMode === 'draw') {
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
    
    signatureDataUrl = canvas.toDataURL('image/png');
  } else if (state.signatureMode === 'upload') {
    if (!state.uploadedSignatureDataUrl) {
      alert('请先上传签名图片');
      return;
    }
    signatureDataUrl = await applySignatureAdjustments(state.uploadedSignatureDataUrl);
  } else if (state.signatureMode === 'text') {
    if (!elements.signatureTextInput.value) {
      alert('请输入签名文本');
      return;
    }
    signatureDataUrl = await applySignatureAdjustments(state.textSignatureDataUrl);
  }
  
  if (!signatureDataUrl) return;
  
  const baseWidth = 150;
  const baseHeight = 75;
  const scaleFactor = state.signatureAdjust.scale / 100;
  
  const signature = {
    id: Date.now(),
    page: state.currentPage,
    dataUrl: signatureDataUrl,
    x: 50,
    y: 50,
    width: baseWidth * scaleFactor,
    height: baseHeight * scaleFactor,
    rotation: state.signatureAdjust.rotate,
    opacity: state.signatureAdjust.opacity / 100,
    targetField: state.pendingSignature?.targetFieldName,
  };
  
  state.signatures = state.signatures.filter(s => s.page !== state.currentPage || s.targetField !== signature.targetField);
  state.signatures.push(signature);
  
  saveToHistory('signature_add', { signature: { ...signature } });
  
  closeSignatureModal();
  renderSignatures();
}

function applySignatureAdjustments(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const scale = state.signatureAdjust.scale / 100;
      const rotate = state.signatureAdjust.rotate * Math.PI / 180;
      const opacity = state.signatureAdjust.opacity / 100;
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotate);
      ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
      ctx.restore();
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
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
    sigDiv.style.transform = `rotate(${sig.rotation || 0}deg)`;
    sigDiv.style.opacity = sig.opacity || 1;
    
    if (sig.id === state.selectedSignatureId) {
      sigDiv.classList.add('selected');
    }

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
    makeResizable(sigDiv, sig);

    sigDiv.addEventListener('click', (e) => {
      if (e.target.classList.contains('signature-delete')) return;
      selectSignature(sig.id);
    });

    elements.signaturesLayer.appendChild(sigDiv);
  });
}

function selectSignature(id) {
  state.selectedSignatureId = id;
  document.querySelectorAll('.signature-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.id === String(id));
  });
}

function makeDraggable(element, signature) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  element.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('signature-delete') || e.target.classList.contains('resize-handle')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = signature.x;
    initialY = signature.y;
    
    element.style.zIndex = '100';
    selectSignature(signature.id);
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
      saveToHistory('signature_move', { id: signature.id });
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
    selectSignature(signature.id);
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
      saveToHistory('signature_move', { id: signature.id });
    }
  });
}

function makeResizable(element, signature) {
  const handles = ['se', 'sw', 'ne', 'nw'];
  
  handles.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-${pos}`;
    handle.style.cssText = `
      position: absolute;
      width: 12px;
      height: 12px;
      background: #1677ff;
      border: 2px solid #fff;
      border-radius: 50%;
      display: none;
      z-index: 10;
    `;
    
    if (pos.includes('n')) handle.style.top = '-6px';
    if (pos.includes('s')) handle.style.bottom = '-6px';
    if (pos.includes('w')) handle.style.left = '-6px';
    if (pos.includes('e')) handle.style.right = '-6px';
    
    if (pos === 'se') handle.style.cursor = 'se-resize';
    if (pos === 'sw') handle.style.cursor = 'sw-resize';
    if (pos === 'ne') handle.style.cursor = 'ne-resize';
    if (pos === 'nw') handle.style.cursor = 'nw-resize';
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = signature.width;
      startHeight = signature.height;
      startLeft = signature.x;
      startTop = signature.y;
      document.body.style.cursor = handle.style.cursor;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const aspectRatio = startWidth / startHeight;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      if (pos.includes('e')) newWidth = Math.max(30, startWidth + deltaX);
      if (pos.includes('w')) {
        newWidth = Math.max(30, startWidth - deltaX);
        newLeft = startLeft + (startWidth - newWidth);
      }
      if (pos.includes('s')) newHeight = Math.max(20, startHeight + deltaY);
      if (pos.includes('n')) {
        newHeight = Math.max(20, startHeight - deltaY);
        newTop = startTop + (startHeight - newHeight);
      }
      
      if (e.shiftKey) {
        if (pos === 'se' || pos === 'nw') {
          newHeight = newWidth / aspectRatio;
        } else {
          newHeight = newWidth / aspectRatio;
        }
      }
      
      signature.width = newWidth;
      signature.height = newHeight;
      signature.x = newLeft;
      signature.y = newTop;
      
      element.style.width = newWidth + 'px';
      element.style.height = newHeight + 'px';
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        saveToHistory('signature_resize', { id: signature.id });
      }
    });
    
    element.appendChild(handle);
  });
  
  element.addEventListener('mouseenter', () => {
    element.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'block');
  });
  
  element.addEventListener('mouseleave', () => {
    if (state.selectedSignatureId !== signature.id) {
      element.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
    }
  });
}

function removeSignature(id) {
  const signature = state.signatures.find(s => s.id === id);
  state.signatures = state.signatures.filter(s => s.id !== id);
  if (state.selectedSignatureId === id) {
    state.selectedSignatureId = null;
  }
  saveToHistory('signature_remove', { signature: { ...signature } });
  renderSignatures();
}

async function flattenAndDownload() {
  if (!validateForm()) {
    alert('请先完成所有必填字段的填写');
    return;
  }

  if (!state.originalPdfBytes && !state.pdfBytes) {
    alert('请先加载PDF文件');
    return;
  }

  try {
    showLoading('正在生成PDF...');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    let pdfData = state.originalPdfBytes || state.pdfBytes;
    if (!(pdfData instanceof Uint8Array)) {
      pdfData = new Uint8Array(pdfData);
    }

    const header = String.fromCharCode(pdfData[0], pdfData[1], pdfData[2], pdfData[3], pdfData[4]);
    if (header !== '%PDF-') {
      console.error('PDF header invalid:', header);
      alert('PDF数据无效，请重新上传文件');
      hideLoading();
      return;
    }

    const pdfDoc = await PDFDocument.load(pdfData);

    const form = pdfDoc.getForm();

    for (const pageNum in state.formFields) {
      const pageFields = state.formFields[pageNum];
      for (const fieldData of pageFields) {
        try {
          const field = form.getField(fieldData.fieldName);
          if (field) {
            const fieldType = field.constructor.name;
            
            if (fieldData.fieldType === 'Tx') {
              try {
                field.setText(fieldData.value || '');
              } catch (encodeErr) {
                console.log('字段包含不支持的字符，已跳过:', fieldData.fieldName, encodeErr.message);
                try {
                  const asciiValue = fieldData.value.replace(/[^\x00-\x7F]/g, '?');
                  if (asciiValue !== fieldData.value) {
                    field.setText(asciiValue);
                    console.log('已使用 ASCII 替代值:', asciiValue);
                  }
                } catch (fallbackErr) {
                  console.log('替代值也失败，跳过该字段');
                }
              }
            } else if (fieldData.fieldType === 'Btn') {
              const flags = fieldData.fieldFlags || {};
              if (flags.radio) {
                try {
                  field.select(fieldData.value || '');
                } catch (e) {
                  console.log('单选按钮设置失败:', fieldData.fieldName, e.message);
                }
              } else if (!flags.pushButton) {
                if (fieldData.value === 'Yes' || fieldData.value === true) {
                  field.check();
                } else {
                  field.uncheck();
                }
              }
            } else if (fieldData.fieldType === 'Ch') {
              try {
                if (Array.isArray(fieldData.value)) {
                  field.select(fieldData.value);
                } else {
                  field.select(fieldData.value || '');
                }
              } catch (e) {
                console.log('选择字段设置失败:', fieldData.fieldName, e.message);
              }
            }
          }
        } catch (e) {
          console.log('字段处理跳过:', fieldData.fieldName, e.message);
        }
      }
    }

    for (const sig of state.signatures) {
      try {
        const page = pdfDoc.getPage(sig.page - 1);
        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        const scaleFactor = 1 / state.scale;

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
          rotate: { angle: (sig.rotation || 0) * Math.PI / 180 },
          opacity: sig.opacity || 1,
        });
      } catch (e) {
        console.log('签名绘制失败:', sig.id, e.message);
      }
    }

    form.flatten();

    const pdfBytes = await pdfDoc.save();

    hideLoading();

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
    hideLoading();
    console.error('扁平化输出失败:', error);
    alert('生成PDF失败: ' + error.message);
  }
}

init();
