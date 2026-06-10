const canvas = document.querySelector("#graphCanvas");
const ctx = canvas.getContext("2d");
const summary = document.querySelector("#graphSummary");
const searchInput = document.querySelector("#searchInput");
const edgeFilter = document.querySelector("#edgeFilter");
const distanceRange = document.querySelector("#distanceRange");
const graphFileInput = document.querySelector("#graphFileInput");
const importButton = document.querySelector("#importButton");
const toolbarToggleButton = document.querySelector("#toolbarToggleButton");
const fitButton = document.querySelector("#fitButton");
const reloadButton = document.querySelector("#reloadButton");
const exportButton = document.querySelector("#exportButton");
const emptyState = document.querySelector("#emptyState");
const appShell = document.querySelector(".app-shell");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedMeta = document.querySelector("#selectedMeta");
const connectionList = document.querySelector("#connectionList");
const clearSelection = document.querySelector("#clearSelection");
const entityForm = document.querySelector("#entityForm");
const entityNameInput = document.querySelector("#entityNameInput");
const entityDescriptionInput = document.querySelector("#entityDescriptionInput");
const saveEntityButton = document.querySelector("#saveEntityButton");
const resetEntityButton = document.querySelector("#resetEntityButton");
const pinNodeButton = document.querySelector("#pinNodeButton");
const removeNodeButton = document.querySelector("#removeNodeButton");
const toggleLayoutButton = document.querySelector("#toggleLayoutButton");
const relationshipTarget = document.querySelector("#relationshipTarget");
const relationshipText = document.querySelector("#relationshipText");
const addRelationshipButton = document.querySelector("#addRelationshipButton");
const addEntityNameInput = document.querySelector("#addEntityNameInput");
const addEntityDescriptionInput = document.querySelector("#addEntityDescriptionInput");
const addEntityButton = document.querySelector("#addEntityButton");

let sourceGraph = { nodes: [], links: [] };
let visibleGraph = { nodes: [], links: [] };
let selectedNode = null;
let hoveredNode = null;
let hoveredLink = null;
let transform = { x: 0, y: 0, scale: 1 };
let pointer = { x: 0, y: 0, down: false, dragNode: null, panning: false };
let animationFrame = null;
let simulationTimer = null;
let importedGraph = null;
let importedFileName = "";
let hasLocalEdits = false;
let toolbarCollapsed = false;
let layoutRunning = true;

const palette = {
  node: "#dfe7f1",
  accent: "#59c7a5",
  root: "#59c7a5",
  hit: "#eecc65",
  unknown: "#ee7b6a",
  link: "rgba(177, 188, 202, 0.42)",
  text: "#f2f4f7",
  muted: "#a9b0bb",
  glow: "rgba(89, 199, 165, 0.22)"
};

function loadGraph(data, fileName = "") {
  stopSimulation();
  summary.textContent = "Loading graph...";
  validateGraph(data);
  ensureGraphIndexes(data);
  importedGraph = data;
  importedFileName = fileName;
  hasLocalEdits = false;
  sourceGraph = normalizeGraph(data);
  selectedNode = sourceGraph.nodes[0] || null;
  applyFilters();
  updateRelationshipTargetOptions();
  updateDetails();
  setEntityCreatorEnabled(true);
  fitToView();
  startSimulation();
  reloadButton.disabled = false;
  exportButton.disabled = false;
}

function computeRadius(node, linkCount) {
  const base = node.id === 0 || node.relationship === "Person of Interest" ? 24 : 20;
  return base + Math.min(22, linkCount * 4);
}

