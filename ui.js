// ui.js - UI functionality for Not Mind Application

async function promptNewFolder() {
    if (!currentWorkspaceRoot) {
        alert("Please open a folder first using the 📂 button in explorer");
        return;
    }

    var name = prompt("Folder name:");
    if (!name) return;

    var newFolder = await createPhysicalFolder(currentFolder, name);
    if (newFolder) {
        render();
        updateFileExplorer();
    }
}

function toggleCreateMenu() {
    var menu = document.getElementById("createMenu");
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', function(e) {
    var createMenu = document.getElementById("createMenu");
    var folderMenuEl = document.getElementById("folderMenu");
    var structureMenu = document.getElementById("structureMenu");
    var structureBtn = document.getElementById("structureBtn");

    if (createMenu && !createMenu.contains(e.target) && e.target !== document.getElementById("createBtn")) {
        createMenu.style.display = "none";
    }

    if (folderMenuEl && !folderMenuEl.contains(e.target)) {
        folderMenuEl.style.display = 'none';
    }

    if (structureMenu && structureBtn && !structureMenu.contains(e.target) && e.target !== structureBtn && !structureBtn.contains(e.target)) {
        structureMenu.classList.remove('show');
    }

    var sketchInsertMenu = document.getElementById('sketchInsertMenu');
    if (sketchInsertMenu && sketchInsertMenu.style.display === 'block' && !sketchInsertMenu.contains(e.target)) {
        sketchInsertMenu.style.display = 'none';
    }
});

var latestGeneratedLink = '';

function encodeSharePayload(payloadObj) {
    try {
        return btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))));
    } catch (e) {
        console.error('Failed to encode share payload:', e);
        return '';
    }
}

function decodeSharePayload(encoded) {
    try {
        return JSON.parse(decodeURIComponent(escape(atob(encoded))));
    } catch (e) {
        console.error('Failed to decode share payload:', e);
        return null;
    }
}

function upsertSharedNote(noteData) {
    if (!noteData || !noteData.id) return null;
    for (var i = 0; i < notes.length; i++) {
        if ((notes[i].id + '') === (noteData.id + '')) {
            notes[i] = Object.assign(notes[i], noteData);
            return notes[i];
        }
    }
    notes.push(noteData);
    return noteData;
}

function upsertSharedMindMap(mindMapData) {
    if (!mindMapData || !mindMapData.id) return null;
    for (var i = 0; i < mindMaps.length; i++) {
        if ((mindMaps[i].id + '') === (mindMapData.id + '')) {
            mindMaps[i] = Object.assign(mindMaps[i], mindMapData);
            return mindMaps[i];
        }
    }
    mindMaps.push(mindMapData);
    return mindMapData;
}

function openGenerateModal(type) {
    var modal = document.getElementById('generateModal');
    var input = document.getElementById('generatedShareLink');
    var qr = document.getElementById('generatedQrPreview');
    if (!modal || !input || !qr) return;
    var fileName = 'untitled';
    var shareId = '';
    if (type === 'note' && currentNote) {
        fileName = currentNote.name;
        shareId = currentNote.id;
    }
    if (type === 'mindmap' && currentMindMap) {
        fileName = currentMindMap.name;
        shareId = currentMindMap.id;
    }
    if (type === 'sketch') fileName = 'sketch-page';
    var payload = null;
    if (type === 'note' && currentNote) {
        payload = {
            type: 'note',
            note: {
                id: currentNote.id,
                name: currentNote.name,
                content: currentNote.content || '',
                parent: null,
                fontSize: currentNote.fontSize || 16,
                fontFamily: currentNote.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif",
                gridVisible: currentNote.gridVisible !== false
            }
        };
    } else if (type === 'mindmap' && currentMindMap) {
        payload = {
            type: 'mindmap',
            mindMap: JSON.parse(JSON.stringify(currentMindMap))
        };
    } else if (type === 'sketch') {
        payload = { type: 'sketch' };
    }

    var base = window.location.href.split('?')[0].split('#')[0];
    var link = base + '?shareType=' + encodeURIComponent(type) + '&shareName=' + encodeURIComponent(fileName) + (shareId !== '' ? '&shareId=' + encodeURIComponent(shareId) : '');
    if (payload) {
        var encodedPayload = encodeSharePayload(payload);
        if (encodedPayload) {
            link += '&data=' + encodeURIComponent(encodedPayload);
        }
    }
    latestGeneratedLink = link;
    input.value = link;
    qr.innerHTML = '<img alt="QR" style="width:130px;height:130px;" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(link) + '">';
    if (!/^https?:/i.test(base)) {
        alert('For other devices, open this app using a hosted URL (http/https). File path links are device-specific.');
    }
    modal.classList.add('show');
}

