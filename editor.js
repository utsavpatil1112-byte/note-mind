// editor.js - Editor functionality with Export, Fixed Grid & Zoom

/* ==========================================
   GRID SYSTEM - FIXED ALIGNMENT
   ========================================== */
var gridVisible = true;
var currentFontSz = 16;
var currentFontFamily = "'Segoe UI', 'Inter', system-ui, sans-serif";
var LINE_HEIGHT_RATIO = 1.6;

function getRowHeight(fontSize) {
    return Math.round(fontSize * LINE_HEIGHT_RATIO);
}

function applyGridStyle() {
    var rh = getRowHeight(currentFontSz);
    editor.style.setProperty('--grid-row-h', rh + 'px');
    editor.style.setProperty('--base-font-size', currentFontSz + 'px');
    editor.style.fontSize = currentFontSz + 'px';
    editor.style.fontFamily = currentFontFamily;
    editor.style.lineHeight = rh + 'px';

    var allBlocks = editor.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, li');
    for (var i = 0; i < allBlocks.length; i++) {
        var block = allBlocks[i];
        if (block.tagName === 'H1') {
            block.style.lineHeight = (rh * 2) + 'px';
            block.style.fontSize = (currentFontSz * 2) + 'px';
        } else if (block.tagName === 'H2') {
            block.style.lineHeight = (rh * 1.75) + 'px';
            block.style.fontSize = (currentFontSz * 1.75) + 'px';
        } else if (block.tagName === 'H3') {
            block.style.lineHeight = (rh * 1.5) + 'px';
            block.style.fontSize = (currentFontSz * 1.5) + 'px';
        } else {
            block.style.lineHeight = rh + 'px';
            block.style.fontSize = currentFontSz + 'px';
            block.style.fontFamily = currentFontFamily;
        }
    }

    if (gridVisible) {
        editor.classList.add('grid-visible');
        if (lineNumbers) lineNumbers.style.display = 'block';
        if (gridToggleBtn) {
            gridToggleBtn.classList.add('grid-on');
            gridToggleBtn.textContent = '⊞ Grid';
        }
    } else {
        editor.classList.remove('grid-visible');
        if (lineNumbers) lineNumbers.style.display = 'none';
        if (gridToggleBtn) {
            gridToggleBtn.classList.remove('grid-on');
            gridToggleBtn.textContent = '⊟ Grid';
        }
    }
    updateLineNumbers();
}

function toggleGrid() {
    gridVisible = !gridVisible;
    applyGridStyle();
    if (currentNote) {
        currentNote.gridVisible = gridVisible;
        triggerAutoSave();
    }
}

function updateLineNumbers() {
    if (!lineNumbers) return;
    if (!gridVisible) {
        lineNumbers.innerHTML = '';
        lineNumbers.style.display = 'none';
        return;
    }
    lineNumbers.style.display = 'block';

    var rh = getRowHeight(currentFontSz);
    var scrollTop = editor.scrollTop;
    var visibleHeight = editor.clientHeight;

    var startLine = Math.max(1, Math.floor(scrollTop / rh));
    var endLine = Math.ceil((scrollTop + visibleHeight) / rh);
    var totalLines = Math.ceil(editor.scrollHeight / rh);

    var html = '';
    for (var i = startLine; i <= Math.min(endLine, totalLines); i++) {
        var isActive = isLineActive(i, rh);
        var activeClass = isActive ? ' active-num' : '';
        html += '<div class="line-num' + activeClass + '" style="height:' + rh + 'px;line-height:' + rh + 'px;">' + i + '</div>';
    }
    lineNumbers.innerHTML = html;
    lineNumbers.scrollTop = scrollTop;
}

function isLineActive(lineNum, rh) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    try {
        var range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        var rect = range.getBoundingClientRect();
        var editorRect = editor.getBoundingClientRect();
        var relTop = rect.top - editorRect.top + editor.scrollTop;
        var currentLine = Math.floor(relTop / rh) + 1;
        return currentLine === lineNum;
    } catch (e) {
        return false;
    }
}

