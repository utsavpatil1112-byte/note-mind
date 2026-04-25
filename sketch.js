// sketch.js - Enhanced Sketch Pad with Tools, Shapes, Text, Undo

// ─── State ────────────────────────────────────────────────────────────────────
var sketchCanvas = null;
var sketchCtx = null;
var isDrawing = false;
var currentTool = 'pen'; // pen | marker | brush | eraser | text | select
var currentShape = null; // null | line | arrow | dbarrow | rect | circle | triangle | diamond
var currentStrokeColor = '#3b82f6';
var currentFillColor = 'rgba(59,130,246,0.2)';
var doFill = false;
var currentSize = 3;
var sketchFontSize = 24;
var currentSketchCallback = null;

// Undo stack
var sketchUndoStack = [];
var sketchRedoStack = [];
var MAX_UNDO = 25;
var sketchPages = [];
var currentSketchPage = 0;
var sketchObjects = [];
var selectedSketchObject = null;
var draggingObject = false;

// Shape drawing state
var startX = 0,
    startY = 0;
var previewImageData = null; // saved before shape preview

// Text tool state
var textPending = false;
var textX = 0,
    textY = 0;

// Drawing helpers
var lastX = 0,
    lastY = 0;

// ─── Init ─────────────────────────────────────────────────────────────────────
function initSketch() {
    sketchCanvas = document.getElementById('sketchCanvas');
    if (!sketchCanvas) return;
    sketchCtx = sketchCanvas.getContext('2d');

    // White background
    sketchCtx.fillStyle = 'white';
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.lineCap = 'round';
    sketchCtx.lineJoin = 'round';

    // Remove previous listeners safely
    sketchCanvas.onmousedown = startDrawing;
    sketchCanvas.onmousemove = draw;
    sketchCanvas.onmouseup = stopDrawing;
    sketchCanvas.onmouseleave = stopDrawing;
    sketchCanvas.onwheel = function(e) {
        if (currentTool !== 'select' || !selectedSketchObject) return;
        e.preventDefault();
        var delta = e.deltaY < 0 ? 1.06 : 0.94;
        var cx = (selectedSketchObject.x1 + selectedSketchObject.x2) / 2;
        var cy = (selectedSketchObject.y1 + selectedSketchObject.y2) / 2;
        selectedSketchObject.x1 = cx + (selectedSketchObject.x1 - cx) * delta;
        selectedSketchObject.y1 = cy + (selectedSketchObject.y1 - cy) * delta;
        selectedSketchObject.x2 = cx + (selectedSketchObject.x2 - cx) * delta;
        selectedSketchObject.y2 = cy + (selectedSketchObject.y2 - cy) * delta;
        redrawSketchFromObjects();
    };

    // Text input overlay
    var ti = document.getElementById('sketchTextInput');
    if (ti) {
        ti.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitTextToCanvas();
            } else if (e.key === 'Escape') {
                cancelTextInput();
            }
        };
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', onSketchKeyDown);

    setSketchTool('pen');
}

function onSketchKeyDown(e) {
    var modal = document.getElementById('sketchModal');
    if (!modal || !modal.classList.contains('show')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoSketch();
    }
}

// ─── Save state for undo ─────────────────────────────────────────────────────
function saveSketchState() {
    if (!sketchCtx) return;
    if (sketchUndoStack.length >= MAX_UNDO) sketchUndoStack.shift();
    sketchUndoStack.push(sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height));
    sketchRedoStack = [];
}

function undoSketch() {
    if (sketchUndoStack.length === 0) return;
    sketchRedoStack.push(sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height));
    var state = sketchUndoStack.pop();
    sketchCtx.putImageData(state, 0, 0);
}

function redoSketch() {
    if (sketchRedoStack.length === 0) return;
    sketchUndoStack.push(sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height));
    var state = sketchRedoStack.pop();
    sketchCtx.putImageData(state, 0, 0);
}

