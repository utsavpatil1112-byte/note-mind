// mindmaps.js - Complete Mind Map functionality (Dynamic connections)

// ─── Canvas constants ─────────────────────────────────────────────────────────
var CNW_HALF = 40;
var CNH_HALF = 20;
var NW_HALF  = 40;
var NH_HALF  = 20;
var SN_W_HALF = 40;
var SN_H_HALF = 20;

// ─── Export ───────────────────────────────────────────────────────────────────
function exportMindMap() {
    var element = document.getElementById('mindMapCanvas');
    if (!element) return;
    if (typeof html2canvas !== 'function') {
        alert('Export feature requires html2canvas library.');
        return;
    }
    html2canvas(element, {
        scale: 2,
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-primary')
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = (currentMindMap ? currentMindMap.name : 'mindmap') + '.png';
        link.href = canvas.toDataURL();
        link.click();
    }).catch(function(error) {
        console.error('Mind map export failed:', error);
        alert('Export failed. Please try again later.');
    });
}

// ─── Structure registry ───────────────────────────────────────────────────────
var ALL_STRUCTURES = {
    twoway:     { icon: '↔️', name: 'Two-Way' },
    oneway:     { icon: '➡️', name: 'One-Way' },
    brace:      { icon: '🔗', name: 'Brace Map' }
};

// ─── Default node templates ────────────────────────────────────────────────────
var DEFAULT_NODES = {
    twoway:     ['R1', 'R2', 'L1', 'L2'],
    oneway:     ['N1', 'N2', 'N3'],
    brace:      ['Part 1', 'Part 2']
};

var DEFAULT_SUBNODES = {
    twoway: {
        'R1': ['R1.1', 'R1.2'],
        'R2': ['R2.1', 'R2.2'],
        'L1': ['L1.1', 'L1.2'],
        'L2': ['L2.1', 'L2.2']
    },
    oneway: {
        'N1': ['N1.1', 'N1.2'],
        'N2': ['N2.1'],
        'N3': ['N3.1', 'N3.2']
    },
    brace: {
        'Part 1': ['Sub 1', 'Sub 2'],
        'Part 2': ['Sub 1', 'Sub 2']
    }
};

// ─── Fixed positions matching your SVGs ──────────────────────────────────────
var FIXED_POSITIONS = {
    twoway: {
        center: { x: 460, y: 245 },
        nodes: {
            'R1': { x: 640, y: 140 },
            'R2': { x: 640, y: 340 },
            'L1': { x: 260, y: 140 },
            'L2': { x: 260, y: 340 }
        },
        subnodes: {
            'R1.1': { x: 800, y: 110 },
            'R1.2': { x: 800, y: 180 },
            'R2.1': { x: 800, y: 320 },
            'R2.2': { x: 800, y: 400 },
            'L1.1': { x: 100, y: 110 },
            'L1.2': { x: 100, y: 180 },
            'L2.1': { x: 100, y: 320 },
            'L2.2': { x: 100, y: 400 }
        }
    },
    oneway: {
        center: { x: 140, y: 245 },
        nodes: {
            'N1': { x: 340, y: 140 },
            'N2': { x: 340, y: 245 },
            'N3': { x: 340, y: 340 }
        },
        subnodes: {
            'N1.1': { x: 520, y: 110 },
            'N1.2': { x: 520, y: 180 },
            'N2.1': { x: 520, y: 245 },
            'N3.1': { x: 520, y: 320 },
            'N3.2': { x: 520, y: 400 }
        }
    },
    brace: {
        center: { x: 150, y: 245 },
        nodes: {
            'Part 1': { x: 350, y: 140 },
            'Part 2': { x: 350, y: 350 }
        },
        subnodes: {
            'Sub 1_Part1': { x: 550, y: 90 },
            'Sub 2_Part1': { x: 550, y: 190 },
            'Sub 1_Part2': { x: 550, y: 300 },
            'Sub 2_Part2': { x: 550, y: 400 }
        }
    }
};

// ─── Structure menu ──────────────────────────────────────────────────────────
function toggleStructureMenu() {
    var menu = document.getElementById('structureMenu');
    if (menu) menu.classList.toggle('show');
}

function applyStructure(type) {
    currentStructure = type;
    if (currentMindMap) {
        currentMindMap.structure = type;
        triggerAutoSave();
    }
    var menu = document.getElementById('structureMenu');
    if (menu) menu.classList.remove('show');

    var info = ALL_STRUCTURES[type] || { icon: '↔️', name: type };
    var iconSpan = document.getElementById('selectedStructureIcon');
    var nameSpan = document.getElementById('selectedStructureName');
    if (iconSpan) iconSpan.textContent = info.icon;
    if (nameSpan) nameSpan.textContent = info.name;

    var menuItems = document.querySelectorAll('#structureMenu div[data-structure]');
    for (var i = 0; i < menuItems.length; i++) {
        if (menuItems[i].getAttribute('data-structure') === type) {
            menuItems[i].style.background = 'var(--accent-light)';
            menuItems[i].style.color = 'var(--accent)';
            menuItems[i].style.fontWeight = '600';
        } else {
            menuItems[i].style.background = '';
            menuItems[i].style.color = '';
            menuItems[i].style.fontWeight = '';
        }
    }

    document.body.setAttribute('data-structure', type);
    layoutNodes();
}

// ─── Layout engine ───────────────────────────────────────────────────────────
function layoutNodes() {
    if (!currentMindMap) return;

    var structure = currentMindMap.structure || currentStructure;

    // For two-way: skip the FIXED_POSITIONS lookup entirely — reflowTwoWay
    // inside applyRecursiveFallbackPositions handles all placement cleanly.
    if (structure !== 'twoway') {
        var positions = FIXED_POSITIONS[structure];
        if (positions) {
            var centerNodeForLayout = null;
            var otherNodes = [];
            for (var i = 0; i < currentMindMap.nodes.length; i++) {
                if (currentMindMap.nodes[i].isCenter) centerNodeForLayout = currentMindMap.nodes[i];
                else otherNodes.push(currentMindMap.nodes[i]);
            }
            if (centerNodeForLayout && positions.center) {
                centerNodeForLayout.x = positions.center.x;
                centerNodeForLayout.y = positions.center.y;
            }
            for (var j = 0; j < otherNodes.length; j++) {
                var node = otherNodes[j];
                for (var key in positions.nodes) {
                    if (node.text === key || node.text.indexOf(key) !== -1 || key.indexOf(node.text) !== -1) {
                        node.x = positions.nodes[key].x;
                        node.y = positions.nodes[key].y;
                        break;
                    }
                }
            }
            if (!currentMindMap.subNodes) currentMindMap.subNodes = {};
            for (var parentId in currentMindMap.subNodes) {
                var subs = currentMindMap.subNodes[parentId];
                if (!subs) continue;
                var parentNodeForSubs = null;
                for (var pi = 0; pi < currentMindMap.nodes.length; pi++) {
                    if (currentMindMap.nodes[pi].id == parentId) { parentNodeForSubs = currentMindMap.nodes[pi]; break; }
                }
                for (var s = 0; s < subs.length; s++) {
                    var sub = subs[s];
                    var isBrace = structure === 'brace' && parentNodeForSubs;
                    var braceKey = null;
                    if (isBrace && (sub.text === 'Sub 1' || sub.text === 'Sub 2')) {
                        if (parentNodeForSubs.text === 'Part 1') braceKey = sub.text === 'Sub 1' ? 'Sub 1_Part1' : 'Sub 2_Part1';
                        else if (parentNodeForSubs.text === 'Part 2') braceKey = sub.text === 'Sub 1' ? 'Sub 1_Part2' : 'Sub 2_Part2';
                    }
                    for (var subKey in positions.subnodes) {
                        if ((braceKey && subKey === braceKey) || sub.text === subKey || sub.text.indexOf(subKey) !== -1) {
                            sub.x = positions.subnodes[subKey].x;
                            sub.y = positions.subnodes[subKey].y;
                            break;
                        }
                    }
                }
            }
        }
    } else {
        // Two-way: ensure center has a sensible default position if not yet set.
        for (var ci = 0; ci < currentMindMap.nodes.length; ci++) {
            if (currentMindMap.nodes[ci].isCenter) {
                if (!currentMindMap.nodes[ci].x || !currentMindMap.nodes[ci].y) {
                    currentMindMap.nodes[ci].x = FIXED_POSITIONS.twoway.center.x;
                    currentMindMap.nodes[ci].y = FIXED_POSITIONS.twoway.center.y;
                }
                break;
            }
        }
        if (!currentMindMap.subNodes) currentMindMap.subNodes = {};
    }

    applyRecursiveFallbackPositions();
    renderMindMap();
}

