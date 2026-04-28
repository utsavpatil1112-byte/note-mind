// core.js - Core functionality for Not Mind Application

function hideLoading() {
    var el = document.getElementById('loading');
    if (!el || el.style.display === 'none') return;
    el.classList.add('hidden');
    setTimeout(function() {
        el.style.display = 'none';
    }, 450);
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(hideLoading, 800);
    initRootFolderDisplay();
});
setTimeout(hideLoading, 1200);

// State Management
var folders = [];
var notes = [];
var mindMaps = [];
var favorites = [];
var currentFolder = null;
var historyStack = [];
var currentNote = null;
var currentMindMap = null;
var contextFolderId = null;
var searchQuery = "";
var currentStructure = 'radial';
var selectedNodeId = null;
var selectedSubNodeId = null;
var autoSaveEnabled = false;
var currentWorkspaceRoot = null;
var folderHandleMap = new Map();
var fileHandleMap = new Map();

// Zoom state
var noteZoomLevel = 1;
var mindMapZoomLevel = 1;

// DOM Elements
var editor = document.getElementById("lineEditor");
var lineNumbers = document.getElementById("lineNumbers");
var foldersDiv = document.getElementById("folders");
var createBtn = document.getElementById("createBtn");
var backBtn = document.getElementById("backBtn");
var folderMenu = document.getElementById("folderMenu");
var fontSizeInput = document.getElementById("fontSizeInput");
var gridToggleBtn = document.getElementById("gridToggleBtn");
var autoSaveToggle = document.getElementById("autoSaveToggle");

function initRootFolderDisplay() {
    var homeBtn = document.querySelector('.nav-item:first-child');
    if (homeBtn && !homeBtn.classList.contains('active')) {
        homeBtn.classList.add('active');
    }
}

// LocalStorage Persistence
function saveDataToLocalStorage() {
    var data = {
        folders: folders.map(function(f) { return { id: f.id, name: f.name, parent: f.parent, path: f.path }; }),
        notes: notes.map(function(n) { 
            var noteData = { id: n.id, name: n.name, parent: n.parent, fontSize: n.fontSize, fontFamily: n.fontFamily, gridVisible: n.gridVisible, filePath: n.filePath };
            if (n.isLocalOnly) {
                noteData.isLocalOnly = true;
                noteData.content = n.content;
            }
            return noteData;
        }),
        mindMaps: mindMaps.map(function(m) { 
            var mapData = { id: m.id, name: m.name, parent: m.parent, structure: m.structure, filePath: m.filePath };
            if (m.isLocalOnly) {
                mapData.isLocalOnly = true;
                mapData.nodes = m.nodes;
                mapData.subNodes = m.subNodes;
                mapData.nodeAttachments = m.nodeAttachments;
                mapData.centerAttachments = m.centerAttachments;
            }
            return mapData;
        }),
        favorites: favorites,
        currentStructure: currentStructure
    };
    localStorage.setItem('notmind-data', JSON.stringify(data));
}

function loadDataFromLocalStorage() {
    var savedData = localStorage.getItem('notmind-data');
    if (savedData) {
        try {
            var data = JSON.parse(savedData);
            favorites = data.favorites || [];
            currentStructure = data.currentStructure || 'radial';
            
            // Restore local-only folders
            if (data.folders) {
                for (var h = 0; h < data.folders.length; h++) {
                    var folderData = data.folders[h];
                    if (!folders.find(function(f) { return f.id == folderData.id; })) {
                        folders.push({
                            id: folderData.id,
                            name: folderData.name,
                            parent: folderData.parent,
                            path: folderData.path || '',
                            isLocalOnly: true
                        });
                    }
                }
            }

            // Restore local-only notes and mindmaps
            if (data.notes) {
                for (var i = 0; i < data.notes.length; i++) {
                    var noteData = data.notes[i];
                    if (noteData.isLocalOnly && !notes.find(function(n) { return n.id === noteData.id; })) {
                        notes.push({
                            id: noteData.id,
                            name: noteData.name,
                            content: noteData.content || "<div><br></div>",
                            parent: noteData.parent,
                            fontSize: noteData.fontSize || 16,
                            fontFamily: noteData.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif",
                            gridVisible: noteData.gridVisible !== false,
                            isLocalOnly: true
                        });
                    }
                }
            }
            
            if (data.mindMaps) {
                for (var j = 0; j < data.mindMaps.length; j++) {
                    var mapData = data.mindMaps[j];
                    if (mapData.isLocalOnly && !mindMaps.find(function(m) { return m.id === mapData.id; })) {
                        mindMaps.push({
                            id: mapData.id,
                            name: mapData.name,
                            parent: mapData.parent,
                            structure: mapData.structure || 'radial',
                            nodes: mapData.nodes || [],
                            subNodes: mapData.subNodes || {},
                            nodeAttachments: mapData.nodeAttachments || {},
                            centerAttachments: mapData.centerAttachments || [],
                            isLocalOnly: true
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load saved data', e);
        }
    }
}

// Auto-Save
function initAutoSave() {
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', function(e) {
            autoSaveEnabled = e.target.checked;
            localStorage.setItem('notmind-autosave', autoSaveEnabled);
        });

        var savedAutoSave = localStorage.getItem('notmind-autosave');
        if (savedAutoSave === 'true') {
            autoSaveEnabled = true;
            autoSaveToggle.checked = true;
        }
    }
}

function triggerAutoSave() {
    if (autoSaveEnabled) {
        if (currentNote) {
            saveNoteToFile(currentNote);
        } else if (currentMindMap) {
            saveMindMapToFile(currentMindMap);
        }
    }
    saveDataToLocalStorage();
}

// Theme Management
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('notmind-theme', theme);

    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        if (btn.getAttribute('data-theme') === theme) {
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '';
            btn.style.color = '';
        }
    });

    if (currentNote) {
        applyGridStyle();
        updateLineNumbers();
    }
}

function loadTheme() {
    var savedTheme = localStorage.getItem('notmind-theme') || 'dark';
    setTheme(savedTheme);
}

// Favorites Management
function showFavorites() {
    searchQuery = "";
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = "";
    renderFavorites();
}

function addToFavorites() {
    if (!contextFolderId) return;
    if (!favorites.includes(contextFolderId)) {
        favorites.push(contextFolderId);
        saveDataToLocalStorage();
        alert('Added to favorites!');
    }
    contextFolderId = null;
}

function isFavorite(id) {
    return favorites.indexOf(id) !== -1;
}

function toggleFavorite(id) {
    var index = favorites.indexOf(id);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(id);
    }
    saveDataToLocalStorage();
    render();
}

// Search Functionality
function handleSearch(query) {
    searchQuery = query.toLowerCase().trim();
    var favoritesBtn = document.getElementById('favoritesBtn');
    var isFavoritesView = favoritesBtn && favoritesBtn.classList.contains('active');
    if (isFavoritesView) {
        renderFavorites();
    } else {
        render();
    }
}

function matchesSearch(itemName) {
    if (!searchQuery) return true;
    return itemName.toLowerCase().indexOf(searchQuery) !== -1;
}

// Utility Functions
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeExternalUrl(url) {
    if (!url) return '';
    var trimmed = (url + '').trim();
    if (!trimmed) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
}

// Initialization
loadTheme();
loadDataFromLocalStorage();
initAutoSave();