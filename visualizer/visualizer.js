const canvas = document.querySelector("#graphCanvas");
const ctx = canvas.getContext("2d");
const summary = document.querySelector("#graphSummary");
const searchInput = document.querySelector("#searchInput");
const edgeFilter = document.querySelector("#edgeFilter");
const distanceRange = document.querySelector("#distanceRange");
const graphFileInput = document.querySelector("#graphFileInput");
const importButton = document.querySelector("#importButton");
const fitButton = document.querySelector("#fitButton");
const reloadButton = document.querySelector("#reloadButton");
const exportButton = document.querySelector("#exportButton");
const emptyState = document.querySelector("#emptyState");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedMeta = document.querySelector("#selectedMeta");
const connectionList = document.querySelector("#connectionList");
const clearSelection = document.querySelector("#clearSelection");
const entityForm = document.querySelector("#entityForm");
const entityNameInput = document.querySelector("#entityNameInput");
const entityDescriptionInput = document.querySelector("#entityDescriptionInput");
const saveEntityButton = document.querySelector("#saveEntityButton");
const resetEntityButton = document.querySelector("#resetEntityButton");

let sourceGraph = { nodes: [], links: [] };
let visibleGraph = { nodes: [], links: [] };
let selectedNode = null;
let hoveredNode = null;
let transform = { x: 0, y: 0, scale: 1 };
let pointer = { x: 0, y: 0, down: false, dragNode: null, panning: false };
let animationFrame = null;
let simulationTimer = null;
let importedGraph = null;
let importedFileName = "";
let hasLocalEdits = false;

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
  updateDetails();
  fitToView();
  startSimulation();
  reloadButton.disabled = false;
  exportButton.disabled = false;
}

function normalizeGraph(data) {
  const nodes = Object.entries(data.entities || {}).map(([entityKey, entity], index) => ({
    ...entity,
    id: Number(entity.id),
    key: String(entityKey),
    title: entity.title || `Entity ${entity.id}`,
    radius: index === 0 ? 14 : 8 + Math.min(8, Number(entity.mentions || 1) * 1.5),
    x: Math.cos(index * 1.91) * (90 + index * 2.5),
    y: Math.sin(index * 1.91) * (90 + index * 2.5),
    vx: 0,
    vy: 0
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = (data.relationships || [])
    .map((relationship) => ({
      source: byId.get(Number(relationship.from)),
      target: byId.get(Number(relationship.to)),
      relationship: relationship.relationship || "Unknown"
    }))
    .filter((link) => link.source && link.target);

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
  queueDraw();
}

function isKnownRelationship(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized && normalized !== "unknown" && !normalized.includes("couldn't find") && !normalized.includes("does not mention");
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
      const distanceSq = Math.max(60, dx * dx + dy * dy);
      const force = Math.min(2.2, 900 / distanceSq);
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
    if (pointer.dragNode === node) continue;
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

  ctx.lineWidth = 1.4 / transform.scale;
  for (const link of visibleGraph.links) {
    const selected = selectedNode && (link.source === selectedNode || link.target === selectedNode);
    ctx.strokeStyle = selected ? palette.accent : palette.link;
    ctx.globalAlpha = selected ? 0.92 : 0.58;
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

    if (transform.scale > 0.55 || isSelected || isHovered) {
      ctx.font = `${Math.max(10, 12 / transform.scale)}px Inter, sans-serif`;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      wrapLabel(node.title, node.x, node.y + node.radius + 6, 112 / transform.scale);
    }
  }

  ctx.restore();
}

function wrapLabel(text, x, y, maxWidth) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lines = [];

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines = lines.slice(0, 2);
  if (lines.length === 2 && words.length > lines.join(" ").split(/\s+/).length) {
    lines[1] = `${lines[1].replace(/\.*$/, "")}...`;
  }

  lines.forEach((label, index) => ctx.fillText(label, x, y + index * 15 / transform.scale));
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
    return;
  }

  const connections = sourceGraph.links
    .filter((link) => link.source === selectedNode || link.target === selectedNode)
    .map((link) => ({
      node: link.source === selectedNode ? link.target : link.source,
      relationship: link.relationship
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
  connectionList.innerHTML = connections.length
    ? connections.map((item) => `<li><strong>${escapeHtml(item.node.title)}</strong>${escapeHtml(item.relationship || "Unknown")}</li>`).join("")
    : "<li>No relationships recorded for this entity.</li>";
}

function setEntityFormEnabled(enabled) {
  entityNameInput.disabled = !enabled;
  entityDescriptionInput.disabled = !enabled;
  saveEntityButton.disabled = !enabled;
  resetEntityButton.disabled = !enabled;
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

function exportGraph() {
  if (!importedGraph) return;

  ensureGraphIndexes(importedGraph);
  const json = JSON.stringify(importedGraph, null, 2);
  const blob = new Blob([`${json}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = importedFileName.replace(/\.json$/i, "") || "omni-net-graph";
  link.href = url;
  link.download = `${baseName}-edited.json`;
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