// ─── Tool & Shape setters ────────────────────────────────────────────────────
function setSketchTool(tool) {
    currentTool = tool;
    currentShape = null;
    cancelTextInput();

    document.querySelectorAll('.sketch-tool').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.sketch-shape').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.querySelector('.sketch-tool[data-tool="' + tool + '"]');
    if (btn) btn.classList.add('active');

    if (sketchCanvas) {
        sketchCanvas.style.cursor = tool === 'text' ? 'text' :
            tool === 'select' ? 'move' :
            tool === 'eraser' ? 'cell' : 'crosshair';
    }
}

function setShapeFromPreset(shape) {
    if (!shape) return;
    if (shape === 'square') shape = 'rect';
    if (shape === 'sphere') shape = 'circle';
    if (shape === 'cuboid') shape = 'rect';
    setSketchShape(shape);
}

function setSketchShape(shape) {
    currentShape = shape;
    currentTool = 'shape';
    cancelTextInput();

    document.querySelectorAll('.sketch-tool').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.sketch-shape').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.querySelector('.sketch-shape[data-shape="' + shape + '"]');
    if (btn) btn.classList.add('active');

    if (sketchCanvas) sketchCanvas.style.cursor = 'crosshair';
}

function setSketchStrokeColor(color) { currentStrokeColor = color; }

function setSketchFillColor(color) { currentFillColor = color; }

function setSketchFillMode(on) { doFill = on; }

function setSketchSize(size) {
    currentSize = parseInt(size, 10);
    var sp = document.getElementById('sizeValue');
    if (sp) sp.textContent = currentSize + 'px';
}

// Keep legacy signature for backward compat
function setSketchColor(color) { currentStrokeColor = color; }

function setSketchFontSize(size) {
    sketchFontSize = parseInt(size, 10);
}

// ─── Mouse events ────────────────────────────────────────────────────────────
function getCanvasPos(e) {
    var rect = sketchCanvas.getBoundingClientRect();
    var scaleX = sketchCanvas.width / rect.width;
    var scaleY = sketchCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    var pos = getCanvasPos(e);
    if (currentTool === 'select') {
        selectedSketchObject = getShapeAt(pos.x, pos.y);
        if (selectedSketchObject) {
            draggingObject = true;
            isDrawing = true;
            startX = pos.x;
            startY = pos.y;
            showSketchGuides(pos.x, pos.y);
        }
        return;
    }

    // Text tool: show input overlay
    if (currentTool === 'text') {
        commitTextToCanvas(); // commit any pending text first
        textX = pos.x;
        textY = pos.y;
        showTextInput(pos.x, pos.y);
        return;
    }

    isDrawing = true;
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;

    if (currentShape) {
        saveSketchState();
        previewImageData = sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height);
        return;
    }

    saveSketchState();
    applyStrokeStyle();
    sketchCtx.beginPath();
    sketchCtx.moveTo(startX, startY);

    if (currentTool === 'eraser') {
        sketchCtx.globalCompositeOperation = 'destination-out';
    } else {
        sketchCtx.globalCompositeOperation = 'source-over';
    }
}