function buildNodeLookup() {
    var lookup = {};
    if (!currentMindMap) return lookup;
    if (currentMindMap.nodes) {
        for (var i = 0; i < currentMindMap.nodes.length; i++) {
            var n = currentMindMap.nodes[i];
            lookup[n.id] = n;
            if (n.isCenter) lookup['center'] = n;
        }
    }
    if (currentMindMap.subNodes) {
        for (var pid in currentMindMap.subNodes) {
            var arr = currentMindMap.subNodes[pid] || [];
            for (var j = 0; j < arr.length; j++) lookup[arr[j].id] = arr[j];
        }
    }
    return lookup;
}

function applyRecursiveFallbackPositions() {
    if (!currentMindMap) return;
    if (!currentMindMap.subNodes) currentMindMap.subNodes = {};

    // ── CRITICAL FIX: declare structure as a local variable ──────────────────
    var structure = currentMindMap.structure || currentStructure;

    var nodeLookup = buildNodeLookup();
    var center = nodeLookup['center'];
    if (!center) return;

    // ── Structured reflows: twoway and oneway get their own full reflow ───────
    if (structure === 'twoway') {
        reflowTwoWay(center, nodeLookup);
        return;
    }
    if (structure === 'oneway') {
        reflowOneWay(center, nodeLookup);
        return;
    }

    // ── Other structures: original fallback logic ─────────────────────────────
    var rootChildren = [];
    for (var i = 0; i < currentMindMap.nodes.length; i++) {
        if (!currentMindMap.nodes[i].isCenter) rootChildren.push(currentMindMap.nodes[i]);
    }

    var rootSpacing = 90;
    var rootStartY = center.y - ((rootChildren.length - 1) * rootSpacing / 2);
    for (var r = 0; r < rootChildren.length; r++) {
        if (rootChildren[r].x === undefined || rootChildren[r].y === undefined) {
            rootChildren[r].x = center.x + 210;
            rootChildren[r].y = rootStartY + (r * rootSpacing);
        }
    }

    function layoutChildren(parentId, depth) {
        var parentNode = nodeLookup[parentId];
        var children = currentMindMap.subNodes[parentId] || [];
        if (!parentNode || !children.length) return;
        var spacing = Math.max(50, 90 - (depth * 8));
        var startY = parentNode.y - ((children.length - 1) * spacing / 2);
        for (var c = 0; c < children.length; c++) {
            if (children[c].x === undefined || children[c].y === undefined) {
                children[c].x = parentNode.x + 180;
                children[c].y = startY + (c * spacing);
            }
            nodeLookup[children[c].id] = children[c];
            layoutChildren(children[c].id, depth + 1);
        }
    }

    for (var t = 0; t < rootChildren.length; t++) {
        layoutChildren(rootChildren[t].id, 1);
    }
}

// ─── Two-Way full reflow ──────────────────────────────────────────────────────
// Deterministically places every node and sub-node for the two-way layout.
// Clears old positions and recomputes from scratch so branches never drift.
function reflowTwoWay(center, nodeLookup) {
    if (!currentMindMap) return;

    // Use the visible canvas area so both sides always fit on screen.
    var canvasEl = document.getElementById('mindMapCanvas');
    var vpW = canvasEl ? canvasEl.clientWidth  : 900;
    var vpH = canvasEl ? canvasEl.clientHeight : 500;
    var cx  = Math.round(vpW / 2);
    var cy  = Math.round(vpH / 2);
    // Write back so the center node element moves to the correct position.
    center.x = cx;
    center.y = cy;

    var rootChildren = [];
    for (var i = 0; i < currentMindMap.nodes.length; i++) {
        if (!currentMindMap.nodes[i].isCenter) rootChildren.push(currentMindMap.nodes[i]);
    }

    var leftBranches  = [];
    var rightBranches = [];
    var staged = [];   // brand-new nodes with no side hint yet

    for (var r = 0; r < rootChildren.length; r++) {
        var rt = rootChildren[r];
        // Text prefix wins for default nodes (R→right, L→left).
        var firstChar = (rt.text || '').trim().toUpperCase().charAt(0);
        if (firstChar === 'R') {
            rightBranches.push(rt);
        } else if (firstChar === 'L') {
            leftBranches.push(rt);
        } else if (rt.x !== undefined && rt.x !== 0) {
            // Custom-named node — keep the side it was on.
            if (rt.x < cx) leftBranches.push(rt);
            else rightBranches.push(rt);
        } else {
            staged.push(rt);
        }
    }

    // Balance any brand-new (no-hint) nodes between sides.
    for (var s = 0; s < staged.length; s++) {
        if (leftBranches.length <= rightBranches.length) leftBranches.push(staged[s]);
        else rightBranches.push(staged[s]);
    }

    // Horizontal offset scales with viewport so it never overflows.
    var LEVEL1_X_OFFSET = Math.max(160, Math.round(vpW * 0.26));
    var BRANCH_SPACING  = Math.max(80,  Math.round(vpH * 0.18));
    var CHILD_X_STEP    = Math.max(130, Math.round(vpW * 0.16));
    var CHILD_Y_GAP     = 70;

    function placeBranchRoots(branches, dir) {
        var total  = branches.length;
        var startY = cy - ((total - 1) * BRANCH_SPACING / 2);
        for (var b = 0; b < total; b++) {
            branches[b].x = cx + dir * LEVEL1_X_OFFSET;
            branches[b].y = startY + b * BRANCH_SPACING;
            nodeLookup[branches[b].id] = branches[b];
        }
    }

    placeBranchRoots(leftBranches,  -1);
    placeBranchRoots(rightBranches,  1);

    function placeChildren(parentId, parentX, parentY, dir, depth) {
        var children = (currentMindMap.subNodes && currentMindMap.subNodes[parentId]) || [];
        if (!children.length) return;

        var gap    = Math.max(44, CHILD_Y_GAP - depth * 6);
        var childX = parentX + dir * CHILD_X_STEP;
        var startY = parentY - ((children.length - 1) * gap / 2);

        for (var c = 0; c < children.length; c++) {
            children[c].x = childX;
            children[c].y = startY + c * gap;
            nodeLookup[children[c].id] = children[c];
            placeChildren(children[c].id, childX, children[c].y, dir, depth + 1);
        }
    }

    for (var li = 0; li < leftBranches.length; li++) {
        placeChildren(leftBranches[li].id, leftBranches[li].x, leftBranches[li].y, -1, 1);
    }
    for (var ri = 0; ri < rightBranches.length; ri++) {
        placeChildren(rightBranches[ri].id, rightBranches[ri].x, rightBranches[ri].y,  1, 1);
    }
}

