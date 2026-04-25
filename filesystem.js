// filesystem.js - File system integration for Not Mind Application

var isFileSystemSupported = 'showDirectoryPicker' in window && window.isSecureContext;

// Open Folder Dialog
async function openFolder() {
    if (!('showDirectoryPicker' in window)) {
        alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.");
        return;
    }

    if (!window.isSecureContext) {
        alert("File system access requires HTTPS or localhost. Please open the app over a secure connection.");
        return;
    }

    try {
        const dirHandle = await window.showDirectoryPicker();
        currentWorkspaceRoot = dirHandle;

        folders = [];
        notes = [];
        mindMaps = [];
        folderHandleMap.clear();
        fileHandleMap.clear();

        await loadWorkspaceFromDirectory(dirHandle);
        updateFileExplorer();
        render();
    } catch (err) {
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
            alert('Folder access was cancelled or denied. Please grant permission to use file system features.');
        } else {
            console.log("User cancelled or error:", err);
        }
    }
}

// Load entire workspace from directory
async function loadWorkspaceFromDirectory(dirHandle, parentId = null, parentPath = '') {
    try {
        const entries = [];
        const iterator = dirHandle.values();

        for await (const entry of iterator) {
            entries.push(entry);
        }

        for (const entry of entries) {
            if (entry.kind === 'directory') {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

                const folderId = Date.now() + Math.random();
                const folderPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

                const folder = {
                    id: folderId,
                    name: entry.name,
                    parent: parentId,
                    path: folderPath,
                    handle: entry
                };

                folders.push(folder);
                folderHandleMap.set(folderId, entry);

                await loadWorkspaceFromDirectory(entry, folderId, folderPath);
            }
        }

        for (const entry of entries) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const file = await entry.getFile();
                const content = await file.text();

                try {
                    const data = JSON.parse(content);

                    if (data.type === 'note') {
                        const noteId = Date.now() + Math.random();
                        const note = {
                            id: noteId,
                            name: data.name || entry.name.replace('.json', ''),
                            content: data.content || "<div><br></div>",
                            parent: parentId,
                            fontSize: data.fontSize || 16,
                            fontFamily: data.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif",
                            gridVisible: data.gridVisible !== false,
                            fileHandle: entry,
                            filePath: entry.name,
                            path: parentPath ? `${parentPath}/${entry.name}` : entry.name
                        };
                        notes.push(note);
                        fileHandleMap.set(noteId, entry);
                    } else if (data.type === 'mindmap') {
                        const mindMapId = Date.now() + Math.random();
                        const mindMap = {
                            id: mindMapId,
                            name: data.name || entry.name.replace('.json', ''),
                            type: 'mindmap',
                            parent: parentId,
                            structure: data.structure || 'radial',
                            nodes: data.nodes || [],
                            subNodes: data.subNodes || {},
                            nodeAttachments: data.nodeAttachments || {},
                            centerAttachments: data.centerAttachments || [],
                            fileHandle: entry,
                            filePath: entry.name,
                            path: parentPath ? `${parentPath}/${entry.name}` : entry.name
                        };
                        mindMaps.push(mindMap);
                        fileHandleMap.set(mindMapId, entry);
                    }
                } catch (e) {
                    console.error("Error parsing file:", entry.name, e);
                }
            }
        }

        saveDataToLocalStorage();

    } catch (err) {
        console.error("Error loading workspace:", err);
    }
}

