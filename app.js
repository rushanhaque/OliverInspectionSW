const form = document.querySelector("#inspection-form");
const checklistForm = document.querySelector("#checklist-form");
const finishInspectionButton = document.querySelector("#finish-inspection");
const dateInput = document.querySelector("#inspection-date");
const timeInput = document.querySelector("#inspection-time");
const isoInput = document.querySelector("#inspection-iso");
const productNumberInput = document.querySelector("#product-number");
const statusMessage = document.querySelector("#status-message");
const inspectionSummary = document.querySelector("#inspection-summary");
const checklistStatus = document.querySelector("#checklist-status");
const photoStatus = document.querySelector("#photo-status");
const photoGroups = document.querySelector("#photo-groups");
const cameraDialog = document.querySelector("#camera-dialog");
const cameraPreview = document.querySelector("#camera-preview");
const cameraCanvas = document.querySelector("#camera-canvas");
const cameraCaptureButton = document.querySelector("#camera-capture");
const cameraCancelButton = document.querySelector("#camera-cancel");
const imageViewerDialog = document.querySelector("#image-viewer-dialog");
const viewerImage = document.querySelector("#viewer-image");
const viewerCloseButton = document.querySelector("#viewer-close");
const viewerZoomInButton = document.querySelector("#viewer-zoom-in");
const viewerZoomOutButton = document.querySelector("#viewer-zoom-out");
const viewerResetButton = document.querySelector("#viewer-reset");

// Annotation Dialog Selectors
const annotationDialog = document.querySelector("#annotation-dialog");
const annotationCanvas = document.querySelector("#annotation-canvas");
const annotationCloseButton = document.querySelector("#annotation-close");
const annotationClearButton = document.querySelector("#annotation-clear");
const annotationSaveButton = document.querySelector("#annotation-save");
const brushSizeInput = document.querySelector("#brush-size");
const brushColorButtons = document.querySelectorAll(".brush-color-btn");

// Navigation and Layout Selectors
const btnNewInspection = document.querySelector("#btn-new-inspection");
const btnViewHistory = document.querySelector("#btn-view-history");
const entryScreen = document.querySelector("#entry-screen");
const checklistScreen = document.querySelector("#checklist-screen");
const photoScreen = document.querySelector("#photo-screen");
const historyScreen = document.querySelector("#history-screen");

// Signature and History Selectors
const signatureCanvas = document.querySelector("#signature-canvas");
const clearSignatureButton = document.querySelector("#clear-signature");
const historyList = document.querySelector("#history-list");

const photoHeadings = [
  "Carton Drop Test Tip Over Test",
  "Earth Continuity Hi-Pot Test Assembly Test Functional Test",
  "Functional Test Moisture Content Test Approval Sample",
  "Top/Shipment Sample Inner Packaging Sample Outer Packaging Sample",
  "Product compare with cs and found ok. Production compare with cs and found ok.",
  "Master carton marking Ul marking and assembly instructions",
];
const CHECKLIST_ITEMS = [
  { key: "finalVerification", label: "Final Verification" },
  { key: "assemblyInstructionsAvailable", label: "Assembly Instructions Available" },
  { key: "cartonDimensions", label: "Carton Dimensions" },
  { key: "cartonLabeling", label: "Carton Labeling" },
  { key: "packaging", label: "Packaging" },
  { key: "productDimensions", label: "Product Dimensions" },
  { key: "productFunction", label: "Product Function As Intended" },
  { key: "productHangTags", label: "Product Hang Tags, Bar Code, Price Labels, etc." },
  { key: "productMaterials", label: "Product Materials" },
  { key: "warningLabels", label: "Warning / Other Labels" },
  { key: "factoryFinalInspection", label: "The factory performed a 100% internal Final inspection." },
];

const photoStore = new Map();
let currentCameraGroupId = null;
let currentCameraStream = null;
let isOpeningCamera = false;
let viewerScale = 1;

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function updateTimestamp() {
  const now = new Date();
  dateInput.value = dateFormatter.format(now);
  timeInput.value = timeFormatter.format(now);
  isoInput.value = now.toISOString();
}
updateTimestamp();
setInterval(updateTimestamp, 1000);

productNumberInput.addEventListener("input", () => {
  productNumberInput.value = productNumberInput.value.toUpperCase();
});