function updateToolbarActiveStates() {
    var isBold = document.queryCommandState('bold');
    var boldBtn = document.getElementById('boldBtn');
    if (boldBtn) { if (isBold) boldBtn.classList.add('active');
        else boldBtn.classList.remove('active'); }

    var isItalic = document.queryCommandState('italic');
    var italicBtn = document.getElementById('italicBtn');
    if (italicBtn) { if (isItalic) italicBtn.classList.add('active');
        else italicBtn.classList.remove('active'); }

    var isUnderline = document.queryCommandState('underline');
    var underlineBtn = document.getElementById('underlineBtn');
    if (underlineBtn) { if (isUnderline) underlineBtn.classList.add('active');
        else underlineBtn.classList.remove('active'); }

    var headingSelect = document.getElementById('headingSelect');
    if (headingSelect) {
        var blockName = document.queryCommandValue('formatBlock');
        if (blockName === 'H1') headingSelect.value = 'H1';
        else if (blockName === 'H2') headingSelect.value = 'H2';
        else if (blockName === 'H3') headingSelect.value = 'H3';
        else headingSelect.value = 'P';
    }
}

editor.addEventListener('keyup', function() {
    updateToolbarActiveStates();
    updateLineNumbers();
    updateActiveLine();
    applyGridStyle();
    if (currentNote) {
        currentNote.content = editor.innerHTML;
        triggerAutoSave();
    }
});

editor.addEventListener('mouseup', function() {
    updateToolbarActiveStates();
    updateLineNumbers();
    updateActiveLine();
});

editor.addEventListener('click', function() {
    updateToolbarActiveStates();
    updateLineNumbers();
    updateActiveLine();
});

// Keyboard shortcut: Ctrl+K for hyperlink
editor.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        insertNoteHyperlink();
    }
});

function setSize(size) {
    size = Math.max(10, Math.min(72, parseInt(size, 10)));
    if (isNaN(size)) return;
    currentFontSz = size;
    fontSizeInput.value = size;
    applyGridStyle();
    if (currentNote) {
        currentNote.fontSize = currentFontSz;
        triggerAutoSave();
    }
}

function setFontFamily(font) {
    currentFontFamily = font;
    applyGridStyle();
    if (currentNote) {
        currentNote.fontFamily = currentFontFamily;
        triggerAutoSave();
    }
}

function execCmd(c) {
    editor.focus();
    document.execCommand(c, false, null);
    updateToolbarActiveStates();
    setTimeout(function() {
        updateLineNumbers();
        applyGridStyle();
        if (currentNote) {
            currentNote.content = editor.innerHTML;
            triggerAutoSave();
        }
    }, 10);
}

function setHeading(tag) {
    editor.focus();
    document.execCommand("formatBlock", false, tag);
    updateToolbarActiveStates();
    setTimeout(function() {
        updateLineNumbers();
        applyGridStyle();
        if (currentNote) {
            currentNote.content = editor.innerHTML;
            triggerAutoSave();
        }
    }, 10);
}

function setColor(c) {
    editor.focus();
    document.execCommand("foreColor", false, c);
    if (currentNote) {
        currentNote.content = editor.innerHTML;
        triggerAutoSave();
    }
}

function setList(type) {
    if (type === 'default') type = 'disc';
    editor.focus();
    if (type === "disc" || type === "circle" || type === "square") {
        if (document.queryCommandState('insertOrderedList')) {
            document.execCommand('insertOrderedList');
        }
        document.execCommand('insertUnorderedList');
        setTimeout(function() {
            var lists = document.querySelectorAll('ul');
            if (lists.length) {
                lists[lists.length - 1].style.listStyleType = type;
            }
        }, 10);
    } else {
        if (document.queryCommandState('insertUnorderedList')) {
            document.execCommand('insertUnorderedList');
        }
        document.execCommand('insertOrderedList');
        setTimeout(function() {
            var lists = document.querySelectorAll('ol');
            if (lists.length) {
                lists[lists.length - 1].style.listStyleType = type;
            }
        }, 10);
    }
    setTimeout(function() {
        if (currentNote) {
            currentNote.content = editor.innerHTML;
            triggerAutoSave();
        }
    }, 20);
}

function updateActiveLine() {
    var activeLines = editor.querySelectorAll('.active-line');
    for (var i = 0; i < activeLines.length; i++) {
        activeLines[i].classList.remove('active-line');
    }
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (node && node !== editor && editor.contains(node)) {
        var block = node;
        while (block.parentNode !== editor && block.parentNode) {
            block = block.parentNode;
        }
        if (block && block !== editor) {
            block.classList.add('active-line');
        }
    }
}

editor.addEventListener('scroll', function() {
    updateLineNumbers();
});

editor.addEventListener('paste', function(e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
    updateLineNumbers();
    updateActiveLine();
    if (currentNote) {
        currentNote.content = editor.innerHTML;
        triggerAutoSave();
    }
});

