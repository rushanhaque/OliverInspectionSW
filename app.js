const form = document.querySelector("#inspection-form");
const checklistForm = document.querySelector("#checklist-form");
const finishInspectionButton = document.querySelector("#finish-inspection");
const dateInput = document.querySelector("#inspection-date");
const timeInput = document.querySelector("#inspection-time");
const isoInput = document.querySelector("#inspection-iso");
const productNumberInput = document.querySelector("#product-number");
const editTimeBtn = document.querySelector("#edit-time-btn");
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
  "Carton Drop + packagin pictures",
  "Product Compare with counter sample",
  "Product labels",
  "Group picture",
  "Electrical test",
  "Issues found",
];
const CHECKLIST_ITEMS = [
  { key: "cartonDimensions", label: "Carton dimension" },
  { key: "cartonLabeling", label: "Carton labelling" },
  { key: "packaging", label: "Packaging" },
  { key: "productDimensions", label: "Product dimensions" },
  { key: "productHangTags", label: "Product Hang tags, Barcode, Price Labels, etc." },
  { key: "productFunction", label: "Product function as intended" },
  { key: "productMaterials", label: "Product materials" },
  { key: "assemblyInstructionsAvailable", label: "Assembly Instructions Available" },
];

const photoStore = new Map();
let currentCameraGroupId = null;
let currentCameraStream = null;
let cachedCameraStream = null;
let isOpeningCamera = false;
let viewerScale = 1;

let isCustomTime = false;
let timestampInterval = null;

function updateTimestamp() {
  if (isCustomTime) return;
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
  dateInput.value = localISOTime.split('T')[0];
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  timeInput.value = `${hh}:${min}`;
  isoInput.value = now.toISOString();
}

function startTimestampInterval() {
  dateInput.setAttribute("readonly", "true");
  timeInput.setAttribute("readonly", "true");
  isCustomTime = false;
  updateTimestamp();
  if (timestampInterval) clearInterval(timestampInterval);
  timestampInterval = setInterval(updateTimestamp, 1000);
}
startTimestampInterval();

editTimeBtn.addEventListener("click", () => {
  dateInput.removeAttribute("readonly");
  timeInput.removeAttribute("readonly");
  isCustomTime = true;
  if (timestampInterval) clearInterval(timestampInterval);
  dateInput.focus();
});

dateInput.addEventListener("change", () => { isCustomTime = true; });
timeInput.addEventListener("change", () => { isCustomTime = true; });

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
        <span>${item.label}</span>
        <input type="checkbox" name="${item.key}" />
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
          <div class="photo-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="secondary-button photo-add" data-photo-trigger="${index}" type="button" style="flex: 1; min-width: 110px; min-height: 44px;">Camera</button>
            <label class="secondary-button photo-upload" style="flex: 1; min-width: 110px; min-height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; gap: 6px; font-weight: 700;">
              Upload
              <input type="file" accept="image/*" multiple data-photo-upload="${index}" style="display: none;" />
            </label>
          </div>
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

photoGroups.addEventListener("change", (event) => {
  const uploadInput = event.target.closest("[data-photo-upload]");
  if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
    const groupId = Number(uploadInput.getAttribute("data-photo-upload"));
    Array.from(uploadInput.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const compressed = await compressImage(e.target.result, 1200, 0.7);
        const photos = photoStore.get(groupId) || [];
        photos.push(compressed);
        photoStore.set(groupId, photos);
        renderPhotoList(groupId);
      };
      reader.readAsDataURL(file);
    });
    uploadInput.value = "";
  }
});

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
    // Reuse cached stream if tracks are still alive
    let stream = null;
    if (cachedCameraStream && cachedCameraStream.getTracks().every(t => t.readyState === 'live')) {
      stream = cachedCameraStream;
    } else {
      // Previous stream is dead, clean it up
      if (cachedCameraStream) {
        cachedCameraStream.getTracks().forEach(t => t.stop());
        cachedCameraStream = null;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cachedCameraStream = stream;
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
  // Don't kill the stream tracks — just detach from preview so we can reuse without re-prompting permissions
  currentCameraGroupId = null;
  cameraPreview.srcObject = null;
  // Keep cachedCameraStream alive
}

window.addEventListener("beforeunload", () => {
  if (cachedCameraStream) {
    cachedCameraStream.getTracks().forEach(t => t.stop());
    cachedCameraStream = null;
  }
});

function captureCurrentFrame() {
  if (!currentCameraStream || currentCameraGroupId === null) return;
  const vw = cameraPreview.videoWidth;
  const vh = cameraPreview.videoHeight;
  if (!vw || !vh) return;
  // Downscale capture to max 1200px to save memory
  let cw = vw, ch = vh;
  const maxCaptureDim = 1200;
  if (cw > maxCaptureDim || ch > maxCaptureDim) {
    if (cw > ch) { ch = Math.round(ch * (maxCaptureDim / cw)); cw = maxCaptureDim; }
    else { cw = Math.round(cw * (maxCaptureDim / ch)); ch = maxCaptureDim; }
  }
  cameraCanvas.width = cw;
  cameraCanvas.height = ch;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, cw, ch);
  const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.7);
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
    buyerName: String(fd.get("buyerName") || ""),
    poNumber: String(fd.get("poNumber") || ""),
    inspectionType: String(fd.get("inspectionType") || ""),
    inspectionResult: String(fd.get("inspectionResult") || ""),
    aql: String(fd.get("aql") || "2.5"),
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