// ─── One-Way full reflow ──────────────────────────────────────────────────────
// Places center on the left and fans all nodes/sub-nodes out to the RIGHT only.
function reflowOneWay(center, nodeLookup) {
    if (!currentMindMap) return;

    var canvasEl = document.getElementById('mindMapCanvas');
    var vpW = canvasEl ? canvasEl.clientWidth  : 900;
    var vpH = canvasEl ? canvasEl.clientHeight : 500;

    // Anchor center at ~20% from the left edge.
    var cx = Math.round(vpW * 0.20);
    var cy = Math.round(vpH / 2);
    center.x = cx;
    center.y = cy;

    var rootChildren = [];
    for (var i = 0; i < currentMindMap.nodes.length; i++) {
        if (!currentMindMap.nodes[i].isCenter) rootChildren.push(currentMindMap.nodes[i]);
    }

    var BRANCH_SPACING  = Math.max(80, Math.round(vpH * 0.18));
    var LEVEL1_X_OFFSET = Math.max(160, Math.round(vpW * 0.22));
    var CHILD_X_STEP    = Math.max(130, Math.round(vpW * 0.16));
    var CHILD_Y_GAP     = 70;

    // All level-1 nodes to the right.
    var startY = cy - ((rootChildren.length - 1) * BRANCH_SPACING / 2);
    for (var r = 0; r < rootChildren.length; r++) {
        rootChildren[r].x = cx + LEVEL1_X_OFFSET;
        rootChildren[r].y = startY + r * BRANCH_SPACING;
        nodeLookup[rootChildren[r].id] = rootChildren[r];
    }

    function placeChildren(parentId, parentX, parentY, depth) {
        var children = (currentMindMap.subNodes && currentMindMap.subNodes[parentId]) || [];
        if (!children.length) return;
        var gap     = Math.max(44, CHILD_Y_GAP - depth * 6);
        var childX  = parentX + CHILD_X_STEP;
        var startYc = parentY - ((children.length - 1) * gap / 2);
        for (var c = 0; c < children.length; c++) {
            children[c].x = childX;
            children[c].y = startYc + c * gap;
            nodeLookup[children[c].id] = children[c];
            placeChildren(children[c].id, childX, children[c].y, depth + 1);
        }
    }

    for (var t = 0; t < rootChildren.length; t++) {
        placeChildren(rootChildren[t].id, rootChildren[t].x, rootChildren[t].y, 1);
    }
}

// ─── Open / close ─────────────────────────────────────────────────────────────
function openMindMap(mindMap) {
    currentMindMap = mindMap;
    currentStructure = mindMap.structure || 'twoway';

    var nameSpan = document.getElementById("mindMapName");
    if (nameSpan) nameSpan.textContent = mindMap.name;

    var appContainer = document.getElementById("appContainer");
    var dashboard    = document.getElementById("mindMapDashboard");
    if (appContainer) appContainer.style.display = "none";
    if (dashboard)    dashboard.style.display    = "flex";

    mindMapZoomLevel = 1;

    var info = ALL_STRUCTURES[currentStructure] || { icon: '↔️', name: currentStructure };
    var iconSpan = document.getElementById('selectedStructureIcon');
    var nameSpanStruct = document.getElementById('selectedStructureName');
    if (iconSpan) iconSpan.textContent = info.icon;
    if (nameSpanStruct) nameSpanStruct.textContent = info.name;

    var menuItems = document.querySelectorAll('#structureMenu div[data-structure]');
    for (var mi = 0; mi < menuItems.length; mi++) {
        if (menuItems[mi].getAttribute('data-structure') === currentStructure) {
            menuItems[mi].style.background = 'var(--accent-light)';
            menuItems[mi].style.color = 'var(--accent)';
            menuItems[mi].style.fontWeight = '600';
        } else {
            menuItems[mi].style.background = '';
            menuItems[mi].style.color = '';
            menuItems[mi].style.fontWeight = '';
        }
    }

    document.body.setAttribute('data-structure', currentStructure);

    if (!currentMindMap.subNodes)         currentMindMap.subNodes = {};
    if (!currentMindMap.nodeAttachments)  currentMindMap.nodeAttachments = {};
    if (!currentMindMap.centerAttachments) currentMindMap.centerAttachments = [];

    var nonCenterNodes = (currentMindMap.nodes || []).filter(function(n) { return !n.isCenter; });
    if (nonCenterNodes.length === 0) {
        addDefaultNodes(currentStructure);
    }

    setTimeout(function() { layoutNodes(); }, 100);
}

function addDefaultNodes(structure) {
    if (!currentMindMap) return;
    var defaults = DEFAULT_NODES[structure] || DEFAULT_NODES['twoway'];
    if (!currentMindMap.nodes) currentMindMap.nodes = [];

    var hasCenter = false;
    for (var i = 0; i < currentMindMap.nodes.length; i++) {
        if (currentMindMap.nodes[i].isCenter) { hasCenter = true; break; }
    }
    if (!hasCenter) {
        var defaultCenter = { x: 300, y: 245 };
        if (FIXED_POSITIONS[structure] && FIXED_POSITIONS[structure].center) {
            defaultCenter = FIXED_POSITIONS[structure].center;
        }
        currentMindMap.nodes.push({ id: 'center', text: currentMindMap.name || 'Main', x: defaultCenter.x, y: defaultCenter.y, isCenter: true });
    }

    for (var d = 0; d < defaults.length; d++) {
        var nodeId = Date.now() + d + Math.random();
        // For twoway: use text prefix (R→right, L→left) for correct initial side.
        var initX, initY;
        if (structure === 'twoway') {
            var upperFirst = (defaults[d] || '').trim().toUpperCase().charAt(0);
            var isSide = (upperFirst === 'L') ? -1 : 1;
            initX = FIXED_POSITIONS.twoway.center.x + isSide * 200;
            initY = FIXED_POSITIONS.twoway.center.y + (Math.floor(d / 2) * 100) - 50;
        }
        var newNode = { id: nodeId, text: defaults[d], isCenter: false };
        if (initX !== undefined) { newNode.x = initX; newNode.y = initY; }
        currentMindMap.nodes.push(newNode);
        
        var defaultSubs = DEFAULT_SUBNODES[structure];
        if (defaultSubs && defaultSubs[defaults[d]]) {
            if (!currentMindMap.subNodes[nodeId]) currentMindMap.subNodes[nodeId] = [];
            for (var s = 0; s < defaultSubs[defaults[d]].length; s++) {
                currentMindMap.subNodes[nodeId].push({
                    id: Date.now() + s + Math.random(),
                    text: defaultSubs[defaults[d]][s],
                    parentId: nodeId
                });
            }
        }
    }
}