/* ==========================================
   NEW PAGE FEATURE
   ========================================== */
function addNewNotePage() {
    editor.focus();
    var pageBreakHtml =
        '<div style="page-break-after:always;border-top:2px dashed var(--accent);margin:24px 0;padding-top:8px;text-align:center;color:var(--text-muted);font-size:11px;letter-spacing:1px;user-select:none;">─────── Page Break ───────</div>' +
        '<div><br></div>';
    document.execCommand('insertHTML', false, pageBreakHtml);
    if (currentNote) {
        currentNote.content = editor.innerHTML;
        triggerAutoSave();
    }
    setTimeout(function() {
        updateLineNumbers();
        applyGridStyle();
    }, 20);
}

/* ==========================================
   HYPERLINK IN NOTE
   ========================================== */
var savedNoteRange = null;
var notePagesById = {};
var currentNotePageIndex = 0;

function insertNoteHyperlink() {
    // Save current selection range
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
        savedNoteRange = sel.getRangeAt(0).cloneRange();
    }

    // Populate internal file selector
    var select = document.getElementById('noteInternalFileSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Select internal note/mind map --</option>';
        if (typeof notes !== 'undefined' && notes) {
            for (var i = 0; i < notes.length; i++) {
                var option = document.createElement('option');
                option.value = 'note:' + notes[i].id;
                option.textContent = '📝 ' + notes[i].name;
                select.appendChild(option);
            }
        }
        if (typeof mindMaps !== 'undefined' && mindMaps) {
            for (var j = 0; j < mindMaps.length; j++) {
                var option2 = document.createElement('option');
                option2.value = 'mindmap:' + mindMaps[j].id;
                option2.textContent = '🧠 ' + mindMaps[j].name;
                select.appendChild(option2);
            }
        }
    }

    // Pre-fill link text with selection
    var textInput = document.getElementById('noteLinkText');
    if (textInput && sel && sel.toString()) {
        textInput.value = sel.toString();
    }

    var modal = document.getElementById('noteHyperlinkModal');
    if (modal) modal.classList.add('show');
}

function closeNoteHyperlinkModal() {
    var modal = document.getElementById('noteHyperlinkModal');
    if (modal) modal.classList.remove('show');
    var urlInput = document.getElementById('noteLinkUrl');
    if (urlInput) urlInput.value = '';
    var textInput = document.getElementById('noteLinkText');
    if (textInput) textInput.value = '';
    var openBoth = document.getElementById('noteHyperlinkOpenBoth');
    if (openBoth) openBoth.checked = false;
    savedNoteRange = null;
}

function confirmNoteHyperlink() {
    var urlInput = document.getElementById('noteLinkUrl');
    var textInput = document.getElementById('noteLinkText');
    var select = document.getElementById('noteInternalFileSelect');

    var url = urlInput ? urlInput.value.trim() : '';
    var linkText = textInput ? textInput.value.trim() : '';
    var internal = select ? select.value : '';

    var finalUrl = internal ? internal : normalizeExternalUrl(url);
    if (!finalUrl) {
        alert('Please enter a URL or select an internal file.');
        return;
    }

    // Use saved range to restore selection
    if (savedNoteRange) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedNoteRange);
    }

    editor.focus();

    var displayText = linkText || finalUrl;

    // Handle internal links with a data-notmind attribute
    var isInternal = finalUrl.startsWith('note:') || finalUrl.startsWith('mindmap:');
    var openBoth = document.getElementById('noteHyperlinkOpenBoth');
    var shouldOpenBoth = !!(openBoth && openBoth.checked);
    var href = isInternal ? '#' : finalUrl;
    var linkHtml = '<a href="' + escapeHtml(href) + '" ' +
        (isInternal ? 'data-notmind="' + escapeHtml(finalUrl) + '" onclick="openNoteLink(event, this)"' : 'target="_blank" rel="noopener noreferrer"') +
        (shouldOpenBoth ? ' data-open-both="1"' : '') +
        ' style="color:var(--accent);text-decoration:underline;">' + escapeHtml(displayText) + '</a>';

    document.execCommand('insertHTML', false, linkHtml);

    if (currentNote) {
        currentNote.content = editor.innerHTML;
        triggerAutoSave();
    }

    closeNoteHyperlinkModal();
}