function normalizeGraph(data) {
  const nodes = Object.entries(data.entities || {}).map(([entityKey, entity], index) => ({
    ...entity,
    id: Number(entity.id),
    key: String(entityKey),
    title: entity.title || `Entity ${entity.id}`,
    radius: 20,
    x: Math.cos(index * 1.91) * (90 + index * 2.5),
    y: Math.sin(index * 1.91) * (90 + index * 2.5),
    vx: 0,
    vy: 0
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = (data.relationships || [])
    .map((relationship, index) => {
      const source = byId.get(Number(relationship.from));
      const target = byId.get(Number(relationship.to));
      if (!source || !target) return null;
      return {
        id: `${relationship.from}-${relationship.to}-${index}`,
        source,
        target,
        relationship: relationship.relationship || "Unknown",
        original: relationship
      };
    })
    .filter(Boolean);

  const linkCount = new Map(nodes.map((node) => [node.id, 0]));
  for (const link of links) {
    linkCount.set(link.source.id, linkCount.get(link.source.id) + 1);
    linkCount.set(link.target.id, linkCount.get(link.target.id) + 1);
  }

  nodes.forEach((node) => {
    node.radius = computeRadius(node, linkCount.get(node.id) || 0);
  });

  return { nodes, links };
}

function ensureGraphIndexes(data) {
  if (!data.name_index || typeof data.name_index !== "object" || Array.isArray(data.name_index)) {
    data.name_index = {};
  }

  data.name_index = Object.values(data.entities || {}).reduce((index, entity) => {
    if (entity && entity.title && entity.id !== undefined) {
      index[entity.title] = entity.id;
    }
    return index;
  }, {});
}

function validateGraph(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Imported file must contain a JSON object.");
  }

  if (!data.entities || typeof data.entities !== "object" || Array.isArray(data.entities)) {
    throw new Error('Imported graph needs an "entities" object.');
  }

  if (!Array.isArray(data.relationships)) {
    throw new Error('Imported graph needs a "relationships" array.');
  }
}

function resetGraphState(message = "Import a graph JSON file") {
  stopSimulation();
  sourceGraph = { nodes: [], links: [] };
  visibleGraph = { nodes: [], links: [] };
  selectedNode = null;
  hoveredNode = null;
  importedGraph = null;
  importedFileName = "";
  hasLocalEdits = false;
  summary.textContent = message;
  emptyState.textContent = "Import a JSON graph to begin";
  emptyState.hidden = false;
  reloadButton.disabled = true;
  exportButton.disabled = true;
  updateDetails();
  setEntityCreatorEnabled(false);
  fitToView();
  queueDraw();
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const mode = edgeFilter.value;
  const matchingIds = new Set();

  sourceGraph.nodes.forEach((node) => {
    const haystack = `${node.title} ${node.relationship || ""} ${node.type || ""}`.toLowerCase();
    if (!query || haystack.includes(query)) matchingIds.add(node.id);
  });

  sourceGraph.links.forEach((link) => {
    if (query && String(link.relationship).toLowerCase().includes(query)) {
      matchingIds.add(link.source.id);
      matchingIds.add(link.target.id);
    }
  });

  const visibleIds = new Set(matchingIds);
  if (query) {
    sourceGraph.links.forEach((link) => {
      if (matchingIds.has(link.source.id) || matchingIds.has(link.target.id)) {
        visibleIds.add(link.source.id);
        visibleIds.add(link.target.id);
      }
    });
  }

  const linkAllowed = (link) => {
    const known = isKnownRelationship(link.relationship);
    return mode === "all" || (mode === "known" && known) || (mode === "unknown" && !known);
  };

  visibleGraph = {
    nodes: sourceGraph.nodes.filter((node) => visibleIds.has(node.id)),
    links: sourceGraph.links.filter((link) => visibleIds.has(link.source.id) && visibleIds.has(link.target.id) && linkAllowed(link))
  };

  if (selectedNode && !visibleGraph.nodes.includes(selectedNode)) {
    selectedNode = visibleGraph.nodes[0] || null;
  }

  const knownCount = sourceGraph.links.filter((link) => isKnownRelationship(link.relationship)).length;
  const sourceName = importedFileName ? ` | ${importedFileName}` : "";
  const editState = hasLocalEdits ? " | edited" : "";
  summary.textContent = `${sourceGraph.nodes.length} entities | ${sourceGraph.links.length} relationships | ${knownCount} known${sourceName}${editState}`;
  emptyState.hidden = visibleGraph.nodes.length > 0;
  updateDetails();
  updateRelationshipTargetOptions();
  queueDraw();
}

function isKnownRelationship(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized && normalized !== "unknown" && !normalized.includes("couldn't find") && !normalized.includes("does not mention");
}

function updateRelationshipTargetOptions() {
  relationshipTarget.innerHTML = "";

  if (!selectedNode) {
    return;
  }

  const options = sourceGraph.nodes
    .filter((node) => node !== selectedNode)
    .sort((a, b) => a.title.localeCompare(b.title));

  for (const node of options) {
    const option = document.createElement("option");
    option.value = node.key;
    option.textContent = node.title;
    relationshipTarget.append(option);
  }
}


function addRelationship() {
  if (!selectedNode || !importedGraph) return;

  const targetKey = relationshipTarget.value;
  const targetNode = sourceGraph.nodes.find((node) => node.key === targetKey);
  if (!targetNode || targetNode === selectedNode) {
    summary.textContent = "Select a different target entity.";
    return;
  }

  const relationship = relationshipText.value.trim() || "Unknown";
  const existing = importedGraph.relationships.some((rel) => (
    (String(rel.from) === String(selectedNode.id) && String(rel.to) === String(targetNode.id)) ||
    (String(rel.from) === String(targetNode.id) && String(rel.to) === String(selectedNode.id))
  ));

  if (existing) {
    summary.textContent = "This relationship already exists.";
    return;
  }

  const newRelationship = {
    from: selectedNode.id,
    to: targetNode.id,
    relationship
  };

  importedGraph.relationships = importedGraph.relationships || [];
  importedGraph.relationships.push(newRelationship);

  sourceGraph.links.push({
    id: `${selectedNode.id}-${targetNode.id}-${sourceGraph.links.length}`,
    source: selectedNode,
    target: targetNode,
    relationship,
    original: newRelationship
  });

  updateNodeRadii();
  relationshipText.value = "";
  hasLocalEdits = true;
  applyFilters();
  updateDetails();
  queueDraw();
}

function toggleNodePin() {
  if (!selectedNode) return;
  selectedNode.pinned = !selectedNode.pinned;
  pinNodeButton.classList.toggle("active", selectedNode.pinned);
  pinNodeButton.querySelector(".button-label").textContent = selectedNode.pinned ? "Pinned" : "Pin";
  if (selectedNode.pinned) {
    selectedNode.vx = 0;
    selectedNode.vy = 0;
  }
}

function toggleLayout() {
  if (layoutRunning) {
    stopSimulation();
    toggleLayoutButton.querySelector(".button-label").textContent = "Resume";
    toggleLayoutButton.title = "Resume layout";
    toggleLayoutButton.setAttribute("aria-label", "Resume layout");
    layoutRunning = false;
  } else {
    startSimulation();
    toggleLayoutButton.querySelector(".button-label").textContent = "Pause";
    toggleLayoutButton.title = "Pause layout";
    toggleLayoutButton.setAttribute("aria-label", "Pause layout");
    layoutRunning = true;
  }
}

function focusOnNode(node) {
  selectedNode = node;
  updateDetails();
  centerOnNode(node);
  queueDraw();
}

function centerOnNode(node) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  transform.x = rect.width / 2 - node.x * transform.scale;
  transform.y = rect.height / 2 - node.y * transform.scale;
}

function startSimulation() {
  simulationTimer = window.setInterval(tick, 16);
}

function stopSimulation() {
  if (simulationTimer) window.clearInterval(simulationTimer);
}

function tick() {
  const distance = Number(distanceRange.value);
  const nodes = visibleGraph.nodes;
  const links = visibleGraph.links;

  for (const link of links) {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const length = Math.hypot(dx, dy) || 1;
    const force = (length - distance) * 0.004;
    const fx = (dx / length) * force;
    const fy = (dy / length) * force;
    link.source.vx += fx;
    link.source.vy += fy;
    link.target.vx -= fx;
    link.target.vy -= fy;
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(100, dx * dx + dy * dy);
      const force = Math.min(3.2, 1600 / distanceSq);
      const length = Math.sqrt(distanceSq);
      const fx = (dx / length) * force;
      const fy = (dy / length) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const node of nodes) {
    if (pointer.dragNode === node || node.pinned) {
      if (node.pinned) {
        node.vx = 0;
        node.vy = 0;
      }
      continue;
    }
    node.vx += -node.x * 0.0008;
    node.vy += -node.y * 0.0008;
    node.vx *= 0.86;
    node.vy *= 0.86;
    node.x += node.vx;
    node.y += node.vy;
  }

  queueDraw();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  queueDraw();
}

function queueDraw() {
  if (animationFrame) return;
  animationFrame = window.requestAnimationFrame(draw);
}

function draw() {
  animationFrame = null;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  for (const link of visibleGraph.links) {
    const selected = selectedNode && (link.source === selectedNode || link.target === selectedNode);
    const hovered = hoveredLink === link;
    const isOtherSelected = selected && !hovered && hoveredLink;
    ctx.lineWidth = hovered ? 2.8 / transform.scale : selected ? 1.8 / transform.scale : 1.4 / transform.scale;
    ctx.strokeStyle = hovered ? palette.hit : isOtherSelected ? palette.link : selected ? palette.accent : palette.link;
    ctx.globalAlpha = hovered ? 1 : isOtherSelected ? 0.22 : selected ? 0.92 : 0.58;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const node of visibleGraph.nodes) {
    const isSelected = node === selectedNode;
    const isHovered = node === hoveredNode;
    const isRoot = node.id === 0 || node.relationship === "Person of Interest";
    const fill = isSelected || isHovered ? palette.hit : isRoot ? palette.root : palette.node;

    if (isSelected) {
      ctx.fillStyle = palette.glow;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111317";
    ctx.lineWidth = 2.2 / transform.scale;
    ctx.stroke();

    if (transform.scale > 0.75 || isSelected || isHovered) {
      const baseFontSize = Math.max(8, 12 / transform.scale);
      ctx.font = `${baseFontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = String(node.title).split(/\s+/).filter(Boolean);
      if (words.length) {
        const longestWord = words.reduce((a, b) => {
          return ctx.measureText(b).width > ctx.measureText(a).width ? b : a;
        }, words[0]);
        const longestWordWidth = ctx.measureText(longestWord).width;
        const targetWidth = node.radius * 1.6;
        if (longestWordWidth > targetWidth) {
          const shrink = targetWidth / longestWordWidth;
          const reducedFontSize = Math.max(8, Math.floor(baseFontSize * Math.min(1, shrink)));
          ctx.font = `${reducedFontSize}px Inter, sans-serif`;
        }
      }

      const labelColor = fill === palette.node ? "#111317" : palette.text;
      ctx.fillStyle = labelColor;
      wrapLabel(node.title, node.x, node.y, node.radius * 1.6, transform.scale);
    }
  }

  ctx.restore();
}

function wrapLabel(text, x, y, maxWidth, scale = 1) {
  const effectiveMaxWidth = maxWidth * (scale < 0.8 ? 0.78 : 0.95);
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = "";
  let lines = [];
  let usedWords = 0;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > effectiveMaxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= 1 && scale < 0.8) {
        break;
      }
    } else {
      line = test;
    }
    usedWords += 1;
  }
  if (line) lines.push(line);

  const maxLines = scale < 0.8 ? 1 : 2;
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
  }

  const remainderExists = usedWords < words.length || lines.length === maxLines && words.length > lines.join(" ").split(/\s+/).length;
  if (remainderExists) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = truncateText(lines[lastIndex], effectiveMaxWidth);
  }

  lines = lines.map((label) => truncateText(label, effectiveMaxWidth));

  const lineHeight = 14 / scale;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((label, index) => ctx.fillText(label, x, startY + index * lineHeight));
}

function truncateText(text, maxWidth) {
  const ellipsis = "...";
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let low = 0;
  let high = text.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best > 0 ? `${text.slice(0, best)}${ellipsis}` : ellipsis;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function worldPoint(point) {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale
  };
}

function findNode(point) {
  const world = worldPoint(point);
  for (let i = visibleGraph.nodes.length - 1; i >= 0; i -= 1) {
    const node = visibleGraph.nodes[i];
    if (Math.hypot(world.x - node.x, world.y - node.y) <= node.radius + 8 / transform.scale) {
      return node;
    }
  }
  return null;
}

function updateDetails() {
  if (!selectedNode) {
    selectedTitle.textContent = "Select a node";
    selectedMeta.innerHTML = metaRows({ type: "None", mentions: "0", relationship: "None", connections: "0" });
    connectionList.innerHTML = "";
    setEntityFormEnabled(false);
    entityNameInput.value = "";
    entityDescriptionInput.value = "";
    updateRelationshipTargetOptions();
    return;
  }

  const connections = sourceGraph.links
    .filter((link) => link.source === selectedNode || link.target === selectedNode)
    .map((link) => ({
      node: link.source === selectedNode ? link.target : link.source,
      link,
      direction: link.source === selectedNode ? "outgoing" : "incoming"
    }));

  selectedTitle.textContent = selectedNode.title;
  setEntityFormEnabled(true);
  entityNameInput.value = selectedNode.title;
  entityDescriptionInput.value = selectedNode.relationship || "";
  selectedMeta.innerHTML = metaRows({
    type: selectedNode.type || "Entity",
    mentions: selectedNode.mentions || 0,
    relationship: selectedNode.relationship || "Unknown",
    connections: connections.length
  });
  connectionList.innerHTML = "";

  if (!connections.length) {
    connectionList.innerHTML = "<li>No relationships recorded for this entity.</li>";
  } else {
    for (const connection of connections) {
      const item = document.createElement("li");
      const titleButton = document.createElement("button");
      titleButton.type = "button";
      titleButton.className = "connection-target";
      titleButton.textContent = connection.node.title;
      titleButton.addEventListener("click", () => focusOnNode(connection.node));

      const relationship = document.createElement("div");
      relationship.className = "connection-relationship";
      relationship.textContent = connection.link.relationship || "Unknown";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "connection-remove";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => removeRelationship(connection.link));

      item.addEventListener("mouseenter", () => {
        hoveredLink = connection.link;
        queueDraw();
      });
      item.addEventListener("mouseleave", () => {
        hoveredLink = null;
        queueDraw();
      });
      item.addEventListener("focusin", () => {
        hoveredLink = connection.link;
        queueDraw();
      });
      item.addEventListener("focusout", () => {
        hoveredLink = null;
        queueDraw();
      });

      item.append(titleButton, relationship, removeButton);
      connectionList.append(item);
    }
  }
}

function setEntityFormEnabled(enabled) {
  entityNameInput.disabled = !enabled;
  entityDescriptionInput.disabled = !enabled;
  saveEntityButton.disabled = !enabled;
  resetEntityButton.disabled = !enabled;
  pinNodeButton.disabled = !enabled;
  removeNodeButton.disabled = !enabled;
  relationshipTarget.disabled = !enabled;
  relationshipText.disabled = !enabled;
  addRelationshipButton.disabled = !enabled;
}

function setEntityCreatorEnabled(enabled) {
  addEntityNameInput.disabled = !enabled;
  addEntityDescriptionInput.disabled = !enabled;
  addEntityButton.disabled = !enabled;
}

function saveSelectedEntity() {
  if (!selectedNode || !importedGraph) return;

  const name = entityNameInput.value.trim();
  const description = entityDescriptionInput.value.trim();
  if (!name) {
    summary.textContent = "Name is required before saving.";
    entityNameInput.focus();
    return;
  }

  const entity = importedGraph.entities[selectedNode.key];
  if (!entity) {
    summary.textContent = "Selected entity could not be found in the imported JSON.";
    return;
  }

  const duplicate = Object.values(importedGraph.entities).find((item) => (
    String(item.id) !== String(entity.id) && String(item.title || "").trim().toLowerCase() === name.toLowerCase()
  ));
  if (duplicate) {
    summary.textContent = `"${name}" already exists in this graph.`;
    entityNameInput.focus();
    return;
  }

  entity.title = name;
  entity.relationship = description || "Unknown";
  entity.relationship_known = isKnownRelationship(entity.relationship);
  selectedNode.title = entity.title;
  selectedNode.relationship = entity.relationship;
  selectedNode.relationship_known = entity.relationship_known;
  ensureGraphIndexes(importedGraph);
  hasLocalEdits = true;
  applyFilters();
  updateDetails();
  queueDraw();
}

function removeSelectedNode() {
  if (!selectedNode || !importedGraph) return;

  const confirmed = window.confirm(`Remove "${selectedNode.title}" and all of its relationships from this graph?`);
  if (!confirmed) return;

  deleteNode(selectedNode);
  selectedNode = null;
  hasLocalEdits = true;
  applyFilters();
  queueDraw();
}

function addEntity() {
  if (!importedGraph) return;

  const name = addEntityNameInput.value.trim();
  const description = addEntityDescriptionInput.value.trim();
  if (!name) {
    summary.textContent = "Name is required to add a new entity.";
    addEntityNameInput.focus();
    return;
  }

  const duplicate = Object.values(importedGraph.entities || {}).find((entity) => String(entity.title || "").trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    summary.textContent = `Entity "${name}" already exists in this graph.`;
    addEntityNameInput.focus();
    return;
  }

  const nextId = Number.isInteger(importedGraph.curr_id) ? importedGraph.curr_id : Math.max(-1, ...Object.values(importedGraph.entities || {}).map((entity) => Number(entity.id) || -1)) + 1;
  importedGraph.curr_id = nextId + 1;
  const entityKey = String(nextId);
  const entity = {
    id: nextId,
    type: "Entity",
    title: name,
    relationship: description || "Unknown",
    relationship_known: isKnownRelationship(description || "Unknown"),
    mentions: 1,
    context: null
  };

  importedGraph.entities = importedGraph.entities || {};
  importedGraph.entities[entityKey] = entity;

  const newNode = {
    ...entity,
    key: entityKey,
    radius: computeRadius({ ...entity, id: nextId, relationship: entity.relationship }, 0),
    x: (selectedNode?.x || 0) + 40,
    y: (selectedNode?.y || 0) + 40,
    vx: 0,
    vy: 0
  };

  sourceGraph.nodes.push(newNode);
  updateNodeRadii();
  ensureGraphIndexes(importedGraph);
  selectedNode = newNode;
  addEntityNameInput.value = "";
  addEntityDescriptionInput.value = "";
  hasLocalEdits = true;
  applyFilters();
  updateDetails();
  centerOnNode(newNode);
  queueDraw();
}

function removeRelationship(link) {
  if (!link || !importedGraph) return;
  const confirmed = window.confirm(`Remove the relationship between "${link.source.title}" and "${link.target.title}"?`);
  if (!confirmed) return;

  deleteRelationship(link);
  updateNodeRadii();
  hasLocalEdits = true;
  applyFilters();
  updateDetails();
  queueDraw();
}

function deleteRelationship(link) {
  sourceGraph.links = sourceGraph.links.filter((item) => item !== link);
  if (Array.isArray(importedGraph.relationships)) {
    importedGraph.relationships = importedGraph.relationships.filter((relationship) => {
      const fromId = String(relationship.from);
      const toId = String(relationship.to);
      return !(fromId === String(link.source.id) && toId === String(link.target.id)) && !(fromId === String(link.target.id) && toId === String(link.source.id));
    });
  }
}

function deleteNode(node) {
  sourceGraph.nodes = sourceGraph.nodes.filter((item) => item !== node);
  sourceGraph.links = sourceGraph.links.filter((link) => link.source !== node && link.target !== node);

  if (importedGraph?.entities && importedGraph.entities[node.key] !== undefined) {
    delete importedGraph.entities[node.key];
  }

  if (Array.isArray(importedGraph?.relationships)) {
    importedGraph.relationships = importedGraph.relationships.filter((relationship) => {
      const fromId = Number(relationship.from);
      const toId = Number(relationship.to);
      return fromId !== Number(node.id) && toId !== Number(node.id);
    });
  }

  ensureGraphIndexes(importedGraph);
  updateNodeRadii();
}

function toggleToolbar() {
  toolbarCollapsed = !toolbarCollapsed;
  if (!appShell) return;
  appShell.dataset.toolbarCollapsed = toolbarCollapsed ? "true" : "false";
  toolbarToggleButton.setAttribute("aria-expanded", String(!toolbarCollapsed));
  toolbarToggleButton.title = toolbarCollapsed ? "Expand left menu" : "Collapse left menu";
  const svg = toolbarToggleButton.querySelector("svg");
  if (svg) {
    svg.style.transform = toolbarCollapsed ? "rotate(180deg)" : "rotate(0deg)";
  }
  resizeCanvas();
  fitToView();
  queueDraw();
}

function updateNodeRadii() {
  if (!sourceGraph) return;
  const linkCount = new Map(sourceGraph.nodes.map((node) => [node.id, 0]));
  for (const link of sourceGraph.links) {
    linkCount.set(link.source.id, linkCount.get(link.source.id) + 1);
    linkCount.set(link.target.id, linkCount.get(link.target.id) + 1);
  }
  sourceGraph.nodes.forEach((node) => {
    node.radius = computeRadius(node, linkCount.get(node.id) || 0);
  });
}

async function exportGraph() {
  if (!importedGraph) return;

  ensureGraphIndexes(importedGraph);
  const json = JSON.stringify(importedGraph, null, 2) + "\n";
  const baseName = importedFileName.replace(/\.json$/i, "") || "omni-net-graph";
  const fileName = `${baseName}-edited.json`;

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "JSON file",
            accept: { "application/json": [".json"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      hasLocalEdits = false;
      applyFilters();
      return;
    } catch (error) {
      if (error.name !== "AbortError") {
        showError(error);
      }
      // Fall back to the legacy download if the user cancels or if saving is aborted.
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  hasLocalEdits = false;
  applyFilters();
}

function metaRows(values) {
  return `
    <div><dt>Type</dt><dd>${escapeHtml(values.type)}</dd></div>
    <div><dt>Mentions</dt><dd>${escapeHtml(values.mentions)}</dd></div>
    <div><dt>Relationship</dt><dd>${escapeHtml(values.relationship)}</dd></div>
    <div><dt>Connections</dt><dd>${escapeHtml(values.connections)}</dd></div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fitToView() {
  const rect = canvas.getBoundingClientRect();
  if (!visibleGraph.nodes.length || !rect.width || !rect.height) return;

  const xs = visibleGraph.nodes.map((node) => node.x);
  const ys = visibleGraph.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const graphWidth = Math.max(1, maxX - minX + 120);
  const graphHeight = Math.max(1, maxY - minY + 120);
  const scale = Math.min(1.35, Math.max(0.25, Math.min(rect.width / graphWidth, rect.height / graphHeight)));

  transform.scale = scale;
  transform.x = rect.width / 2 - ((minX + maxX) / 2) * scale;
  transform.y = rect.height / 2 - ((minY + maxY) / 2) * scale;
  queueDraw();
}

canvas.addEventListener("pointerdown", (event) => {
  pointer = { ...canvasPoint(event), down: true, dragNode: findNode(canvasPoint(event)), panning: false };
  if (pointer.dragNode) {
    selectedNode = pointer.dragNode;
    updateDetails();
  } else {
    pointer.panning = true;
  }
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  hoveredNode = findNode(point);

  if (pointer.down && pointer.dragNode) {
    const world = worldPoint(point);
    pointer.dragNode.x = world.x;
    pointer.dragNode.y = world.y;
    pointer.dragNode.vx = 0;
    pointer.dragNode.vy = 0;
  } else if (pointer.down && pointer.panning) {
    transform.x += point.x - pointer.x;
    transform.y += point.y - pointer.y;
  }

  pointer.x = point.x;
  pointer.y = point.y;
  queueDraw();
});

canvas.addEventListener("pointerup", (event) => {
  pointer.down = false;
  pointer.dragNode = null;
  pointer.panning = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const point = canvasPoint(event);
  const before = worldPoint(point);
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  transform.scale = Math.min(2.6, Math.max(0.18, transform.scale * delta));
  transform.x = point.x - before.x * transform.scale;
  transform.y = point.y - before.y * transform.scale;
  queueDraw();
}, { passive: false });

searchInput.addEventListener("input", applyFilters);
edgeFilter.addEventListener("change", applyFilters);
distanceRange.addEventListener("input", queueDraw);
importButton.addEventListener("click", () => graphFileInput.click());
graphFileInput.addEventListener("change", async () => {
  const [file] = graphFileInput.files;
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    loadGraph(data, file.name);
  } catch (error) {
    showError(error);
  } finally {
    graphFileInput.value = "";
  }
});
fitButton.addEventListener("click", fitToView);
toggleLayoutButton.addEventListener("click", toggleLayout);
addRelationshipButton.addEventListener("click", addRelationship);
addEntityButton.addEventListener("click", addEntity);
toolbarToggleButton.addEventListener("click", toggleToolbar);
reloadButton.addEventListener("click", () => {
  if (!importedGraph) return;
  try {
    loadGraph(importedGraph, importedFileName);
  } catch (error) {
    showError(error);
  }
});
exportButton.addEventListener("click", exportGraph);
entityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSelectedEntity();
});
resetEntityButton.addEventListener("click", updateDetails);
pinNodeButton.addEventListener("click", toggleNodePin);
removeNodeButton.addEventListener("click", removeSelectedNode);
clearSelection.addEventListener("click", () => {
  selectedNode = null;
  updateDetails();
  queueDraw();
});
window.addEventListener("resize", () => {
  resizeCanvas();
  fitToView();
});

function showError(error) {
  summary.textContent = error.message;
  emptyState.textContent = "Graph data could not be loaded";
  emptyState.hidden = false;
}

resizeCanvas();
resetGraphState();