form.addEventListener("input", () => {
  const fd = new FormData(form);
  const pName = String(fd.get("productName") || "");
  const pNumber = String(fd.get("productNumber") || "");
  const inspector = String(fd.get("inspectorName") || "");
  if (pName || pNumber || inspector) {
    statusMessage.textContent = `Inspection in progress for ${pName || "product"} ${pNumber ? `(${pNumber})` : ""}.`;
    inspectionSummary.textContent = `${pName || "Product"} ${pNumber ? `(${pNumber})` : ""} ${inspector ? `inspected by ${inspector}` : ""}`.trim();
  } else {
    statusMessage.textContent = "";
    inspectionSummary.textContent = "";
  }
});

checklistForm.addEventListener("change", () => {
  const total = checklistForm.querySelectorAll("input[type='checkbox']").length;
  const done = checklistForm.querySelectorAll("input[type='checkbox']:checked").length;
  checklistStatus.textContent = `${done} of ${total} checklist items completed.`;
});

function buildChecklist() {
  checklistForm.innerHTML = CHECKLIST_ITEMS.map((item) => `
    <div class="check-item-container">
      <label class="check-row">
        <input type="checkbox" name="${item.key}" />
        <span>${item.label}</span>
      </label>
      <div class="remark-container">
        <input type="text" class="remark-input" data-key="${item.key}" placeholder="Add remark (note)..." autocomplete="off" />
      </div>
    </div>
  `).join("");
}

function buildPhotoGroups() {
  photoGroups.innerHTML = photoHeadings
    .map((heading, index) => `
      <article class="photo-group">
        <h2 class="photo-heading">${heading}</h2>
        <div class="photo-controls">
          <button class="secondary-button photo-add" data-photo-trigger="${index}" type="button">Add pictures</button>
          <div class="photo-list" data-photo-list="${index}"></div>
        </div>
      </article>
    `).join("");
  for (let i = 0; i < photoHeadings.length; i += 1) {
    photoStore.set(i, []);
    renderPhotoList(i);
  }
}

function renderPhotoList(groupId) {
  const list = photoGroups.querySelector(`[data-photo-list="${groupId}"]`);
  const photos = photoStore.get(groupId) || [];
  list.innerHTML = photos.map((p, index) => `
    <div class="photo-item-wrapper" data-index="${index}">
      <img class="photo-item" src="${p}" alt="Inspection evidence" />
      <button type="button" class="photo-delete-btn" aria-label="Delete photo">&times;</button>
    </div>
  `).join("");
}

photoGroups.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".photo-delete-btn");
  if (deleteBtn) {
    const wrapper = deleteBtn.closest(".photo-item-wrapper");
    const groupId = Number(deleteBtn.closest("[data-photo-list]").getAttribute("data-photo-list"));
    const photoIdx = Number(wrapper.getAttribute("data-index"));
    
    const photos = photoStore.get(groupId) || [];
    photos.splice(photoIdx, 1);
    photoStore.set(groupId, photos);
    renderPhotoList(groupId);
    
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  const clickedPhoto = event.target.closest(".photo-item");
  if (clickedPhoto) {
    const wrapper = clickedPhoto.closest(".photo-item-wrapper");
    const groupId = Number(clickedPhoto.closest("[data-photo-list]").getAttribute("data-photo-list"));
    const photoIdx = Number(wrapper.getAttribute("data-index"));
    openAnnotationDialog(groupId, photoIdx);
    return;
  }
  
  const trigger = event.target.closest("[data-photo-trigger]");
  if (trigger) {
    openCameraForGroup(Number(trigger.getAttribute("data-photo-trigger")));
    event.preventDefault();
  }
});

async function openCameraForGroup(groupId) {
  if (isOpeningCamera || cameraDialog.open) {
    return;
  }
  isOpeningCamera = true;
  cameraDialog.showModal();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Camera API is not supported in this environment. Please run the app via localhost or HTTPS.");
    cameraDialog.close();
    isOpeningCamera = false;
    return;
  }

  try {
    stopCamera();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch (e) {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    
    currentCameraStream = stream;
    currentCameraGroupId = groupId;
    cameraPreview.srcObject = currentCameraStream;
    cameraPreview.setAttribute("playsinline", "true");
    cameraPreview.muted = true;

    await new Promise((resolve) => {
      if (cameraPreview.readyState >= 1) {
        resolve();
        return;
      }
      const onLoaded = () => {
        cameraPreview.removeEventListener("loadedmetadata", onLoaded);
        resolve();
      };
      cameraPreview.addEventListener("loadedmetadata", onLoaded);
    });

    try {
      await cameraPreview.play();
    } catch {
      // Some in-app browsers may reject explicit play even with muted stream.
    }
    
    photoStatus.textContent = "Camera opened.";
  } catch (err) {
    console.error("Camera error:", err);
    alert("Could not open camera: " + err.message + "\nPlease ensure your device has a camera and you have granted permission.");
    cameraDialog.close();
    photoStatus.textContent = "Camera error: " + err.message;
  } finally {
    isOpeningCamera = false;
  }
}