function closeMindMap() {
    if (currentMindMap) {
        saveMindMapData();
        triggerAutoSave();
    }
    var insertMenu = document.getElementById('insertMenu');
    if (insertMenu) insertMenu.style.display = 'none';
    var dashboard    = document.getElementById("mindMapDashboard");
    var appContainer = document.getElementById("appContainer");
    if (dashboard)    dashboard.style.display    = "none";
    if (appContainer) appContainer.style.display = "flex";
    render();
}

function saveMindMap() {
    saveMindMapData();
    if (currentWorkspaceRoot && currentMindMap && currentMindMap.fileHandle) {
        saveMindMapToFile(currentMindMap);
    }
    saveDataToLocalStorage();
    alert("Mind Map saved!");
}

function saveMindMapData() {
    if (!currentMindMap) return;

    var centerEl = document.getElementById('mindMapCenterNode');
    if (centerEl && currentMindMap.nodes) {
        for (var ci = 0; ci < currentMindMap.nodes.length; ci++) {
            if (currentMindMap.nodes[ci].isCenter) {
                currentMindMap.nodes[ci].text = centerEl.textContent;
                break;
            }
        }
    }

    var nodeEls = document.querySelectorAll('.mindmap-node:not(.subnode)');
    for (var i = 0; i < nodeEls.length; i++) {
        var nodeId = nodeEls[i].getAttribute('data-id');
        if (!nodeId) continue;
        for (var j = 0; j < currentMindMap.nodes.length; j++) {
            if (currentMindMap.nodes[j].id == nodeId) {
                currentMindMap.nodes[j].x = parseFloat(nodeEls[i].style.left) + NW_HALF;
                currentMindMap.nodes[j].y = parseFloat(nodeEls[i].style.top) + NH_HALF;
                var clone = nodeEls[i].cloneNode(true);
                var btn = clone.querySelector('.node-insert-btn');
                if (btn) btn.parentNode.removeChild(btn);
                currentMindMap.nodes[j].text = clone.textContent;
                break;
            }
        }
    }

    var snEls = document.querySelectorAll('.mindmap-node.subnode');
    for (var si = 0; si < snEls.length; si++) {
        var snId  = snEls[si].getAttribute('data-id');
        var snPid = snEls[si].getAttribute('data-parent');
        if (!snId || !snPid) continue;
        if (currentMindMap.subNodes && currentMindMap.subNodes[snPid]) {
            for (var sj = 0; sj < currentMindMap.subNodes[snPid].length; sj++) {
                if (currentMindMap.subNodes[snPid][sj].id == snId) {
                    currentMindMap.subNodes[snPid][sj].x = parseFloat(snEls[si].style.left) + SN_W_HALF;
                    currentMindMap.subNodes[snPid][sj].y = parseFloat(snEls[si].style.top)  + SN_H_HALF;
                    currentMindMap.subNodes[snPid][sj].text = snEls[si].textContent;
                    break;
                }
            }
        }
    }

    currentMindMap.structure = currentStructure;
    saveDataToLocalStorage();
}