function draw(e) {
    if (currentTool === 'select' && draggingObject && selectedSketchObject) {
        var pos2 = getCanvasPos(e);
        var dx = pos2.x - startX;
        var dy = pos2.y - startY;
        selectedSketchObject.x1 += dx;
        selectedSketchObject.y1 += dy;
        selectedSketchObject.x2 += dx;
        selectedSketchObject.y2 += dy;
        startX = pos2.x;
        startY = pos2.y;
        redrawSketchFromObjects();
        showSketchGuides(pos2.x, pos2.y);
        return;
    }
    if (!isDrawing) return;
    var pos = getCanvasPos(e);

    if (currentShape) {
        // Live preview
        if (previewImageData) sketchCtx.putImageData(previewImageData, 0, 0);
        drawShape(startX, startY, pos.x, pos.y, true);
        return;
    }

    applyStrokeStyle();

    if (currentTool === 'brush') {
        // Brush: splatter dots for texture
        var dist = Math.sqrt(Math.pow(pos.x - lastX, 2) + Math.pow(pos.y - lastY, 2));
        var steps = Math.max(1, Math.floor(dist / 3));
        for (var s = 0; s < steps; s++) {
            var t = s / steps;
            var ix = lastX + (pos.x - lastX) * t;
            var iy = lastY + (pos.y - lastY) * t;
            var jitter = currentSize * 1.5;
            sketchCtx.beginPath();
            sketchCtx.arc(
                ix + (Math.random() - 0.5) * jitter,
                iy + (Math.random() - 0.5) * jitter,
                currentSize * (0.3 + Math.random() * 0.5), 0, 2 * Math.PI
            );
            sketchCtx.fill();
        }
    } else {
        sketchCtx.beginPath();
        sketchCtx.moveTo(lastX, lastY);
        sketchCtx.lineTo(pos.x, pos.y);
        sketchCtx.stroke();
    }

    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing(e) {
    if (currentTool === 'select') {
        isDrawing = false;
        draggingObject = false;
        hideSketchGuides();
        return;
    }
    if (!isDrawing) return;
    isDrawing = false;

    if (currentShape && e) {
        var pos = getCanvasPos(e);
        if (previewImageData) { sketchCtx.putImageData(previewImageData, 0, 0);
            previewImageData = null; }
        drawShape(startX, startY, pos.x, pos.y, false);
        sketchObjects.push({ shape: currentShape, x1: startX, y1: startY, x2: pos.x, y2: pos.y, stroke: currentStrokeColor, fill: currentFillColor, doFill: doFill, size: currentSize });
    }

    sketchCtx.globalCompositeOperation = 'source-over';
}

// ─── Stroke style ─────────────────────────────────────────────────────────────
function applyStrokeStyle() {
    sketchCtx.lineCap = 'round';
    sketchCtx.lineJoin = 'round';

    if (currentTool === 'eraser') {
        sketchCtx.globalCompositeOperation = 'destination-out';
        sketchCtx.lineWidth = currentSize * 4;
        sketchCtx.strokeStyle = 'rgba(0,0,0,1)';
        sketchCtx.fillStyle = 'rgba(0,0,0,1)';
        return;
    }

    sketchCtx.globalCompositeOperation = 'source-over';

    if (currentTool === 'marker') {
        sketchCtx.globalAlpha = 0.45;
        sketchCtx.lineWidth = currentSize * 4;
        sketchCtx.strokeStyle = currentStrokeColor;
        sketchCtx.fillStyle = currentStrokeColor;
    } else if (currentTool === 'brush') {
        sketchCtx.globalAlpha = 0.6;
        sketchCtx.lineWidth = currentSize;
        sketchCtx.strokeStyle = currentStrokeColor;
        sketchCtx.fillStyle = currentStrokeColor;
    } else {
        sketchCtx.globalAlpha = 1;
        sketchCtx.lineWidth = currentSize;
        sketchCtx.strokeStyle = currentStrokeColor;
        sketchCtx.fillStyle = currentStrokeColor;
    }
}

// ─── Shape drawing ────────────────────────────────────────────────────────────
function drawShape(x1, y1, x2, y2, preview) {
    sketchCtx.globalAlpha = preview ? 0.7 : 1;
    sketchCtx.globalCompositeOperation = 'source-over';
    sketchCtx.strokeStyle = currentStrokeColor;
    sketchCtx.lineWidth = currentSize;
    sketchCtx.lineCap = 'round';
    sketchCtx.lineJoin = 'round';

    var w = x2 - x1,
        h = y2 - y1;

    sketchCtx.beginPath();
    switch (currentShape) {
        case 'line':
            sketchCtx.moveTo(x1, y1);
            sketchCtx.lineTo(x2, y2);
            sketchCtx.stroke();
            break;

        case 'arrow':
            drawArrowPath(x1, y1, x2, y2, false);
            break;

        case 'dbarrow':
            drawArrowPath(x1, y1, x2, y2, true);
            break;

        case 'rect':
            sketchCtx.rect(x1, y1, w, h);
            if (doFill) { sketchCtx.fillStyle = currentFillColor;
                sketchCtx.fill(); }
            sketchCtx.stroke();
            break;

        case 'circle':
            var rx = Math.abs(w) / 2,
                ry = Math.abs(h) / 2;
            var cx = x1 + w / 2,
                cy = y1 + h / 2;
            sketchCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            if (doFill) { sketchCtx.fillStyle = currentFillColor;
                sketchCtx.fill(); }
            sketchCtx.stroke();
            break;

        case 'triangle':
            sketchCtx.moveTo(x1 + w / 2, y1);
            sketchCtx.lineTo(x2, y2);
            sketchCtx.lineTo(x1, y2);
            sketchCtx.closePath();
            if (doFill) { sketchCtx.fillStyle = currentFillColor;
                sketchCtx.fill(); }
            sketchCtx.stroke();
            break;

        case 'diamond':
            sketchCtx.moveTo(x1 + w / 2, y1);
            sketchCtx.lineTo(x2, y1 + h / 2);
            sketchCtx.lineTo(x1 + w / 2, y2);
            sketchCtx.lineTo(x1, y1 + h / 2);
            sketchCtx.closePath();
            if (doFill) { sketchCtx.fillStyle = currentFillColor;
                sketchCtx.fill(); }
            sketchCtx.stroke();
            break;
        case 'pentagon':
        case 'hexagon':
        case 'cube':
        case 'sphere':
        case 'cylinder':
        case 'cone':
        case 'pyramid':
            drawPolygonShape(currentShape, x1, y1, x2, y2);
            break;
    }

    sketchCtx.globalAlpha = 1;
}

function drawPolygonShape(type, x1, y1, x2, y2) {
    var cx = (x1 + x2) / 2;
    var cy = (y1 + y2) / 2;
    var rx = Math.abs(x2 - x1) / 2;
    var ry = Math.abs(y2 - y1) / 2;
    if (type === 'sphere') type = 'circle';
    if (type === 'cube' || type === 'cuboid' || type === 'cylinder' || type === 'cone' || type === 'pyramid') {
        sketchCtx.rect(x1, y1, x2 - x1, y2 - y1);
        if (doFill) { sketchCtx.fillStyle = currentFillColor; sketchCtx.fill(); }
        sketchCtx.stroke();
        return;
    }
    var sides = type === 'pentagon' ? 5 : 6;
    sketchCtx.beginPath();
    for (var i = 0; i < sides; i++) {
        var ang = -Math.PI / 2 + (i * Math.PI * 2) / sides;
        var px = cx + Math.cos(ang) * rx;
        var py = cy + Math.sin(ang) * ry;
        if (i === 0) sketchCtx.moveTo(px, py);
        else sketchCtx.lineTo(px, py);
    }
    sketchCtx.closePath();
    if (doFill) { sketchCtx.fillStyle = currentFillColor; sketchCtx.fill(); }
    sketchCtx.stroke();
}

function drawArrowPath(fromX, fromY, toX, toY, doubleArrow) {
    var angle = Math.atan2(toY - fromY, toX - fromX);
    var arrowSize = Math.max(12, currentSize * 4);

    // Line
    sketchCtx.moveTo(fromX, fromY);
    sketchCtx.lineTo(toX, toY);
    sketchCtx.stroke();

    // Arrowhead at end
    sketchCtx.beginPath();
    sketchCtx.moveTo(toX, toY);
    sketchCtx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
    sketchCtx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
    sketchCtx.closePath();
    sketchCtx.fillStyle = currentStrokeColor;
    sketchCtx.fill();

    // Arrowhead at start for double-arrow
    if (doubleArrow) {
        sketchCtx.beginPath();
        sketchCtx.moveTo(fromX, fromY);
        sketchCtx.lineTo(fromX + arrowSize * Math.cos(angle - Math.PI / 6), fromY + arrowSize * Math.sin(angle - Math.PI / 6));
        sketchCtx.lineTo(fromX + arrowSize * Math.cos(angle + Math.PI / 6), fromY + arrowSize * Math.sin(angle + Math.PI / 6));
        sketchCtx.closePath();
        sketchCtx.fillStyle = currentStrokeColor;
        sketchCtx.fill();
    }
}

// ─── Text tool ────────────────────────────────────────────────────────────────
function showTextInput(canvasX, canvasY) {
    var ti = document.getElementById('sketchTextInput');
    if (!ti) return;

    var rect = sketchCanvas.getBoundingClientRect();
    var scaleX = rect.width / sketchCanvas.width;
    var scaleY = rect.height / sketchCanvas.height;

    ti.style.display = 'block';
    ti.style.left = (canvasX * scaleX) + 'px';
    ti.style.top = ((canvasY - sketchFontSize) * scaleY) + 'px';
    ti.style.fontSize = (sketchFontSize * scaleY) + 'px';
    ti.style.color = currentStrokeColor;
    ti.value = '';
    textPending = true;
    textX = canvasX;
    textY = canvasY;

    setTimeout(function() { ti.focus(); }, 50);
}

function commitTextToCanvas() {
    if (!textPending) return;
    var ti = document.getElementById('sketchTextInput');
    if (!ti || !ti.value.trim()) { cancelTextInput(); return; }

    saveSketchState();
    sketchCtx.font = sketchFontSize + 'px "Segoe UI", Inter, system-ui, sans-serif';
    sketchCtx.fillStyle = currentStrokeColor;
    sketchCtx.globalAlpha = 1;
    sketchCtx.fillText(ti.value, textX, textY);

    cancelTextInput();
}

function cancelTextInput() {
    textPending = false;
    var ti = document.getElementById('sketchTextInput');
    if (ti) { ti.style.display = 'none';
        ti.value = ''; }
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function clearSketch() {
    if (!confirm('Clear entire sketch?')) return;
    saveSketchState();
    sketchCtx.fillStyle = 'white';
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchObjects = [];
}

function saveSketch() {
    commitTextToCanvas();
    var dataURL = sketchCanvas.toDataURL('image/png');
    if (currentSketchCallback) currentSketchCallback(dataURL);
    closeSketch();
}

function cancelSketch() { closeSketch(); }

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openSketch() {
    var modal = document.getElementById('sketchModal');
    if (!modal) { console.error('Sketch modal not found'); return; }
    modal.classList.add('show');

    setTimeout(function() {
        sketchCanvas = document.getElementById('sketchCanvas');
        if (!sketchCanvas) return;
        sketchCtx = sketchCanvas.getContext('2d');
        sketchCtx.fillStyle = 'white';
        sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
        sketchUndoStack = [];
        sketchRedoStack = [];
        sketchPages = [null];
        currentSketchPage = 0;
        sketchObjects = [];
        sketchCanvas.onmousedown = startDrawing;
        sketchCanvas.onmousemove = draw;
        sketchCanvas.onmouseup = stopDrawing;
        sketchCanvas.onmouseleave = stopDrawing;
        sketchCanvas.onwheel = function(e) {
            if (currentTool !== 'select' || !selectedSketchObject) return;
            e.preventDefault();
            var delta = e.deltaY < 0 ? 1.06 : 0.94;
            var cx = (selectedSketchObject.x1 + selectedSketchObject.x2) / 2;
            var cy = (selectedSketchObject.y1 + selectedSketchObject.y2) / 2;
            selectedSketchObject.x1 = cx + (selectedSketchObject.x1 - cx) * delta;
            selectedSketchObject.y1 = cy + (selectedSketchObject.y1 - cy) * delta;
            selectedSketchObject.x2 = cx + (selectedSketchObject.x2 - cx) * delta;
            selectedSketchObject.y2 = cy + (selectedSketchObject.y2 - cy) * delta;
            redrawSketchFromObjects();
        };
        setSketchTool('pen');
        renderSketchPageTabs();
    }, 80);
}

function closeSketch() {
    commitTextToCanvas();
    var modal = document.getElementById('sketchModal');
    if (modal) modal.classList.remove('show');
    currentSketchCallback = null;
    previewImageData = null;
}

function newSketchPage() {
    if (!sketchCanvas) return;
    sketchPages[currentSketchPage] = sketchCanvas.toDataURL('image/png');
    sketchPages.push(null);
    currentSketchPage = sketchPages.length - 1;
    sketchCtx.fillStyle = 'white';
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchObjects = [];
    renderSketchPageTabs();
}

function switchSketchPage(idx) {
    if (!sketchCanvas || idx < 0 || idx >= sketchPages.length) return;
    sketchPages[currentSketchPage] = sketchCanvas.toDataURL('image/png');
    currentSketchPage = idx;
    sketchCtx.fillStyle = 'white';
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    var data = sketchPages[idx];
    if (data) {
        var img = new Image();
        img.onload = function() { sketchCtx.drawImage(img, 0, 0); };
        img.src = data;
    }
    renderSketchPageTabs();
}

function renderSketchPageTabs() {
    var tabs = document.getElementById('sketchPageTabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    for (var i = 0; i < sketchPages.length; i++) {
        var b = document.createElement('button');
        b.className = 'note-page-tab' + (i === currentSketchPage ? ' active' : '');
        b.textContent = 'Page ' + (i + 1);
        b.onclick = (function(idx) { return function() { switchSketchPage(idx); }; })(i);
        tabs.appendChild(b);
    }
}

function exportSketchAsImage() {
    if (!sketchCanvas) return;
    var link = document.createElement('a');
    link.download = 'sketch-page-' + (currentSketchPage + 1) + '.png';
    link.href = sketchCanvas.toDataURL('image/png');
    link.click();
}

function toggleSketchInsertMenu(event) {
    var menu = document.getElementById('sketchInsertMenu');
    if (!menu) return;
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }
    var rect = event.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.display = 'block';
}

function insertSketchImage() {
    var menu = document.getElementById('sketchInsertMenu');
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() { sketchCtx.drawImage(img, 20, 20, Math.min(320, img.width), Math.min(220, img.height)); };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
    if (menu) menu.style.display = 'none';
}

function insertSketchAudio() {
    alert('Audio inserted (UI ready).');
    var menu = document.getElementById('sketchInsertMenu');
    if (menu) menu.style.display = 'none';
}

function getShapeAt(x, y) {
    for (var i = sketchObjects.length - 1; i >= 0; i--) {
        var s = sketchObjects[i];
        var minX = Math.min(s.x1, s.x2);
        var maxX = Math.max(s.x1, s.x2);
        var minY = Math.min(s.y1, s.y2);
        var maxY = Math.max(s.y1, s.y2);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return s;
    }
    return null;
}

function redrawSketchFromObjects() {
    sketchCtx.fillStyle = 'white';
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    for (var i = 0; i < sketchObjects.length; i++) {
        var s = sketchObjects[i];
        currentShape = s.shape;
        currentStrokeColor = s.stroke;
        currentFillColor = s.fill;
        doFill = s.doFill;
        currentSize = s.size;
        drawShape(s.x1, s.y1, s.x2, s.y2, false);
    }
}

function showSketchGuides(x, y) {
    var gx = document.getElementById('sketchGuideX');
    var gy = document.getElementById('sketchGuideY');
    if (!gx || !gy || !sketchCanvas) return;
    gx.style.display = 'block';
    gy.style.display = 'block';
    gx.style.left = x + 'px';
    gy.style.top = y + 'px';
}

function hideSketchGuides() {
    var gx = document.getElementById('sketchGuideX');
    var gy = document.getElementById('sketchGuideY');
    if (gx) gx.style.display = 'none';
    if (gy) gy.style.display = 'none';
}

// Entry points used by mindmaps.js
function openSketchForNode(callback) {
    currentSketchCallback = callback;
    openSketch();
}

// Entry point used by editor.js (notes)
function openSketchWithCallback(callback) {
    currentSketchCallback = callback;
    openSketch();
}

// ─── Init on load ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSketch);
} else {
    initSketch();
}