function stopCamera() {
  if (currentCameraStream) {
    for (const track of currentCameraStream.getTracks()) track.stop();
  }
  currentCameraStream = null;
  currentCameraGroupId = null;
  cameraPreview.srcObject = null;
}

function captureCurrentFrame() {
  if (!currentCameraStream || currentCameraGroupId === null) return;
  const width = cameraPreview.videoWidth;
  const height = cameraPreview.videoHeight;
  if (!width || !height) return;
  cameraCanvas.width = width;
  cameraCanvas.height = height;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, width, height);
  const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.86);
  const photos = photoStore.get(currentCameraGroupId) || [];
  photos.push(dataUrl);
  photoStore.set(currentCameraGroupId, photos);
  renderPhotoList(currentCameraGroupId);
  photoStatus.textContent = "Picture captured and saved in app.";
}

function updateViewerZoom() {
  viewerImage.style.transform = `scale(${viewerScale})`;
}
function openImageViewer(src) {
  if (!src) return;
  viewerImage.setAttribute("src", src);
  viewerScale = 1;
  updateViewerZoom();
  imageViewerDialog.showModal();
}

cameraCaptureButton.addEventListener("click", captureCurrentFrame);
cameraCancelButton.addEventListener("click", () => cameraDialog.close());
cameraDialog.addEventListener("close", stopCamera);
viewerCloseButton.addEventListener("click", () => imageViewerDialog.close());
viewerZoomInButton.addEventListener("click", () => { viewerScale = Math.min(4, viewerScale + 0.25); updateViewerZoom(); });
viewerZoomOutButton.addEventListener("click", () => { viewerScale = Math.max(0.5, viewerScale - 0.25); updateViewerZoom(); });
viewerResetButton.addEventListener("click", () => { viewerScale = 1; updateViewerZoom(); });
imageViewerDialog.addEventListener("close", () => {
  viewerScale = 1;
  viewerImage.style.transform = "";
  viewerImage.removeAttribute("src");
});

// Annotation Canvas Drawing & Editor Logic
let isAnnotating = false;
let annoCtx = null;
let currentAnnotationGroupId = null;
let currentAnnotationPhotoIdx = null;
let originalPhotoSrc = null;

function openAnnotationDialog(groupId, photoIdx) {
  currentAnnotationGroupId = groupId;
  currentAnnotationPhotoIdx = photoIdx;
  const photos = photoStore.get(groupId) || [];
  originalPhotoSrc = photos[photoIdx];

  const img = new Image();
  img.onload = () => {
    annotationCanvas.width = img.naturalWidth || 640;
    annotationCanvas.height = img.naturalHeight || 480;

    annoCtx = annotationCanvas.getContext("2d");
    annoCtx.drawImage(img, 0, 0);

    const activeColorBtn = document.querySelector(".brush-color-btn.active");
    annoCtx.strokeStyle = activeColorBtn ? activeColorBtn.getAttribute("data-color") : "#e74c3c";
    annoCtx.lineWidth = brushSizeInput.value;
    annoCtx.lineCap = "round";
    annoCtx.lineJoin = "round";

    annotationDialog.showModal();
  };
  img.src = originalPhotoSrc;
}

annotationCanvas.addEventListener("mousedown", (e) => {
  isAnnotating = true;
  annoCtx.beginPath();
  const pos = getMousePos(annotationCanvas, e.clientX, e.clientY);
  annoCtx.moveTo(pos.x, pos.y);
});

annotationCanvas.addEventListener("mousemove", (e) => {
  if (!isAnnotating) return;
  const pos = getMousePos(annotationCanvas, e.clientX, e.clientY);
  annoCtx.lineTo(pos.x, pos.y);
  annoCtx.stroke();
});

window.addEventListener("mouseup", () => {
  isAnnotating = false;
});

annotationCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
  }
}, { passive: false });

annotationCanvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
  }
}, { passive: false });