function findSubNodeParentId(subNodeId) {
    if (!currentMindMap || !currentMindMap.subNodes) return null;
    for (var pid in currentMindMap.subNodes) {
        var arr = currentMindMap.subNodes[pid] || [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id == subNodeId) return pid;
        }
    }
    return null;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderMindMap() {
    var nodesContainer = document.getElementById('mindMapNodes');
    var linesContainer = document.getElementById('mindMapLines');
    var canvas         = document.getElementById('mindMapCanvas');

    if (!nodesContainer || !linesContainer) return;

    nodesContainer.innerHTML = '';
    linesContainer.innerHTML = '';

    if (!currentMindMap) return;

    var structure = currentMindMap.structure || currentStructure;
    var centerNodeEl = document.getElementById('mindMapCenterNode');
    if (centerNodeEl) centerNodeEl.style.display = '';

    var positions = FIXED_POSITIONS[structure];
    if (!positions) return;

    var centerNode = null;
    var otherNodes = [];
    var allNodes = {};
    
    if (currentMindMap.nodes) {
        for (var i = 0; i < currentMindMap.nodes.length; i++) {
            if (currentMindMap.nodes[i].isCenter) {
                centerNode = currentMindMap.nodes[i];
                allNodes['center'] = centerNode;
            } else {
                otherNodes.push(currentMindMap.nodes[i]);
                allNodes[currentMindMap.nodes[i].text] = currentMindMap.nodes[i];
                allNodes[currentMindMap.nodes[i].id] = currentMindMap.nodes[i];
            }
        }
    }

    function applyBoxStyle(el, isCenterNode, isSubNode, structureType) {
        if (structureType === 'twoway') {
            el.style.width = '80px';
            el.style.height = '40px';
            el.style.padding = '0';
            el.style.minWidth = '80px';
            el.style.borderRadius = '6px';
            el.style.backgroundColor = '#f5f5f5';
            el.style.border = '1.5px solid #333';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = '12px';
            el.style.textAlign = 'center';
            el.style.color = '#000';
            el.style.fontWeight = 'normal';
            return;
        }

        if (isCenterNode) {
            el.style.width = 'auto';
            el.style.height = 'auto';
            el.style.borderRadius = '40px';
            el.style.padding = '14px 28px';
            el.style.backgroundColor = '#f5f5f5';
            el.style.border = '2px solid #333';
            el.style.color = '#000';
            return;
        }

        if (isSubNode) {
            el.style.backgroundColor = '#fff';
            el.style.border = '1.5px solid #333';
            el.style.borderRadius = '6px';
            el.style.minWidth = '60px';
            el.style.textAlign = 'center';
            el.style.padding = '8px 16px';
            el.style.fontSize = '12px';
            el.style.color = '#000';
            return;
        }

        el.style.backgroundColor = '#f5f5f5';
        el.style.border = '1.5px solid #333';
        el.style.borderRadius = '6px';
        el.style.minWidth = '80px';
        el.style.textAlign = 'center';
        el.style.padding = '10px 20px';
        el.style.color = '#000';
        el.style.fontWeight = 'normal';
    }

    // Render center node
    if (centerNode && centerNodeEl) {
        centerNodeEl.textContent = centerNode.text || 'Main';
        centerNodeEl.style.left = (centerNode.x - CNW_HALF) + 'px';
        centerNodeEl.style.top  = (centerNode.y - CNH_HALF) + 'px';
        applyBoxStyle(centerNodeEl, true, false, structure);
        
        makeDraggable(centerNodeEl, centerNode, true);
        centerNodeEl.onclick = function(e) {
            e.stopPropagation();
            selectedNodeId = 'center';
            selectedSubNodeId = null;
            var all = document.querySelectorAll('.mindmap-node');
            for (var ai = 0; ai < all.length; ai++) all[ai].classList.remove('selected');
            centerNodeEl.classList.add('selected');
        };
        
        var oldCenterAttachments = centerNodeEl.querySelector('.node-attachment');
        if (oldCenterAttachments) oldCenterAttachments.remove();
        if (currentMindMap.centerAttachments && currentMindMap.centerAttachments.length) {
            var centerAtt = document.createElement('div');
            centerAtt.className = 'node-attachment';
            for (var ca = 0; ca < currentMindMap.centerAttachments.length; ca++) {
                var cicon = document.createElement('span');
                cicon.className = 'node-attachment-icon';
                var catt = currentMindMap.centerAttachments[ca];
                cicon.innerHTML = catt.type === 'audio' ? '🎵' : catt.type === 'link' ? '🔗' : '📎';
                cicon.onclick = (function(attachment) {
                    return function(ev) { ev.stopPropagation(); openAttachment(attachment); };
                })(catt);
                centerAtt.appendChild(cicon);
            }
            centerNodeEl.appendChild(centerAtt);
        }
    }

    // Render regular nodes
    for (var l = 0; l < otherNodes.length; l++) {
        var node = otherNodes[l];
        var nodeDiv = document.createElement('div');
        nodeDiv.className = 'mindmap-node' + (selectedNodeId === node.id ? ' selected' : '');
        nodeDiv.setAttribute('data-id', node.id);
        nodeDiv.setAttribute('data-text', node.text);
        nodeDiv.setAttribute('contenteditable', 'true');
        nodeDiv.style.left     = (node.x - NW_HALF) + 'px';
        nodeDiv.style.top      = (node.y - NH_HALF) + 'px';
        nodeDiv.style.position = 'absolute';
        nodeDiv.style.zIndex   = '10';
        applyBoxStyle(nodeDiv, false, false, structure);

        var textNode = document.createTextNode(node.text || 'Node');
        nodeDiv.appendChild(textNode);

        var insertBtn = document.createElement('button');
        insertBtn.className = 'node-insert-btn';
        insertBtn.textContent = '+';
        insertBtn.title = 'Insert into this node';
        (function(nid, btn) {
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                selectedNodeId = nid;
                selectNode(nid);
                showNodeInsertMenu(e);
            };
        })(node.id, insertBtn);
        nodeDiv.appendChild(insertBtn);

        if (currentMindMap.nodeAttachments && currentMindMap.nodeAttachments[node.id] &&
            currentMindMap.nodeAttachments[node.id].length > 0) {
            var attDiv = document.createElement('div');
            attDiv.className = 'node-attachment';
            var atts = currentMindMap.nodeAttachments[node.id];
            for (var a = 0; a < atts.length; a++) {
                var att  = atts[a];
                var icon = document.createElement('span');
                icon.className = 'node-attachment-icon';
                icon.innerHTML = att.type === 'image'   ? '🖼️' :
                                 att.type === 'link'    ? '🔗' :
                                 att.type === 'comment' ? '💬' :
                                 att.type === 'pdf'     ? '📄' :
                                 att.type === 'sketch'  ? '✏️' : '📎';
                icon.onclick = (function(attachment) {
                    return function(e) { e.stopPropagation(); openAttachment(attachment); };
                })(att);
                attDiv.appendChild(icon);
            }
            nodeDiv.appendChild(attDiv);
        }

        nodeDiv.oncontextmenu = (function(pid) {
            return function(e) {
                e.preventDefault();
                e.stopPropagation();
                addSubNode(pid);
            };
        })(node.id);

        nodeDiv.onclick = (function(id) {
            return function(e) {
                if (e.target.classList.contains('node-insert-btn') ||
                    e.target.classList.contains('node-attachment-icon')) return;
                e.stopPropagation();
                selectNode(id);
            };
        })(node.id);

        nodeDiv.onblur = (function(nd, div) {
            return function() {
                var clone = div.cloneNode(true);
                var btn2  = clone.querySelector('.node-insert-btn');
                if (btn2) btn2.parentNode.removeChild(btn2);
                nd.text = clone.textContent;
                saveMindMapData();
                triggerAutoSave();
            };
        })(node, nodeDiv);

        nodesContainer.appendChild(nodeDiv);
        makeDraggable(nodeDiv, node, false);
    }

    // Store all sub-nodes for line drawing
    var allSubNodes = {};
    for (var pid in currentMindMap.subNodes) {
        var subs = currentMindMap.subNodes[pid];
        if (!subs) continue;
        for (var s = 0; s < subs.length; s++) {
            var sub = subs[s];
            allSubNodes[sub.text] = sub;
            allSubNodes[sub.id] = sub;
            
            // Also store by parent for easy lookup
            if (!allSubNodes['parent_' + pid]) allSubNodes['parent_' + pid] = [];
            allSubNodes['parent_' + pid].push(sub);
        }
    }

    // Render sub-nodes
    for (var pid2 in currentMindMap.subNodes) {
        var subs2 = currentMindMap.subNodes[pid2];
        if (!subs2 || !subs2.length) continue;
        
        var parentNode = null;
        for (var pn = 0; pn < currentMindMap.nodes.length; pn++) {
            if (currentMindMap.nodes[pn].id == pid2) {
                parentNode = currentMindMap.nodes[pn];
                break;
            }
        }
        
        for (var s2 = 0; s2 < subs2.length; s2++) {
            var sub = subs2[s2];
            if (sub.x === undefined) continue;
            
            var subDiv = document.createElement('div');
            subDiv.className = 'mindmap-node subnode' + (selectedSubNodeId === sub.id ? ' selected' : '');
            subDiv.setAttribute('data-id', sub.id);
            subDiv.setAttribute('data-parent', pid2);
            subDiv.setAttribute('data-text', sub.text);
            subDiv.setAttribute('contenteditable', 'true');
            subDiv.textContent = sub.text || 'Sub';
            subDiv.style.left = (sub.x - SN_W_HALF) + 'px';
            subDiv.style.top  = (sub.y - SN_H_HALF) + 'px';
            subDiv.style.position = 'absolute';
            subDiv.style.zIndex   = '10';
            applyBoxStyle(subDiv, false, true, structure);

            subDiv.onclick = (function(id) {
                return function(e) {
                    e.stopPropagation();
                    selectSubNode(id);
                };
            })(sub.id);

            var subInsertBtn = document.createElement('button');
            subInsertBtn.className = 'node-insert-btn';
            subInsertBtn.textContent = '+';
            subInsertBtn.title = 'Insert into this sub-node';
            (function(sid, btn) {
                btn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedSubNodeId = sid;
                    selectedNodeId = null;
                    selectSubNode(sid);
                    showNodeInsertMenu(e);
                };
            })(sub.id, subInsertBtn);
            subDiv.appendChild(subInsertBtn);

            subDiv.oncontextmenu = (function(pidForSub) {
                return function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    addSubNode(pidForSub);
                };
            })(sub.id);

            subDiv.onblur = (function(sb, div) {
                return function() {
                    var clone = div.cloneNode(true);
                    var btn3 = clone.querySelector('.node-insert-btn');
                    if (btn3) btn3.parentNode.removeChild(btn3);
                    sb.text = clone.textContent;
                    saveMindMapData();
                    triggerAutoSave();
                };
            })(sub, subDiv);

            nodesContainer.appendChild(subDiv);
            makeDraggableSubNode(subDiv, sub, pid2);
        }
    }

    // DRAW ALL LINES DYNAMICALLY based on actual node positions
    drawDynamicLines(linesContainer, centerNode, otherNodes, currentMindMap.subNodes);
}