// Update file explorer sidebar
function updateFileExplorer() {
    var explorer = document.getElementById('fileExplorer');
    if (!explorer) return;

    if (!currentWorkspaceRoot) {
        explorer.innerHTML = '<div class="file-tree-item" style="justify-content:center;opacity:0.6;">📂 No folder opened<br>Click 📂 to open a folder</div>';
        return;
    }

    var rootName = currentWorkspaceRoot.name || 'Workspace Root';

    var html = `<div class="file-tree-item folder root-folder" onclick="openRootFolder()">`;
    html += `📁 ${escapeHtml(rootName)}`;
    html += `</div>`;

    function buildTree(parentId = null, indent = 1) {
        var childrenHtml = '';
        var folderItems = folders.filter(function(f) { return f.parent === parentId; });
        var noteItems = notes.filter(function(n) { return n.parent === parentId; });
        var mindMapItems = mindMaps.filter(function(m) { return m.parent === parentId; });

        for (var i = 0; i < folderItems.length; i++) {
            var folder = folderItems[i];
            childrenHtml += `<div class="file-tree-item folder" style="padding-left: ${indent * 16}px" onclick="openFolderFromExplorer('${folder.id}')">`;
            childrenHtml += `📁 ${escapeHtml(folder.name)}`;
            childrenHtml += `</div>`;
            childrenHtml += buildTree(folder.id, indent + 1);
        }

        for (var j = 0; j < noteItems.length; j++) {
            var note = noteItems[j];
            childrenHtml += `<div class="file-tree-item note" style="padding-left: ${indent * 16 + 8}px" onclick="openNoteFromExplorer('${note.id}')">`;
            childrenHtml += `📄 ${escapeHtml(note.name)}`;
            childrenHtml += `</div>`;
        }

        for (var k = 0; k < mindMapItems.length; k++) {
            var mindMap = mindMapItems[k];
            childrenHtml += `<div class="file-tree-item mindmap" style="padding-left: ${indent * 16 + 8}px" onclick="openMindMapFromExplorer('${mindMap.id}')">`;
            childrenHtml += `🧠 ${escapeHtml(mindMap.name)}`;
            childrenHtml += `</div>`;
        }

        return childrenHtml;
    }

    explorer.innerHTML = html + buildTree();
}

function openRootFolder() {
    currentFolder = null;
    historyStack = [];
    render();
}

function openFolderFromExplorer(folderId) {
    currentFolder = folderId;
    historyStack.push(currentFolder);
    render();
}

function openNoteFromExplorer(noteId) {
    var note = notes.find(function(n) { return n.id == noteId; });
    if (note) {
        openNoteObj(note);
    }
}

function openMindMapFromExplorer(mindMapId) {
    var mindMap = mindMaps.find(function(m) { return m.id == mindMapId; });
    if (mindMap) {
        openMindMap(mindMap);
    }
}

// Create physical folder
async function createPhysicalFolder(parentFolderId, folderName) {
    if (!currentWorkspaceRoot) {
        alert("Please open a folder first using the 📂 button in explorer");
        return null;
    }

    try {
        var targetHandle = currentWorkspaceRoot;

        if (parentFolderId) {
            var parentFolder = folders.find(function(f) { return f.id === parentFolderId; });
            if (parentFolder && parentFolder.handle) {
                targetHandle = parentFolder.handle;
            }
        }

        var newFolderHandle = await targetHandle.getDirectoryHandle(folderName, { create: true });

        var newFolder = {
            id: Date.now(),
            name: folderName,
            parent: parentFolderId,
            path: parentFolderId ? (folders.find(function(f) { return f.id === parentFolderId; }).path + '/' + folderName) : folderName,
            handle: newFolderHandle
        };

        folders.push(newFolder);
        folderHandleMap.set(newFolder.id, newFolderHandle);
        saveDataToLocalStorage();

        return newFolder;
    } catch (err) {
        console.error("Error creating folder:", err);
        if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
            alert('Folder creation was denied. Please grant permission to create folders.');
        } else {
            alert("Failed to create folder: " + err.message);
        }
        return null;
    }
}

// Delete physical folder
async function deletePhysicalFolder(folderId) {
    var folder = folders.find(function(f) { return f.id === folderId; });
    if (!folder || !folder.handle) {
        alert("Folder not found or already deleted");
        return false;
    }

    if (!confirm("Delete folder \"" + folder.name + "\" and all its contents? This cannot be undone.")) {
        return false;
    }

    try {
        var parentHandle = currentWorkspaceRoot;
        if (folder.parent) {
            var parentFolder = folders.find(function(f) { return f.id === folder.parent; });
            if (parentFolder && parentFolder.handle) {
                parentHandle = parentFolder.handle;
            }
        }

        await parentHandle.removeEntry(folder.name, { recursive: true });

        var childFolders = folders.filter(function(f) { return f.parent === folderId; });
        for (var i = 0; i < childFolders.length; i++) {
            folders = folders.filter(function(f) { return f.id !== childFolders[i].id; });
            folderHandleMap.delete(childFolders[i].id);
        }

        var folderNotes = notes.filter(function(n) { return n.parent === folderId; });
        for (var j = 0; j < folderNotes.length; j++) {
            notes = notes.filter(function(n) { return n.id !== folderNotes[j].id; });
            fileHandleMap.delete(folderNotes[j].id);
            favorites = favorites.filter(function(id) { return id !== folderNotes[j].id; });
        }

        var folderMindMaps = mindMaps.filter(function(m) { return m.parent === folderId; });
        for (var k = 0; k < folderMindMaps.length; k++) {
            mindMaps = mindMaps.filter(function(m) { return m.id !== folderMindMaps[k].id; });
            fileHandleMap.delete(folderMindMaps[k].id);
            favorites = favorites.filter(function(id) { return id !== folderMindMaps[k].id; });
        }

        folders = folders.filter(function(f) { return f.id !== folderId; });
        folderHandleMap.delete(folderId);
        favorites = favorites.filter(function(id) { return id !== folderId; });

        if (currentFolder === folderId) {
            currentFolder = null;
            historyStack = [];
        }

        saveDataToLocalStorage();
        render();
        updateFileExplorer();

        return true;
    } catch (err) {
        console.error("Error deleting folder:", err);
        alert("Failed to delete folder: " + err.message);
        return false;
    }
}