function compressImage(dataUrl, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else { w = Math.round(w * (maxDim / h)); h = maxDim; }
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function resetWorkflow() {
  form.reset();
  checklistForm.reset();
  startTimestampInterval();
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

async function exportInspectionPdf(historicalData = null) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    photoStatus.textContent = "PDF library not loaded.";
    return;
  }
  const report = historicalData || collectInspectionData();
  const brand = {
    companyName: "Oliver McInroy & Co.",
    reportTitle: "Final Quality Inspection Report",
    inspectorDept: "Quality Assurance Division",
    address: "Prem Nagar Industrial Area, Kanth Road, Moradabad, UP-244001, India",
    logoMonogram: "OM",
  };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14;
  const right = 196;
  const width = right - left;
  let y = 14;

  doc.setFillColor(55, 65, 81); doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(brand.companyName, left, 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(brand.inspectorDept, left, 23); doc.text(brand.address, left, 29);

  y = 42;
  doc.setTextColor(31, 41, 55); doc.setDrawColor(209, 213, 219); doc.setFillColor(243, 244, 246);
  doc.roundedRect(left, y, width, 49, 2, 2, "FD");
  doc.setFont("arial", "bold"); doc.setFontSize(12); doc.text("Inspection Snapshot", left + 4, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(`Product Name: ${report.productName || ""}`, left + 4, y + 14);
  doc.text(`SKU Number: ${report.productNumber || ""}`, left + 100, y + 14);
  doc.text(`Buyer Name: ${report.buyerName || ""}`, left + 4, y + 21);
  doc.text(`PO No.: ${report.poNumber || ""}`, left + 100, y + 21);
  doc.text(`Inspector Name: ${report.inspectorName || ""}`, left + 4, y + 28);
  doc.text(`Inspection Type: ${report.inspectionType || ""}`, left + 100, y + 28);
  doc.text(`Date: ${report.date || ""}`, left + 4, y + 35);
  doc.text(`Time: ${report.timestamp || ""}`, left + 100, y + 35);
  doc.text(`AQL: ${report.aql || "2.5"}`, left + 100, y + 42);
  doc.setFont("helvetica", "bold");
  doc.text(`Result: ${report.inspectionResult || ""}`, left + 4, y + 42);
  doc.setFont("helvetica", "normal");

  y += 57;
  doc.setFont("arial", "bold"); doc.setFontSize(12); doc.text("Checklist Compliance", left, y); y += 5;
  for (const item of report.checklist) {
    const hasRemark = !!item.remark;
    const boxHeight = hasRemark ? 14 : 8;
    y = ensurePage(doc, y, boxHeight + 2);
    const pass = item.checked;
    doc.setFillColor(pass ? 225 : 245, pass ? 241 : 245, pass ? 229 : 245);
    doc.roundedRect(left, y, width, boxHeight, 1.5, 1.5, "F");
    doc.setTextColor(31, 41, 55); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(item.label, 160)[0], left + 4, y + 5.2);
    doc.setFont("helvetica", "bold"); doc.setTextColor(pass ? 52 : 120, pass ? 102 : 120, pass ? 66 : 120);
    doc.text(pass ? "PASS" : "N/A", right - 4, y + 5.2, { align: "right" });
    if (hasRemark) {
      doc.setTextColor(75, 85, 99); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
      doc.text(`Remark: ${item.remark}`, left + 8, y + 10.5);
    }
    y += boxHeight + 2;
  }

  y += 14;
  y = ensurePage(doc, y, 12);
  doc.setTextColor(31, 41, 55); doc.setFont("arial", "bold"); doc.setFontSize(12); doc.text("Visual Evidence", left, y); y += 6;
  
  if (historicalData) {
    y = ensurePage(doc, y, 12);
    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "italic");
    doc.text("Note: Photo attachments are not stored locally in history to save space.", left + 3, y);
    y += 12;
  } else {
    for (let i = 0; i < photoHeadings.length; i += 1) {
      const heading = photoHeadings[i];
      const photos = photoStore.get(i) || [];
      y = ensurePage(doc, y, 18);
      doc.setFillColor(243, 244, 246); doc.roundedRect(left, y, width, 8, 1.5, 1.5, "F");
      doc.setFont("arial", "bold"); doc.setFontSize(10.2); doc.setTextColor(31, 41, 55);
      doc.text(doc.splitTextToSize(heading, 176), left + 3, y + 5.2);
      y += 9;
      if (!photos.length) { y = ensurePage(doc, y, 8); doc.setTextColor(75, 85, 99); doc.text("No photos attached.", left + 3, y + 4); y += 11; continue; }
      const w = 42; const h = 32; const gap = 3; let col = 0;
      for (const photo of photos) {
        // Check page break for EVERY image, not just at col 0
        const newY = ensurePage(doc, y, h + 4);
        if (newY !== y) { col = 0; y = newY; } // Page broke — reset to first column
        const x = left + col * (w + gap);
        try {
          doc.setDrawColor(209, 213, 219); doc.roundedRect(x, y, w, h, 1.2, 1.2, "S");
          const compressed = await compressImage(photo, 600, 0.45);
          doc.addImage(compressed, "JPEG", x, y, w, h);
        } catch (imgErr) {
          console.error("Failed to add photo to PDF:", imgErr);
          // Draw a placeholder so user knows an image was here
          doc.setFillColor(245, 245, 245); doc.roundedRect(x, y, w, h, 1.2, 1.2, "F");
          doc.setTextColor(150,150,150); doc.setFontSize(8); doc.text("Image error", x + 8, y + 17);
        }
        col += 1;
        if (col >= 4) { col = 0; y += h + 4; }
      }
      if (col !== 0) y += h + 4;
    }
  }

  // Add signature section at the end of PDF
  y += 4;
  y = ensurePage(doc, y, 40);
  doc.setTextColor(31, 41, 55); doc.setFont("arial", "bold"); doc.setFontSize(12); doc.text("Authorized Inspector Signature", left, y); y += 6;
  doc.setDrawColor(209, 213, 219); doc.roundedRect(left, y, 60, 25, 1.2, 1.2, "S");
  
  let sigData = historicalData ? historicalData.signature : (isSigEmpty ? null : signatureCanvas.toDataURL("image/png"));
  if (sigData) sigData = await compressImage(sigData, 400, 0.6);
  if (sigData) {
    try {
      doc.addImage(sigData, "PNG", left + 2, y + 2, 56, 21);
    } catch (e) {
      console.error("Failed to add signature image:", e);
    }
  } else {
    // Leave blank for manual signature
  }
  y += 30;

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(229, 231, 235); doc.line(14, 287, 196, 287);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
    doc.text(`${brand.companyName}  |  Confidential QA Report`, 14, 292);
    doc.text(`Page ${p} of ${pages}`, 196, 292, { align: "right" });
  }

  doc.save(`${report.poNumber || "inspection"}-inspection-report.pdf`);
}