// ─── DYNAMIC LINE DRAWING - connects based on actual node positions ──────────
function drawDynamicLines(container, centerNode, nodes, subNodes) {
    if (!container) return;
    container.innerHTML = '';
    
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '3000');
    svg.setAttribute('height', '3000');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:4;overflow:visible;';
    
    // Create map of all node positions by id
    var nodeMap = {};
    if (centerNode) nodeMap['center'] = centerNode;
    for (var i = 0; i < nodes.length; i++) nodeMap[nodes[i].id] = nodes[i];
    for (var parentId in subNodes) {
        var arr = subNodes[parentId] || [];
        for (var s = 0; s < arr.length; s++) nodeMap[arr[s].id] = arr[s];
    }
    
    var structure = currentMindMap.structure || currentStructure;

    function drawBraceGroup(parent, children, parentHalf, childHalf) {
        if (!parent || !children || !children.length) return;
        if (children.length === 1) {
            var child = children[0];
            var startX = parent.x + parentHalf;
            var endX = child.x - childHalf;
            drawBraceLine(svg, parent.y, child.y, startX, endX);
            return;
        }

        var startX = parent.x + parentHalf;
        var spineX = startX + 40;
        var yValues = children.map(function(c) { return c.y; }).sort(function(a,b){return a-b;});
        var topY = yValues[0];
        var bottomY = yValues[yValues.length - 1];

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var d = 'M ' + startX + ' ' + parent.y + ' H ' + spineX + ' M ' + spineX + ' ' + topY + ' V ' + bottomY;
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#555');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);

        for (var c = 0; c < children.length; c++) {
            var child = children[c];
            var childEndX = child.x - childHalf;
            var childPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var childD = 'M ' + spineX + ' ' + child.y + ' H ' + childEndX;
            childPath.setAttribute('d', childD);
            childPath.setAttribute('stroke', '#555');
            childPath.setAttribute('stroke-width', '2');
            childPath.setAttribute('fill', 'none');
            childPath.setAttribute('stroke-linecap', 'round');
            childPath.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(childPath);
        }
    }

    function drawBraceLine(svgRoot, startY, endY, startX, endX) {
        var pathData = 'M ' + startX + ' ' + startY;
        if (startY === endY) {
            pathData += ' H ' + endX;
        } else {
            var verticalX = Math.round(startX + Math.max(40, (endX - startX) * 0.45));
            pathData += ' H ' + verticalX + ' V ' + endY + ' H ' + endX;
        }
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#555');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svgRoot.appendChild(path);
    }

    if (structure === 'brace') {
        if (centerNode && nodes.length) {
            drawBraceGroup(centerNode, nodes, CNW_HALF, NW_HALF);
        }
        for (var pId in subNodes) {
            var parent = nodeMap[pId];
            if (!parent) continue;
            var childList = subNodes[pId] || [];
            if (!childList.length) continue;
            drawBraceGroup(parent, childList, NW_HALF, SN_W_HALF);
        }
        container.appendChild(svg);
        return;
    }

    function drawEdgeAnchoredLine(svgRoot, parent, child, structureType) {
        if (!parent || !child) return;
        var dir = child.x >= parent.x ? 1 : -1;
        var parentHalf = parent.isCenter ? CNW_HALF : (parent.parentId ? SN_W_HALF : NW_HALF);
        var childHalf  = child.isCenter ? CNW_HALF : (child.parentId ? SN_W_HALF : NW_HALF);

        var startX = parent.x + (dir * parentHalf);
        var endX = child.x - (dir * childHalf);

        if (structureType !== 'twoway') {
            drawCurvedLine(svgRoot, parent.x, parent.y, child.x, child.y, '#555', 2);
            return;
        }

        var ctrlX = (startX + endX) / 2;
        var d = 'M ' + startX + ' ' + parent.y +
                ' C ' + ctrlX + ' ' + parent.y + ', ' +
                ctrlX + ' ' + child.y + ', ' +
                endX + ' ' + child.y;

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#555');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svgRoot.appendChild(path);
    }

    for (var n = 0; n < nodes.length; n++) {
        if (centerNode && nodes[n]) drawEdgeAnchoredLine(svg, centerNode, nodes[n], structure);
    }

    for (var pId in subNodes) {
        var parent = nodeMap[pId];
        if (!parent) continue;
        var childList = subNodes[pId] || [];
        for (var c = 0; c < childList.length; c++) {
            var child = childList[c];
            if (child && child.x !== undefined && child.y !== undefined) {
                drawEdgeAnchoredLine(svg, parent, child, structure);
            }
        }
    }
    
    container.appendChild(svg);
}

function drawCurvedLine(svg, x1, y1, x2, y2, color, width) {
    var midX = (x1 + x2) / 2;
    var d = 'M ' + x1 + ' ' + y1 +
            ' C ' + midX + ' ' + y1 + ', ' +
            midX + ' ' + y2 + ', ' +
            x2 + ' ' + y2;
    
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
}

function drawStraightLine(svg, x1, y1, x2, y2, color, width) {
    var d = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
    
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
}

// ─── Redraw lines only (used during drag) ─────────────────────────────────────
function redrawLinesOnly() {
    if (!currentMindMap) return;
    var linesContainer = document.getElementById('mindMapLines');
    if (!linesContainer) return;
    
    var centerNode = null;
    var otherNodes = [];
    
    if (currentMindMap.nodes) {
        for (var i = 0; i < currentMindMap.nodes.length; i++) {
            if (currentMindMap.nodes[i].isCenter) centerNode = currentMindMap.nodes[i];
            else otherNodes.push(currentMindMap.nodes[i]);
        }
    }
    
    drawDynamicLines(linesContainer, centerNode, otherNodes, currentMindMap.subNodes);
}

// ─── Sub-node addition ────────────────────────────────────────────────────────
function addSubNode(parentNodeId) {
    if (!currentMindMap) return;
    var text = prompt("Enter sub-node text:", "New Sub");
    if (!text) return;
    if (!currentMindMap.subNodes) currentMindMap.subNodes = {};
    if (!currentMindMap.subNodes[parentNodeId]) currentMindMap.subNodes[parentNodeId] = [];
    currentMindMap.subNodes[parentNodeId].push({
        id: Date.now() + Math.random(),
        text: text,
        parentId: parentNodeId
    });
    triggerAutoSave();
    layoutNodes();
}

function addSubNodeToSelected() {
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) {
        alert('Please select a node or sub-node first by clicking on it');
        return;
    }
    addSubNode(targetId === 'center' ? 'center' : targetId);
}

// ─── Drag handlers ────────────────────────────────────────────────────────────
function makeDraggable(element, node, isCenter) {
    var dragging = false;
    var startX, startY, initLeft, initTop;

    element.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('node-insert-btn') ||
            e.target.classList.contains('node-attachment-icon')) return;
        if (e.target !== element && !element.contains(e.target)) return;
        if (e.target.getAttribute('contenteditable') === 'true' && e.detail === 1) return;
        e.preventDefault();
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        initLeft = parseFloat(element.style.left) || 0;
        initTop  = parseFloat(element.style.top)  || 0;
        element.style.cursor = 'grabbing';
        element.style.zIndex = 50;
    });

    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var nl = initLeft + (e.clientX - startX);
        var nt = initTop  + (e.clientY - startY);
        element.style.left = nl + 'px';
        element.style.top  = nt + 'px';
        if (node) {
            node.x = nl + (isCenter ? CNW_HALF : NW_HALF);
            node.y = nt + (isCenter ? CNH_HALF : NH_HALF);
        }
        redrawLinesOnly();
    });

    document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        element.style.cursor = '';
        element.style.zIndex = '';
        saveMindMapData();
        triggerAutoSave();
    });
}