// Create physical note file
async function createPhysicalNote(parentFolderId, noteName, content) {
    if (content === undefined) content = "<div><br></div>";

    if (!currentWorkspaceRoot) {
        alert("Please open a folder first using the 📂 button in explorer");
        return null;
    }

    try {
        var targetHandle = currentWorkspaceRoot;

        if (parentFolderId) {
            var parentFolder = folders.find(function(f) { return f.id === parentFolderId; });
            if (parentFolder && parentFolder.handle) {
                targetHandle = parentFolder.handle;
            }
        }

        var fileName = noteName + '.json';
        var fileHandle = await targetHandle.getFileHandle(fileName, { create: true });
        var writable = await fileHandle.createWritable();

        var noteData = {
            type: 'note',
            name: noteName,
            content: content,
            fontSize: 16,
            fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
            gridVisible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await writable.write(JSON.stringify(noteData, null, 2));
        await writable.close();

        var newNote = {
            id: Date.now(),
            name: noteName,
            content: content,
            parent: parentFolderId,
            fontSize: 16,
            fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
            gridVisible: true,
            fileHandle: fileHandle,
            filePath: fileName
        };

        notes.push(newNote);
        fileHandleMap.set(newNote.id, fileHandle);
        saveDataToLocalStorage();

        return newNote;
    } catch (err) {
        console.error("Error creating note:", err);
        if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
            alert('Note creation was denied. Please grant permission to save notes.');
        } else {
            alert("Failed to create note: " + err.message);
        }
        return null;
    }
}

// Create physical mind map file
async function createPhysicalMindMap(parentFolderId, mindMapName) {
    if (!currentWorkspaceRoot) {
        alert("Please open a folder first using the 📂 button in explorer");
        return null;
    }

    try {
        var targetHandle = currentWorkspaceRoot;

        if (parentFolderId) {
            var parentFolder = folders.find(function(f) { return f.id === parentFolderId; });
            if (parentFolder && parentFolder.handle) {
                targetHandle = parentFolder.handle;
            }
        }

        var canvas = document.getElementById('mindMapCanvas');
        var canvasRect = canvas.getBoundingClientRect();
        var centerX = canvasRect.width / 2;
        var centerY = canvasRect.height / 2;

        var fileName = mindMapName + '.json';
        var fileHandle = await targetHandle.getFileHandle(fileName, { create: true });
        var writable = await fileHandle.createWritable();

        var mindMapData = {
            type: 'mindmap',
            name: mindMapName,
            structure: 'radial',
            nodes: [
                { id: 'center', text: mindMapName, x: centerX, y: centerY, isCenter: true }
            ],
            subNodes: {},
            nodeAttachments: {},
            centerAttachments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await writable.write(JSON.stringify(mindMapData, null, 2));
        await writable.close();

        var newMindMap = {
            id: Date.now(),
            name: mindMapName,
            type: 'mindmap',
            parent: parentFolderId,
            structure: 'radial',
            nodes: mindMapData.nodes,
            subNodes: mindMapData.subNodes || {},
            nodeAttachments: mindMapData.nodeAttachments || {},
            centerAttachments: mindMapData.centerAttachments || [],
            fileHandle: fileHandle,
            filePath: fileName
        };

        mindMaps.push(newMindMap);
        fileHandleMap.set(newMindMap.id, fileHandle);
        saveDataToLocalStorage();

        return newMindMap;
    } catch (err) {
        console.error("Error creating mind map:", err);
        if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
            alert('Mind map creation was denied. Please grant permission to save mind maps.');
        } else {
            alert("Failed to create mind map: " + err.message);
        }
        return null;
    }
}