function openNoteLink(event, anchor) {
    event.preventDefault();
    var target = anchor.getAttribute('data-notmind');
    if (!target) {
        var href = anchor.getAttribute('href');
        if (!href) return;
        if (anchor.getAttribute('data-open-both') === '1') {
            window.open(href, '_blank', 'noopener,noreferrer');
        }
        window.location.href = href;
        return;
    }
    if (target.startsWith('note:')) {
        var noteId = target.split(':')[1];
        if (typeof notes !== 'undefined') {
            var found = null;
            for (var i = 0; i < notes.length; i++) {
                if (notes[i].id == noteId) { found = notes[i]; break; }
            }
            if (found) openNoteObj(found);
        }
    } else if (target.startsWith('mindmap:')) {
        var mmId = target.split(':')[1];
        if (typeof mindMaps !== 'undefined') {
            var mm = null;
            for (var j = 0; j < mindMaps.length; j++) {
                if (mindMaps[j].id == mmId) { mm = mindMaps[j]; break; }
            }
            if (mm) openMindMap(mm);
        }
    }
}

function initNoteLinkHandling() {
    editor.addEventListener('click', function(e) {
        var a = e.target.closest('a');
        if (!a || !editor.contains(a)) return;
        if (a.getAttribute('data-notmind')) {
            openNoteLink(e, a);
            return;
        }
        e.preventDefault();
        var href = a.getAttribute('href');
        if (!href) return;
        if (a.getAttribute('data-open-both') === '1') {
            window.open(href, '_blank', 'noopener,noreferrer');
        }
        window.open(href, '_blank', 'noopener,noreferrer');
    });
}

function ensureNotePages(note) {
    if (!note || !note.id) return;
    if (!notePagesById[note.id] || !notePagesById[note.id].length) {
        var raw = note.content || '<div><br></div>';
        var split = raw.split('<hr data-note-page="1" />');
        notePagesById[note.id] = split.length ? split : [raw];
    }
}

function renderNotePageTabs() {
    var tabs = document.getElementById('notePageTabs');
    if (!tabs || !currentNote) return;
    ensureNotePages(currentNote);
    var pages = notePagesById[currentNote.id];
    tabs.innerHTML = '';
    for (var i = 0; i < pages.length; i++) {
        var btn = document.createElement('button');
        btn.className = 'note-page-tab' + (i === currentNotePageIndex ? ' active' : '');
        btn.textContent = 'Page ' + (i + 1);
        btn.onclick = (function(idx) {
            return function() { switchNotePage(idx); };
        })(i);
        tabs.appendChild(btn);
    }
}

function switchNotePage(index) {
    if (!currentNote) return;
    ensureNotePages(currentNote);
    var pages = notePagesById[currentNote.id];
    if (index < 0 || index >= pages.length) return;
    pages[currentNotePageIndex] = editor.innerHTML;
    currentNotePageIndex = index;
    editor.innerHTML = pages[currentNotePageIndex] || '<div><br></div>';
    applyGridStyle();
    updateLineNumbers();
    renderNotePageTabs();
}

function createNotePage() {
    if (!currentNote) return;
    ensureNotePages(currentNote);
    var pages = notePagesById[currentNote.id];
    pages[currentNotePageIndex] = editor.innerHTML;
    pages.push('<div><br></div>');
    currentNotePageIndex = pages.length - 1;
    editor.innerHTML = pages[currentNotePageIndex];
    renderNotePageTabs();
    triggerAutoSave();
}

/* ==========================================
   SKETCH IN NOTE
   ========================================== */
function openSketchForNote() {
    if (typeof openSketchForNode === 'function') {
        // Reuse sketch for notes - set a note-specific callback
        if (typeof openSketchWithCallback === 'function') {
            openSketchWithCallback(function(dataURL) {
                if (!dataURL) return;
                editor.focus();
                var imgHtml = '<div style="text-align:center;margin:8px 0;"><img src="' + dataURL + '" style="max-width:100%;border-radius:8px;border:1px solid var(--border);" /></div>';
                document.execCommand('insertHTML', false, imgHtml);
                if (currentNote) {
                    currentNote.content = editor.innerHTML;
                    triggerAutoSave();
                }
                setTimeout(function() { updateLineNumbers();
                    applyGridStyle(); }, 20);
            });
        }
    }
}

/* ==========================================
   EXPORT NOTE AS IMAGE
   ========================================== */