function closeGenerateModal() {
    var modal = document.getElementById('generateModal');
    if (modal) modal.classList.remove('show');
}

function openGeneratedLink() {
    var input = document.getElementById('generatedShareLink');
    var link = (input && input.value) ? input.value : latestGeneratedLink;
    if (!link) {
        alert('No generated link available.');
        return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
}

function copyGeneratedLink() {
    var input = document.getElementById('generatedShareLink');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(function() {
        alert('Link copied.');
    }).catch(function() {
        input.select();
        document.execCommand('copy');
        alert('Link copied.');
    });
}

var scannerStream = null;
var scannerInterval = null;

async function openScannerModal() {
    var modal = document.getElementById('scannerModal');
    var video = document.getElementById('scannerVideo');
    var manual = document.getElementById('scannerManualInput');
    if (!modal || !video) return;
    if (manual) manual.value = '';
    modal.classList.add('show');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });
        video.srcObject = scannerStream;

        if ('BarcodeDetector' in window) {
            var detector = new BarcodeDetector({ formats: ['qr_code'] });
            clearInterval(scannerInterval);
            scannerInterval = setInterval(async function() {
                if (!video.videoWidth || !video.videoHeight) return;
                try {
                    var barcodes = await detector.detect(video);
                    if (barcodes && barcodes.length && barcodes[0].rawValue) {
                        handleScannedValue(barcodes[0].rawValue);
                    }
                } catch (e) {}
            }, 600);
        }
    } catch (e) {
        console.error('Scanner start failed:', e);
    }
}

function closeScannerModal() {
    var modal = document.getElementById('scannerModal');
    var video = document.getElementById('scannerVideo');
    if (modal) modal.classList.remove('show');
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }
    if (scannerStream) {
        scannerStream.getTracks().forEach(function(t) { t.stop(); });
        scannerStream = null;
    }
    if (video) video.srcObject = null;
}

function submitScannerManualInput() {
    var input = document.getElementById('scannerManualInput');
    if (!input) return;
    var value = (input.value || '').trim();
    if (!value) {
        alert('Please enter a link.');
        return;
    }
    handleScannedValue(value);
}

function handleScannedValue(raw) {
    if (!raw) return;
    closeScannerModal();
    if (tryOpenSharedLink(raw)) return;
    var url = normalizeExternalUrl(raw);
    window.open(url, '_blank', 'noopener,noreferrer');
}