function makeDraggableSubNode(element, node, parentId) {
    var dragging = false;
    var startX, startY, initLeft, initTop;

    element.addEventListener('mousedown', function(e) {
        if (e.target.getAttribute('contenteditable') === 'true' && e.detail === 1) return;
        e.preventDefault();
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        initLeft = parseFloat(element.style.left) || 0;
        initTop  = parseFloat(element.style.top)  || 0;
        element.style.cursor = 'grabbing';
        element.style.zIndex = 50;
    });

    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var nl = initLeft + (e.clientX - startX);
        var nt = initTop  + (e.clientY - startY);
        element.style.left = nl + 'px';
        element.style.top  = nt + 'px';
        node.x = nl + SN_W_HALF;
        node.y = nt + SN_H_HALF;
        redrawLinesOnly();
    });

    document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        element.style.cursor = '';
        element.style.zIndex = '';
        saveMindMapData();
        triggerAutoSave();
    });
}

// ─── Selection ────────────────────────────────────────────────────────────────
function selectNode(nodeId) {
    selectedNodeId = nodeId;
    selectedSubNodeId = null;
    var all = document.querySelectorAll('.mindmap-node:not(.subnode)');
    for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute('data-id') == nodeId) all[i].classList.add('selected');
        else all[i].classList.remove('selected');
    }
}

function selectSubNode(nodeId) {
    selectedSubNodeId = nodeId;
    selectedNodeId = null;
    var all = document.querySelectorAll('.mindmap-node.subnode');
    for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute('data-id') == nodeId) all[i].classList.add('selected');
        else all[i].classList.remove('selected');
    }
}

// ─── Add / delete nodes ───────────────────────────────────────────────────────
function addMindMapNode() {
    if (!currentMindMap) return;
    var text = prompt("Enter node text:", "New Node");
    if (!text) return;
    if (!currentMindMap.nodes) currentMindMap.nodes = [];
    // Leave x/y undefined so reflowTwoWay (or fallback) assigns the correct position.
    currentMindMap.nodes.push({ id: Date.now(), text: text, isCenter: false });
    layoutNodes();
    triggerAutoSave();
}

function deleteSelectedNode() {
    if (!selectedNodeId && !selectedSubNodeId) {
        alert("Please select a node first by clicking on it.");
        return;
    }
    if (selectedNodeId) {
        if (!confirm("Delete this node and all its sub-nodes?")) return;
        if (currentMindMap.nodes) {
            currentMindMap.nodes = currentMindMap.nodes.filter(function(n) { return n.id != selectedNodeId; });
        }
        if (currentMindMap.subNodes && currentMindMap.subNodes[selectedNodeId]) {
            delete currentMindMap.subNodes[selectedNodeId];
        }
        selectedNodeId = null;
    } else if (selectedSubNodeId) {
        if (!confirm("Delete this sub-node and all its child nodes?")) return;

        function deleteSubTree(rootId) {
            if (!currentMindMap.subNodes || !currentMindMap.subNodes[rootId]) return;
            var kids = currentMindMap.subNodes[rootId].slice();
            for (var k = 0; k < kids.length; k++) deleteSubTree(kids[k].id);
            delete currentMindMap.subNodes[rootId];
        }

        deleteSubTree(selectedSubNodeId);
        var parentOfSelected = findSubNodeParentId(selectedSubNodeId);
        if (parentOfSelected && currentMindMap.subNodes[parentOfSelected]) {
            var arr = currentMindMap.subNodes[parentOfSelected];
            for (var j = 0; j < arr.length; j++) {
                if (arr[j].id == selectedSubNodeId) {
                    arr.splice(j, 1);
                    break;
                }
            }
        }
        selectedSubNodeId = null;
    }
    layoutNodes();
    triggerAutoSave();
}

function resetMindMapView() { layoutNodes(); }

// ─── Zoom ─────────────────────────────────────────────────────────────────────
var mindMapZoomLevel = 1;
function zoomMindMapIn()  { if (mindMapZoomLevel < 2.5) { mindMapZoomLevel += 0.1; applyMindMapZoom(); } }
function zoomMindMapOut() { if (mindMapZoomLevel > 0.3) { mindMapZoomLevel -= 0.1; applyMindMapZoom(); } }
function resetMindMapZoom() { mindMapZoomLevel = 1; applyMindMapZoom(); }
function applyMindMapZoom() {
    var canvas = document.getElementById('mindMapCanvas');
    if (!canvas) return;
    canvas.style.transform = 'scale(' + mindMapZoomLevel + ')';
    canvas.style.transformOrigin = '0 0';
    var sp = document.getElementById('mindMapZoomLevel');
    if (sp) sp.textContent = Math.round(mindMapZoomLevel * 100) + '%';
    setTimeout(redrawLinesOnly, 50);
}

// ─── Delete mind map ──────────────────────────────────────────────────────────
async function deleteMindMap(id, e) {
    if (e) e.stopPropagation();
    if (confirm("Delete this mind map? This action cannot be undone.")) {
        await deletePhysicalFile(id, 'mindmap');
        updateFileExplorer();
        render();
    }
}

// ─── Insert Menu ──────────────────────────────────────────────────────────────
function toggleInsertMenu() {
    var insertMenu = document.getElementById('insertMenu');
    if (!insertMenu) return;
    var btn = document.getElementById('insertBtn');
    if (!btn) return;
    if (insertMenu.style.display === 'block') {
        insertMenu.style.display = 'none';
        return;
    }
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) {
        alert('Please select a node or sub-node first by clicking on it, then use Insert.');
        return;
    }
    var rect = btn.getBoundingClientRect();
    insertMenu.style.position = 'fixed';
    insertMenu.style.top  = (rect.bottom + 6) + 'px';
    insertMenu.style.left = rect.left + 'px';
    insertMenu.style.right = 'auto';
    insertMenu.style.display = 'block';
}

function showNodeInsertMenu(e) {
    var insertMenu = document.getElementById('insertMenu');
    if (!insertMenu) return;
    if (insertMenu.style.display === 'block') {
        insertMenu.style.display = 'none';
        return;
    }
    insertMenu.style.position = 'fixed';
    insertMenu.style.top  = e.clientY + 'px';
    insertMenu.style.left = e.clientX + 'px';
    insertMenu.style.right = 'auto';
    insertMenu.style.display = 'block';
}

document.addEventListener('click', function(e) {
    var insertMenu = document.getElementById('insertMenu');
    var insertBtn  = document.getElementById('insertBtn');
    if (!insertMenu) return;
    if (insertMenu.style.display !== 'block') return;
    if (insertMenu.contains(e.target)) return;
    if (insertBtn && insertBtn.contains(e.target)) return;
    if (e.target.classList.contains('node-insert-btn')) return;
    insertMenu.style.display = 'none';
});