function exportNoteAsImage() {
    if (!currentNote) return;
    var element = document.getElementById('lineEditor');
    if (!element) return;

    var originalTransform = element.style.transform;
    var originalOverflow = element.style.overflow;
    var originalWidth = element.style.width;
    element.style.transform = 'scale(1)';
    element.style.overflow = 'visible';
    element.style.width = '100%';

    var bgColor = getComputedStyle(document.body).getPropertyValue('--editor-bg');

    if (typeof html2canvas !== 'function') {
        alert('Export feature requires html2canvas library.');
        element.style.transform = originalTransform;
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        return;
    }

    html2canvas(element, { scale: 2, backgroundColor: bgColor, logging: false, useCORS: true })
        .then(function(canvas) {
            var link = document.createElement('a');
            link.download = currentNote.name + '.png';
            link.href = canvas.toDataURL();
            link.click();
            element.style.transform = originalTransform;
            element.style.overflow = originalOverflow;
            element.style.width = originalWidth;
        }).catch(function(error) {
            console.error('Export failed:', error);
            element.style.transform = originalTransform;
            element.style.overflow = originalOverflow;
            element.style.width = originalWidth;
            alert("Failed to export image. Please try again.");
        });
}

/* ==========================================
   ZOOM FUNCTIONALITY
   ========================================== */
function zoomNoteIn() {
    if (noteZoomLevel < 2) { noteZoomLevel += 0.1;
        applyNoteZoom(); }
}

function zoomNoteOut() {
    if (noteZoomLevel > 0.5) { noteZoomLevel -= 0.1;
        applyNoteZoom(); }
}

function resetNoteZoom() {
    noteZoomLevel = 1;
    applyNoteZoom();
}

function applyNoteZoom() {
    var editorContainer = document.querySelector('#noteDashboard .container');
    if (editorContainer) {
        editorContainer.style.transform = 'scale(' + noteZoomLevel + ')';
        editorContainer.style.transformOrigin = '0 0';
        editorContainer.style.width = (100 / noteZoomLevel) + '%';
        editorContainer.style.height = (100 / noteZoomLevel) + '%';
    }
    var zoomLevelSpan = document.getElementById('noteZoomLevel');
    if (zoomLevelSpan) zoomLevelSpan.textContent = Math.round(noteZoomLevel * 100) + '%';
    setTimeout(function() { updateLineNumbers(); }, 50);
}

/* ==========================================
   NOTE FUNCTIONS
   ========================================== */
function openNoteObj(n) {
    currentNote = n;
    document.getElementById("noteName").textContent = n.name;
    ensureNotePages(n);
    currentNotePageIndex = 0;
    editor.innerHTML = notePagesById[n.id][currentNotePageIndex] || n.content || '<div><br></div>';
    var fs = n.fontSize || 16;
    currentFontSz = fs;
    fontSizeInput.value = fs;
    currentFontFamily = n.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif";
    var fontFamilySelect = document.getElementById('fontFamilySelect');
    if (fontFamilySelect) fontFamilySelect.value = currentFontFamily;
    gridVisible = (n.gridVisible !== false);
    applyGridStyle();
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("noteDashboard").style.display = "flex";
    noteZoomLevel = 1;
    applyNoteZoom();
    setTimeout(function() {
        updateLineNumbers();
        editor.focus();
        applyGridStyle();
        updateToolbarActiveStates();
        renderNotePageTabs();
    }, 50);
}

function closeNote() {
    if (currentNote) {
        ensureNotePages(currentNote);
        notePagesById[currentNote.id][currentNotePageIndex] = editor.innerHTML;
        currentNote.content = notePagesById[currentNote.id].join('<hr data-note-page="1" />');
        currentNote.fontSize = currentFontSz;
        currentNote.fontFamily = currentFontFamily;
        currentNote.gridVisible = gridVisible;
        triggerAutoSave();
    }
    document.getElementById("noteDashboard").style.display = "none";
    document.getElementById("appContainer").style.display = "flex";
    render();
}

function saveNote() {
    if (currentNote) {
        ensureNotePages(currentNote);
        notePagesById[currentNote.id][currentNotePageIndex] = editor.innerHTML;
        currentNote.content = notePagesById[currentNote.id].join('<hr data-note-page="1" />');
        currentNote.fontSize = currentFontSz;
        currentNote.fontFamily = currentFontFamily;
        currentNote.gridVisible = gridVisible;
        if (currentWorkspaceRoot && currentNote.fileHandle) {
            saveNoteToFile(currentNote);
        }
        saveDataToLocalStorage();
        alert("Note saved!");
    }
}

initNoteLinkHandling();

async function deleteNote(id, e) {
    e.stopPropagation();
    if (confirm("Delete this note? This action cannot be undone.")) {
        await deletePhysicalFile(id, 'note');
        updateFileExplorer();
        render();
    }
}