annotationCanvas.addEventListener("touchend", () => {
  const mouseEvent = new MouseEvent("mouseup", {});
  annotationCanvas.dispatchEvent(mouseEvent);
});

brushColorButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    brushColorButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (annoCtx) {
      annoCtx.strokeStyle = btn.getAttribute("data-color");
    }
  });
});

brushSizeInput.addEventListener("input", () => {
  if (annoCtx) {
    annoCtx.lineWidth = brushSizeInput.value;
  }
});

annotationClearButton.addEventListener("click", () => {
  if (!annoCtx || !originalPhotoSrc) return;
  const img = new Image();
  img.onload = () => {
    annoCtx.drawImage(img, 0, 0);
  };
  img.src = originalPhotoSrc;
});

annotationCloseButton.addEventListener("click", () => {
  annotationDialog.close();
});

annotationSaveButton.addEventListener("click", () => {
  if (!annoCtx) return;
  const annotatedDataUrl = annotationCanvas.toDataURL("image/jpeg", 0.88);
  const photos = photoStore.get(currentAnnotationGroupId) || [];
  photos[currentAnnotationPhotoIdx] = annotatedDataUrl;
  photoStore.set(currentAnnotationGroupId, photos);
  renderPhotoList(currentAnnotationGroupId);
  annotationDialog.close();
});


function collectInspectionData() {
  const fd = new FormData(form);
  return {
    productName: String(fd.get("productName") || ""),
    productNumber: String(fd.get("productNumber") || ""),
    inspectorName: String(fd.get("inspectorName") || ""),
    date: dateInput.value,
    timestamp: timeInput.value,
    checklist: CHECKLIST_ITEMS.map((item) => ({
      label: item.label,
      checked: Boolean(checklistForm.querySelector(`input[name="${item.key}"]`)?.checked),
      remark: checklistForm.querySelector(`.remark-input[data-key="${item.key}"]`)?.value || ""
    })),
  };
}

function ensurePage(doc, y, h) {
  if (y + h <= 280) return y;
  doc.addPage();
  return 16;
}

function resetWorkflow() {
  form.reset();
  checklistForm.reset();
  updateTimestamp();
  statusMessage.textContent = "";
  checklistStatus.textContent = "";
  photoStatus.textContent = "";
  inspectionSummary.textContent = "";
  for (let i = 0; i < photoHeadings.length; i += 1) {
    photoStore.set(i, []);
    renderPhotoList(i);
  }
  clearSignature();
}