function tryOpenSharedLink(raw) {
    try {
        var u = new URL(raw, window.location.origin + window.location.pathname);
        var type = u.searchParams.get('shareType');
        var shareId = u.searchParams.get('shareId');
        var encodedPayload = u.searchParams.get('data');
        if (!type) return false;

        if (encodedPayload) {
            var decodedPayload = decodeSharePayload(encodedPayload);
            if (decodedPayload && decodedPayload.type === 'note' && decodedPayload.note) {
                var sharedNote = upsertSharedNote(decodedPayload.note);
                if (sharedNote) {
                    render();
                    openNoteObj(sharedNote);
                    saveDataToLocalStorage();
                    return true;
                }
            }
            if (decodedPayload && decodedPayload.type === 'mindmap' && decodedPayload.mindMap) {
                var sharedMindMap = upsertSharedMindMap(decodedPayload.mindMap);
                if (sharedMindMap) {
                    render();
                    openMindMap(sharedMindMap);
                    saveDataToLocalStorage();
                    return true;
                }
            }
            if (decodedPayload && decodedPayload.type === 'sketch') {
                openSketch();
                return true;
            }
        }

        if (type === 'note') {
            if (!shareId) return false;
            for (var i = 0; i < notes.length; i++) {
                if ((notes[i].id + '') === (shareId + '')) {
                    openNoteObj(notes[i]);
                    return true;
                }
            }
            alert('Shared note not found in current workspace.');
            return true;
        }

        if (type === 'mindmap') {
            if (!shareId) return false;
            for (var j = 0; j < mindMaps.length; j++) {
                if ((mindMaps[j].id + '') === (shareId + '')) {
                    openMindMap(mindMaps[j]);
                    return true;
                }
            }
            alert('Shared mind map not found in current workspace.');
            return true;
        }

        if (type === 'sketch') {
            openSketch();
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

function handleIncomingShareLink() {
    if (window.location.href.indexOf('shareType=') === -1) return;
    setTimeout(function() {
        tryOpenSharedLink(window.location.href);
    }, 200);
}

async function createItem(type) {
    if (!currentWorkspaceRoot) {
        alert("Please open a folder first using the 📂 button in explorer");
        return;
    }

    document.getElementById("createMenu").style.display = "none";
    var name = prompt(type === 'mindmap' ? "Mind Map name:" : "Note name:");
    if (!name) return;

    if (type === 'mindmap') {
        var newMindMap = await createPhysicalMindMap(currentFolder, name);
        if (newMindMap) {
            updateFileExplorer();
            openMindMap(newMindMap);
        }
    } else {
        var newNote = await createPhysicalNote(currentFolder, name);
        if (newNote) {
            updateFileExplorer();
            openNoteObj(newNote);
        }
    }
}

function buildBreadcrumb() {
    var bc = document.getElementById('breadcrumb');
    bc.innerHTML = '';
    var chain = [];
    var id = currentFolder;
    while (id !== null) {
        var f = null;
        for (var i = 0; i < folders.length; i++) {
            if (folders[i].id === id) {
                f = folders[i];
                break;
            }
        }
        if (!f) break;
        chain.unshift(f);
        id = f.parent;
    }
    var homeCrumb = document.createElement('button');
    homeCrumb.className = 'crumb' + (currentFolder === null ? ' active' : '');
    homeCrumb.textContent = '🏠 Home';
    homeCrumb.onclick = goHome;
    bc.appendChild(homeCrumb);

    for (var j = 0; j < chain.length; j++) {
        var sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        bc.appendChild(sep);
        var crumb = document.createElement('button');
        crumb.className = 'crumb' + (j === chain.length - 1 ? ' active' : '');
        crumb.textContent = chain[j].name;
        crumb.onclick = (function(folderId) {
            return function() {
                currentFolder = folderId;
                historyStack.push(currentFolder);
                render();
            };
        })(chain[j].id);
        bc.appendChild(crumb);
    }

    backBtn.style.display = historyStack.length ? 'inline-flex' : 'none';
}

function goHome() {
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
    }
    var homeBtn = document.querySelector('.nav-item:first-child');
    if (homeBtn) homeBtn.classList.add('active');
    currentFolder = null;
    historyStack = [];
    render();
}

function goBack() {
    if (historyStack.length > 1) {
        historyStack.pop();
        currentFolder = historyStack[historyStack.length - 1];
    } else {
        currentFolder = null;
        historyStack = [];
    }
    render();
}

function render() {
    buildBreadcrumb();
    foldersDiv.innerHTML = '';

    var filteredFolders = [];
    for (var i = 0; i < folders.length; i++) {
        if (folders[i].parent === currentFolder) {
            filteredFolders.push(folders[i]);
        }
    }
    if (searchQuery) {
        var temp = [];
        for (var j = 0; j < filteredFolders.length; j++) {
            if (matchesSearch(filteredFolders[j].name)) {
                temp.push(filteredFolders[j]);
            }
        }
        filteredFolders = temp;
    }
    for (var k = 0; k < filteredFolders.length; k++) {
        foldersDiv.appendChild(buildFolderItem(filteredFolders[k]));
    }

    var filteredNotes = [];
    for (var l = 0; l < notes.length; l++) {
        if (notes[l].parent === currentFolder) {
            filteredNotes.push(notes[l]);
        }
    }
    if (searchQuery) {
        var temp2 = [];
        for (var m = 0; m < filteredNotes.length; m++) {
            if (matchesSearch(filteredNotes[m].name)) {
                temp2.push(filteredNotes[m]);
            }
        }
        filteredNotes = temp2;
    }
    for (var n = 0; n < filteredNotes.length; n++) {
        foldersDiv.appendChild(buildNoteItem(filteredNotes[n]));
    }

    var filteredMindMaps = [];
    for (var o = 0; o < mindMaps.length; o++) {
        if (mindMaps[o].parent === currentFolder) {
            filteredMindMaps.push(mindMaps[o]);
        }
    }
    if (searchQuery) {
        var temp3 = [];
        for (var p = 0; p < filteredMindMaps.length; p++) {
            if (matchesSearch(filteredMindMaps[p].name)) {
                temp3.push(filteredMindMaps[p]);
            }
        }
        filteredMindMaps = temp3;
    }
    for (var q = 0; q < filteredMindMaps.length; q++) {
        foldersDiv.appendChild(buildMindMapItem(filteredMindMaps[q]));
    }

    if (searchQuery && filteredFolders.length === 0 && filteredNotes.length === 0 && filteredMindMaps.length === 0) {
        var noResults = document.createElement('div');
        noResults.className = 'folder';
        noResults.style.cursor = 'default';
        noResults.style.justifyContent = 'center';
        noResults.style.opacity = '0.6';
        noResults.textContent = '🔍 No matching items found';
        foldersDiv.appendChild(noResults);
    }

    createBtn.style.display = currentFolder !== null ? 'flex' : 'none';
}

function buildFolderItem(f) {
    var div = document.createElement('div');
    div.className = 'folder';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'item-icon';
    iconSpan.textContent = '📁';
    div.appendChild(iconSpan);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = f.name;
    div.appendChild(nameSpan);

    var favStar = document.createElement('span');
    favStar.textContent = isFavorite(f.id) ? '⭐' : '☆';
    favStar.style.marginRight = '8px';
    favStar.style.cursor = 'pointer';
    favStar.onclick = function(e, folderId) {
        e.stopPropagation();
        toggleFavorite(folderId);
    }.bind(null, null, f.id);
    div.appendChild(favStar);

    div.onclick = function() {
        currentFolder = f.id;
        historyStack.push(currentFolder);
        render();
    };
    div.oncontextmenu = function(e) {
        e.preventDefault();
        contextFolderId = f.id;
        folderMenu.style.left = e.pageX + 'px';
        folderMenu.style.top = e.pageY + 'px';
        folderMenu.style.display = 'block';
    };
    return div;
}

function buildNoteItem(n) {
    var div = document.createElement('div');
    div.className = 'folder';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'item-icon';
    iconSpan.textContent = '📄';
    div.appendChild(iconSpan);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = n.name;
    div.appendChild(nameSpan);

    var favStar = document.createElement('span');
    favStar.textContent = isFavorite(n.id) ? '⭐' : '☆';
    favStar.style.marginRight = '8px';
    favStar.style.cursor = 'pointer';
    favStar.onclick = function(e, noteId) {
        e.stopPropagation();
        toggleFavorite(noteId);
    }.bind(null, null, n.id);
    div.appendChild(favStar);

    var delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.onclick = function(e, noteId) {
        deleteNote(noteId, e);
    }.bind(null, null, n.id);
    div.appendChild(delBtn);

    div.onclick = function(e) {
        if (e.target !== delBtn && e.target !== favStar) {
            openNoteObj(n);
        }
    };
    return div;
}

function buildMindMapItem(m) {
    var div = document.createElement('div');
    div.className = 'folder';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'item-icon';
    iconSpan.textContent = '🧠';
    div.appendChild(iconSpan);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = m.name;
    div.appendChild(nameSpan);

    var favStar = document.createElement('span');
    favStar.textContent = isFavorite(m.id) ? '⭐' : '☆';
    favStar.style.marginRight = '8px';
    favStar.style.cursor = 'pointer';
    favStar.onclick = function(e, mindMapId) {
        e.stopPropagation();
        toggleFavorite(mindMapId);
    }.bind(null, null, m.id);
    div.appendChild(favStar);

    var delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.onclick = function(e, mindMapId) {
        deleteMindMap(mindMapId, e);
    }.bind(null, null, m.id);
    div.appendChild(delBtn);

    div.onclick = function(e) {
        if (e.target !== delBtn && e.target !== favStar) {
            openMindMap(m);
        }
    };
    return div;
}

async function deleteNote(noteId, e) {
    e.stopPropagation();
    if (confirm("Delete this note? This action cannot be undone.")) {
        await deletePhysicalFile(noteId, 'note');
        updateFileExplorer();
        render();
    }
}

function renderFavorites() {
    foldersDiv.innerHTML = '';

    var favoriteFolders = [];
    for (var i = 0; i < folders.length; i++) {
        if (favorites.indexOf(folders[i].id) !== -1) {
            favoriteFolders.push(folders[i]);
        }
    }
    var favoriteNotes = [];
    for (var j = 0; j < notes.length; j++) {
        if (favorites.indexOf(notes[j].id) !== -1) {
            favoriteNotes.push(notes[j]);
        }
    }
    var favoriteMindMaps = [];
    for (var k = 0; k < mindMaps.length; k++) {
        if (favorites.indexOf(mindMaps[k].id) !== -1) {
            favoriteMindMaps.push(mindMaps[k]);
        }
    }

    if (searchQuery) {
        var tempF = [];
        for (var l = 0; l < favoriteFolders.length; l++) {
            if (favoriteFolders[l].name.toLowerCase().indexOf(searchQuery) !== -1) {
                tempF.push(favoriteFolders[l]);
            }
        }
        favoriteFolders = tempF;

        var tempN = [];
        for (var m = 0; m < favoriteNotes.length; m++) {
            if (favoriteNotes[m].name.toLowerCase().indexOf(searchQuery) !== -1) {
                tempN.push(favoriteNotes[m]);
            }
        }
        favoriteNotes = tempN;

        var tempM = [];
        for (var n = 0; n < favoriteMindMaps.length; n++) {
            if (favoriteMindMaps[n].name.toLowerCase().indexOf(searchQuery) !== -1) {
                tempM.push(favoriteMindMaps[n]);
            }
        }
        favoriteMindMaps = tempM;
    }

    if (favoriteFolders.length === 0 && favoriteNotes.length === 0 && favoriteMindMaps.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'folder';
        emptyDiv.style.cursor = 'default';
        emptyDiv.style.justifyContent = 'center';
        emptyDiv.style.opacity = '0.6';
        emptyDiv.innerHTML = searchQuery ? '🔍 No matching favorites found' : '⭐ No favorites yet. Click the ☆ star on any item to add to favorites.';
        foldersDiv.appendChild(emptyDiv);
        return;
    }

    for (var o = 0; o < favoriteFolders.length; o++) {
        foldersDiv.appendChild(buildFolderItem(favoriteFolders[o]));
    }
    for (var p = 0; p < favoriteNotes.length; p++) {
        foldersDiv.appendChild(buildNoteItem(favoriteNotes[p]));
    }
    for (var q = 0; q < favoriteMindMaps.length; q++) {
        foldersDiv.appendChild(buildMindMapItem(favoriteMindMaps[q]));
    }

    buildBreadcrumb();
    backBtn.style.display = 'none';
}

function renameFolder() {
    if (!contextFolderId) return;
    var f = null;
    for (var i = 0; i < folders.length; i++) {
        if (folders[i].id === contextFolderId) {
            f = folders[i];
            break;
        }
    }
    if (!f) return;
    var name = prompt("Rename folder:", f.name);
    if (!name) return;
    f.name = name;
    saveDataToLocalStorage();
    updateFileExplorer();
    render();
}

async function deleteFolder() {
    if (!contextFolderId) return;
    await deletePhysicalFolder(contextFolderId);
    contextFolderId = null;
}

function openHelp() {
    document.getElementById('shortcutModal').classList.add('show');
}

function closeHelp() {
    document.getElementById('shortcutModal').classList.remove('show');
}

// Event Listeners
var favoritesBtn = document.getElementById('favoritesBtn');
if (favoritesBtn) {
    favoritesBtn.onclick = function() {
        var navBtns = document.querySelectorAll('.nav-item');
        for (var i = 0; i < navBtns.length; i++) {
            navBtns[i].classList.remove('active');
        }
        favoritesBtn.classList.add('active');
        showFavorites();
    };
}

var openFolderBtn = document.getElementById('openFolderBtn');
if (openFolderBtn) {
    openFolderBtn.onclick = openFolder;
}

render();
applyGridStyle();
updateFileExplorer();

var saveNoteAsBtn = document.getElementById('saveNoteAsBtn');
if (saveNoteAsBtn) {
    saveNoteAsBtn.onclick = saveNoteAs;
}

var saveMindMapAsBtn = document.getElementById('saveMindMapAsBtn');
if (saveMindMapAsBtn) {
    saveMindMapAsBtn.onclick = saveMindMapAs;
}

var exportNoteImgBtn = document.getElementById('exportNoteImgBtn');
if (exportNoteImgBtn) {
    exportNoteImgBtn.onclick = exportNoteAsImage;
}

handleIncomingShareLink();