// Save note to file
async function saveNoteToFile(note) {
    if (!currentWorkspaceRoot || !note.fileHandle) {
        return false;
    }

    try {
        var writable = await note.fileHandle.createWritable();
        var noteData = {
            type: 'note',
            name: note.name,
            content: note.content,
            fontSize: note.fontSize,
            fontFamily: note.fontFamily,
            gridVisible: note.gridVisible,
            createdAt: note.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await writable.write(JSON.stringify(noteData, null, 2));
        await writable.close();
        return true;
    } catch (err) {
        console.error("Error saving note:", err);
        return false;
    }
}

// Save mind map to file
async function saveMindMapToFile(mindMap) {
    if (!currentWorkspaceRoot || !mindMap.fileHandle) {
        return false;
    }

    try {
        var writable = await mindMap.fileHandle.createWritable();
        var mindMapData = {
            type: 'mindmap',
            name: mindMap.name,
            structure: mindMap.structure,
            nodes: mindMap.nodes,
            subNodes: mindMap.subNodes || {},
            nodeAttachments: mindMap.nodeAttachments || {},
            centerAttachments: mindMap.centerAttachments || [],
            createdAt: mindMap.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await writable.write(JSON.stringify(mindMapData, null, 2));
        await writable.close();
        return true;
    } catch (err) {
        console.error("Error saving mind map:", err);
        return false;
    }
}

// Delete physical file
async function deletePhysicalFile(fileId, type) {
    var fileItem;
    if (type === 'note') {
        fileItem = notes.find(function(n) { return n.id === fileId; });
    } else {
        fileItem = mindMaps.find(function(m) { return m.id === fileId; });
    }

    if (!fileItem || !fileItem.fileHandle) {
        return false;
    }

    try {
        var parentHandle = currentWorkspaceRoot;
        if (fileItem.parent) {
            var parentFolder = folders.find(function(f) { return f.id === fileItem.parent; });
            if (parentFolder && parentFolder.handle) {
                parentHandle = parentFolder.handle;
            }
        }

        await parentHandle.removeEntry(fileItem.filePath);

        if (type === 'note') {
            notes = notes.filter(function(n) { return n.id !== fileId; });
        } else {
            mindMaps = mindMaps.filter(function(m) { return m.id !== fileId; });
        }

        fileHandleMap.delete(fileId);
        favorites = favorites.filter(function(id) { return id !== fileId; });
        saveDataToLocalStorage();

        return true;
    } catch (err) {
        console.error("Error deleting file:", err);
        return false;
    }
}

// Save As functionality
async function saveNoteAs() {
    if (!currentNote) return;

    if (!window.isSecureContext) {
        alert('Save As requires HTTPS or localhost. Please run the app in a secure context.');
        return;
    }

    try {
        var handle = await window.showSaveFilePicker({
            suggestedName: currentNote.name + '.json',
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }]
        });

        currentNote.fileHandle = handle;
        currentNote.filePath = handle.name;
        await saveNoteToFile(currentNote);
        alert("Note saved as: " + handle.name);

        var newName = handle.name.replace('.json', '');
        currentNote.name = newName;
        document.getElementById("noteName").textContent = newName;
        saveDataToLocalStorage();
        render();
        updateFileExplorer();
    } catch (err) {
        console.log("Save cancelled or error:", err);
    }
}

async function saveMindMapAs() {
    if (!currentMindMap) return;

    if (!window.isSecureContext) {
        alert('Save As requires HTTPS or localhost. Please run the app in a secure context.');
        return;
    }

    try {
        var handle = await window.showSaveFilePicker({
            suggestedName: currentMindMap.name + '.json',
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }]
        });

        currentMindMap.fileHandle = handle;
        currentMindMap.filePath = handle.name;
        await saveMindMapToFile(currentMindMap);
        alert("Mind Map saved as: " + handle.name);

        var newName = handle.name.replace('.json', '');
        currentMindMap.name = newName;
        document.getElementById("mindMapName").textContent = newName;
        saveDataToLocalStorage();
        render();
        updateFileExplorer();
    } catch (err) {
        console.log("Save cancelled or error:", err);
    }
}