function exportInspectionPdf(historicalData = null) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    photoStatus.textContent = "PDF library not loaded.";
    return;
  }
  const report = historicalData || collectInspectionData();
  const brand = {
    companyName: "Oliver Mc Inroy & Co.",
    reportTitle: "Final Quality Inspection Report",
    inspectorDept: "Quality Assurance Division",
    address: "Unit 12, Industrial Estate, Bengaluru, India",
    logoMonogram: "OM",
  };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14;
  const right = 196;
  const width = right - left;
  let y = 14;

  doc.setFillColor(123, 93, 74); doc.rect(0, 0, 210, 34, "F");
  doc.setFillColor(155, 115, 93); doc.circle(22, 17, 10, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(brand.logoMonogram, 22, 19, { align: "center" });
  doc.setFontSize(17); doc.text(brand.companyName, 38, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(brand.inspectorDept, 38, 21); doc.text(brand.address, 38, 27);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(brand.reportTitle, 196, 15, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 21, { align: "right" });

  y = 42;
  doc.setTextColor(45, 37, 33); doc.setDrawColor(221, 210, 202); doc.setFillColor(251, 247, 243);
  doc.roundedRect(left, y, width, 38, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Inspection Snapshot", left + 4, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(`Product Name: ${report.productName || ""}`, left + 4, y + 14);
  doc.text(`Product Number: ${report.productNumber || ""}`, left + 100, y + 14);
  doc.text(`Inspector Name: ${report.inspectorName || ""}`, left + 4, y + 21);
  doc.text(`Date: ${report.date || ""}`, left + 100, y + 21);
  doc.text(`Timestamp: ${report.timestamp || ""}`, left + 4, y + 28);

  y += 46;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Checklist Compliance", left, y); y += 5;
  for (const item of report.checklist) {
    const hasRemark = !!item.remark;
    const boxHeight = hasRemark ? 14 : 8;
    y = ensurePage(doc, y, boxHeight + 2);
    const pass = item.checked;
    doc.setFillColor(pass ? 225 : 245, pass ? 241 : 245, pass ? 229 : 245);
    doc.roundedRect(left, y, width, boxHeight, 1.5, 1.5, "F");
    doc.setTextColor(45, 37, 33); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(item.label, 160)[0], left + 4, y + 5.2);
    doc.setFont("helvetica", "bold"); doc.setTextColor(pass ? 52 : 120, pass ? 102 : 120, pass ? 66 : 120);
    doc.text(pass ? "PASS" : "N/A", right - 4, y + 5.2, { align: "right" });
    if (hasRemark) {
      doc.setTextColor(100, 85, 75); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
      doc.text(`Remark: ${item.remark}`, left + 8, y + 10.5);
    }
    y += boxHeight + 2;
  }

  y += 14;
  y = ensurePage(doc, y, 12);
  doc.setTextColor(45, 37, 33); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Visual Evidence", left, y); y += 6;
  
  if (historicalData) {
    y = ensurePage(doc, y, 12);
    doc.setTextColor(118, 102, 93);
    doc.setFont("helvetica", "italic");
    doc.text("Note: Photo attachments are not stored locally in history to save space.", left + 3, y);
    y += 12;
  } else {
    for (let i = 0; i < photoHeadings.length; i += 1) {
      const heading = photoHeadings[i];
      const photos = photoStore.get(i) || [];
      y = ensurePage(doc, y, 18);
      doc.setFillColor(245, 239, 234); doc.roundedRect(left, y, width, 8, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.2); doc.setTextColor(62, 48, 39);
      doc.text(doc.splitTextToSize(heading, 176), left + 3, y + 5.2);
      y += 9;
      if (!photos.length) { y = ensurePage(doc, y, 8); doc.setTextColor(118, 102, 93); doc.text("No photos attached.", left + 3, y + 4); y += 11; continue; }
      const w = 42; const h = 32; const gap = 3; let col = 0;
      for (const photo of photos) {
        if (col === 0) y = ensurePage(doc, y, h + 4);
        const x = left + col * (w + gap);
        doc.setDrawColor(210, 196, 186); doc.roundedRect(x, y, w, h, 1.2, 1.2, "S");
        doc.addImage(photo, "JPEG", x, y, w, h);
        col += 1;
        if (col >= 4) { col = 0; y += h + 4; }
      }
      if (col !== 0) y += h + 4;
    }
  }

  // Add signature section at the end of PDF
  y += 4;
  y = ensurePage(doc, y, 40);
  doc.setTextColor(45, 37, 33); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Authorized Inspector Signature", left, y); y += 6;
  doc.setDrawColor(210, 196, 186); doc.roundedRect(left, y, 60, 25, 1.2, 1.2, "S");
  
  const sigData = historicalData ? historicalData.signature : (isSigEmpty ? null : signatureCanvas.toDataURL("image/png"));
  if (sigData) {
    try {
      doc.addImage(sigData, "PNG", left + 2, y + 2, 56, 21);
    } catch (e) {
      console.error("Failed to add signature image:", e);
    }
  } else {
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("No signature captured", left + 5, y + 13);
  }
  y += 30;

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(230, 221, 214); doc.line(14, 287, 196, 287);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 108, 100);
    doc.text(`${brand.companyName}  |  Confidential QA Report`, 14, 292);
    doc.text(`Page ${p} of ${pages}`, 196, 292, { align: "right" });
  }

  doc.save(`${report.productNumber || "inspection"}-inspection-report.pdf`);
}

finishInspectionButton.addEventListener("click", () => {
  photoStatus.textContent = "Generating PDF...";
  
  const report = collectInspectionData();
  const record = {
    id: Date.now().toString(),
    productName: report.productName,
    productNumber: report.productNumber,
    inspectorName: report.inspectorName,
    date: report.date,
    timestamp: report.timestamp,
    checklist: report.checklist,
    signature: isSigEmpty ? null : signatureCanvas.toDataURL("image/png")
  };
  saveInspectionToHistory(record);
  
  exportInspectionPdf();
  setTimeout(() => {
    resetWorkflow();
    setActiveTab("history");
  }, 350);
});

// Signature Pad Drawing Logic
let isDrawing = false;
let isSigEmpty = true;
const sigCtx = signatureCanvas.getContext("2d");