finishInspectionButton.addEventListener("click", () => {
  photoStatus.textContent = "Generating PDF...";
  
  const report = collectInspectionData();
  const record = {
    id: Date.now().toString(),
    productName: report.productName,
    productNumber: report.productNumber,
    inspectorName: report.inspectorName,
    buyerName: report.buyerName,
    poNumber: report.poNumber,
    inspectionType: report.inspectionType,
    inspectionResult: report.inspectionResult,
    aql: report.aql,
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
  sigCtx.strokeStyle = "#333333";
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
          <h3 class="history-card-title">${escapeHtml(record.productName || "Unnamed Product")} ${record.inspectionType ? `[${escapeHtml(record.inspectionType)}]` : ""}</h3>
          <p class="history-card-subtitle">Result: <strong>${escapeHtml(record.inspectionResult || "N/A")}</strong> | AQL: ${escapeHtml(record.aql || "2.5")} | Inspector: ${escapeHtml(record.inspectorName || "N/A")}</p>
        </div>
        <div class="history-card-meta">
          <div>${record.date}</div>
          <div>${record.timestamp}</div>
        </div>
      </div>
      <div class="history-card-details">
        <div class="history-detail-item">Compliance: <span>${passedCount}/${totalCount} (${passRate}%) Passed</span></div>
        <div class="history-detail-item">Signature: <span>${record.signature ? "Signed" : "None"}</span></div>
        <div class="history-detail-item">Buyer: <span>${escapeHtml(record.buyerName || "N/A")}</span></div>
        <div class="history-detail-item">PO No.: <span>${escapeHtml(record.poNumber || "N/A")}</span></div>
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