// ─── Insert functions ─────────────────────────────────────────────────────────
function insertPhoto() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) { alert('Please select a node or sub-node first by clicking on it'); if (insertMenu) insertMenu.style.display = 'none'; return; }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            addAttachmentToNode(targetId, 'image', ev.target.result);
            if (insertMenu) insertMenu.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };
    input.click();
    if (insertMenu) insertMenu.style.display = 'none';
}

function insertHyperlink() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) {
        alert('Please select a node or sub-node first by clicking on it');
        if (insertMenu) insertMenu.style.display = 'none';
        return;
    }
    var select = document.getElementById('internalFileSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Select internal note/mind map --</option>';
        if (typeof notes !== 'undefined' && notes) {
            for (var i = 0; i < notes.length; i++) {
                var opt = document.createElement('option');
                opt.value = 'note:' + notes[i].id;
                opt.textContent = '📝 ' + notes[i].name;
                select.appendChild(opt);
            }
        }
        if (typeof mindMaps !== 'undefined' && mindMaps) {
            for (var j = 0; j < mindMaps.length; j++) {
                if (currentMindMap && mindMaps[j].id === currentMindMap.id) continue;
                var opt2 = document.createElement('option');
                opt2.value = 'mindmap:' + mindMaps[j].id;
                opt2.textContent = '🧠 ' + mindMaps[j].name;
                select.appendChild(opt2);
            }
        }
    }
    var urlInput = document.getElementById('hyperlinkUrl');
    if (urlInput) urlInput.value = '';
    var modal = document.getElementById('hyperlinkModal');
    if (modal) modal.classList.add('show');
    if (insertMenu) insertMenu.style.display = 'none';
}

function closeHyperlinkModal() {
    var modal = document.getElementById('hyperlinkModal');
    if (modal) modal.classList.remove('show');
    var urlInput = document.getElementById('hyperlinkUrl');
    if (urlInput) urlInput.value = '';
    var openBoth = document.getElementById('nodeHyperlinkOpenBoth');
    if (openBoth) openBoth.checked = false;
}

function confirmHyperlink() {
    var urlInput = document.getElementById('hyperlinkUrl');
    var url = urlInput ? urlInput.value.trim() : '';
    var select = document.getElementById('internalFileSelect');
    var internal = select ? select.value : '';
    var link = internal ? internal : normalizeExternalUrl(url);
    if (!link) {
        alert('Please enter a URL or select an internal file');
        return;
    }
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) {
        alert('No node selected. Please close this dialog, select a node or sub-node, and try again.');
        closeHyperlinkModal();
        return;
    }
    var openBoth = document.getElementById('nodeHyperlinkOpenBoth');
    addAttachmentToNode(targetId, 'link', {
        url: link,
        openBoth: !!(openBoth && openBoth.checked)
    });
    closeHyperlinkModal();
}

function insertNoteComment() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) { alert('Please select a node or sub-node first by clicking on it'); if (insertMenu) insertMenu.style.display = 'none'; return; }
    var comment = prompt('Enter your note/comment:');
    if (comment && comment.trim()) {
        addAttachmentToNode(targetId, 'comment', comment.trim());
    }
    if (insertMenu) insertMenu.style.display = 'none';
}

function insertPDF() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) { alert('Please select a node or sub-node first by clicking on it'); if (insertMenu) insertMenu.style.display = 'none'; return; }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            addAttachmentToNode(targetId, 'pdf', ev.target.result);
            if (insertMenu) insertMenu.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };
    input.click();
    if (insertMenu) insertMenu.style.display = 'none';
}

function openSketchInsert() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) { alert('Please select a node or sub-node first by clicking on it'); if (insertMenu) insertMenu.style.display = 'none'; return; }
    if (typeof openSketchForNode === 'function') {
        openSketchForNode(function(sketchData) {
            if (targetId && sketchData) {
                addAttachmentToNode(targetId, 'sketch', sketchData);
            }
        });
    }
    if (insertMenu) insertMenu.style.display = 'none';
}

function insertAudio() {
    var insertMenu = document.getElementById('insertMenu');
    var targetId = selectedSubNodeId || selectedNodeId;
    if (!targetId) { alert('Please select a node or sub-node first by clicking on it'); if (insertMenu) insertMenu.style.display = 'none'; return; }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            addAttachmentToNode(targetId, 'audio', ev.target.result);
            if (insertMenu) insertMenu.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ─── Attachment management ────────────────────────────────────────────────────
function addAttachmentToNode(nodeId, type, data) {
    if (!currentMindMap) return;
    if (nodeId === 'center') {
        if (!currentMindMap.centerAttachments) currentMindMap.centerAttachments = [];
        currentMindMap.centerAttachments.push({
            id: Date.now() + Math.random(),
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        });
        renderMindMap();
        triggerAutoSave();
        return;
    }
    if (!currentMindMap.nodeAttachments) currentMindMap.nodeAttachments = {};
    if (!currentMindMap.nodeAttachments[nodeId]) currentMindMap.nodeAttachments[nodeId] = [];
    currentMindMap.nodeAttachments[nodeId].push({
        id: Date.now() + Math.random(),
        type: type,
        data: data,
        timestamp: new Date().toISOString()
    });
    renderMindMap();
    triggerAutoSave();
}

function openAttachment(attachment) {
    if (attachment.type === 'image' || attachment.type === 'sketch') {
        var win = window.open();
        win.document.write('<html><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="' + attachment.data + '" style="max-width:100%;max-height:100vh;"></body></html>');
    } else if (attachment.type === 'link') {
        var linkData = typeof attachment.data === 'string' ? { url: attachment.data, openBoth: false } : attachment.data;
        if (linkData.url.startsWith('note:')) {
            var noteId = linkData.url.split(':')[1];
            var found = null;
            if (typeof notes !== 'undefined') {
                for (var i = 0; i < notes.length; i++) { if (notes[i].id == noteId) { found = notes[i]; break; } }
            }
            if (found && typeof openNoteObj === 'function') openNoteObj(found);
            else alert('Note not found');
        } else if (linkData.url.startsWith('mindmap:')) {
            var mmId = linkData.url.split(':')[1];
            var mm = null;
            if (typeof mindMaps !== 'undefined') {
                for (var j = 0; j < mindMaps.length; j++) { if (mindMaps[j].id == mmId) { mm = mindMaps[j]; break; } }
            }
            if (mm && typeof openMindMap === 'function') openMindMap(mm);
            else alert('Mind map not found');
        } else {
            if (linkData.openBoth) window.location.href = linkData.url;
            window.open(linkData.url, '_blank', 'noopener,noreferrer');
        }
    } else if (attachment.type === 'comment') {
        alert('💬 Comment:\n\n' + attachment.data);
    } else if (attachment.type === 'pdf') {
        var win2 = window.open();
        win2.document.write('<html><body style="margin:0;height:100vh;"><iframe src="' + attachment.data + '" style="width:100%;height:100%;border:none;"></iframe></body></html>');
    } else if (attachment.type === 'audio') {
        var win3 = window.open();
        win3.document.write('<html><body style="font-family:Segoe UI;padding:24px;background:#111;color:#eee;"><h3>Audio</h3><audio controls autoplay src="' + attachment.data + '" style="width:100%;max-width:540px;"></audio></body></html>');
    }
}