function initSignaturePad() {
  sigCtx.strokeStyle = "#2d2521";
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";

  // Mouse events
  signatureCanvas.addEventListener("mousedown", startDrawing);
  signatureCanvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stopDrawing);

  // Touch events for mobile support
  signatureCanvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      signatureCanvas.dispatchEvent(mouseEvent);
    }
  }, { passive: false });

  signatureCanvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      signatureCanvas.dispatchEvent(mouseEvent);
    }
  }, { passive: false });

  signatureCanvas.addEventListener("touchend", () => {
    const mouseEvent = new MouseEvent("mouseup", {});
    signatureCanvas.dispatchEvent(mouseEvent);
  });
}

function getMousePos(canvasDom, clientX, clientY) {
  const rect = canvasDom.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvasDom.width / rect.width),
    y: (clientY - rect.top) * (canvasDom.height / rect.height)
  };
}

function startDrawing(e) {
  isDrawing = true;
  isSigEmpty = false;
  sigCtx.beginPath();
  const pos = getMousePos(signatureCanvas, e.clientX, e.clientY);
  sigCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getMousePos(signatureCanvas, e.clientX, e.clientY);
  sigCtx.lineTo(pos.x, pos.y);
  sigCtx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignature() {
  sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  isSigEmpty = true;
}

clearSignatureButton.addEventListener("click", clearSignature);

// Navigation logic
btnNewInspection.addEventListener("click", () => {
  const fd = new FormData(form);
  const hasData = fd.get("productName") || fd.get("productNumber") || fd.get("inspectorName") || !isSigEmpty;
  if (hasData) {
    if (confirm("Clear current form details and start a new inspection?")) {
      resetWorkflow();
      setActiveTab("new");
    }
  } else {
    setActiveTab("new");
  }
});

btnViewHistory.addEventListener("click", () => {
  setActiveTab("history");
});

function setActiveTab(tab) {
  if (tab === "new") {
    btnNewInspection.classList.add("active");
    btnViewHistory.classList.remove("active");
    entryScreen.style.display = "block";
    checklistScreen.style.display = "block";
    photoScreen.style.display = "block";
    historyScreen.style.display = "none";
  } else {
    btnNewInspection.classList.remove("active");
    btnViewHistory.classList.add("active");
    entryScreen.style.display = "none";
    checklistScreen.style.display = "none";
    photoScreen.style.display = "none";
    historyScreen.style.display = "block";
    renderHistory();
  }
}

// History features
function saveInspectionToHistory(data) {
  const history = JSON.parse(localStorage.getItem("inspection_history") || "[]");
  history.unshift(data);
  localStorage.setItem("inspection_history", JSON.stringify(history));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("inspection_history") || "[]");
  historyList.innerHTML = "";
  
  if (history.length === 0) {
    return;
  }
  
  history.forEach((record) => {
    const passedCount = record.checklist.filter(item => item.checked).length;
    const totalCount = record.checklist.length;
    const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
    
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-header">
        <div>
          <h3 class="history-card-title">${escapeHtml(record.productName || "Unnamed Product")}</h3>
          <p class="history-card-subtitle">Number: ${escapeHtml(record.productNumber || "N/A")} | Inspector: ${escapeHtml(record.inspectorName || "N/A")}</p>
        </div>
        <div class="history-card-meta">
          <div>${record.date}</div>
          <div>${record.timestamp}</div>
        </div>
      </div>
      <div class="history-card-details">
        <div class="history-detail-item">Compliance: <span>${passedCount}/${totalCount} (${passRate}%) Passed</span></div>
        <div class="history-detail-item">Signature: <span>${record.signature ? "Signed" : "None"}</span></div>
      </div>
      <div class="history-card-actions">
        <button class="secondary-button view-pdf-btn" data-id="${record.id}" type="button">Download PDF</button>
        <button class="secondary-button delete-btn" data-id="${record.id}" type="button" style="border-color: #e5a9a9; color: #a94444;">Delete</button>
      </div>
    `;
    
    card.querySelector(".view-pdf-btn").addEventListener("click", () => {
      exportInspectionPdf(record);
    });
    
    card.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`Delete inspection record for ${record.productName || "Unnamed Product"}?`)) {
        deleteInspection(record.id);
      }
    });
    
    historyList.appendChild(card);
  });
}

function deleteInspection(id) {
  let history = JSON.parse(localStorage.getItem("inspection_history") || "[]");
  history = history.filter(item => item.id !== id);
  localStorage.setItem("inspection_history", JSON.stringify(history));
  renderHistory();
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

form.reset();
buildChecklist();
checklistForm.reset();
buildPhotoGroups();
initSignaturePad();


