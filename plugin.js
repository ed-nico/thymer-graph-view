/**
 * Graph View - Thymer Plugin
 *
 * Interactive force-directed graph of all notes and their connections.
 * Shows references, back-references, and tags as an Obsidian-style graph.
 */

const GRAPH_CSS = `
  .gv-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .gv-canvas-area {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }

  .gv-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .gv-canvas.grabbing {
    cursor: grabbing;
  }

  .gv-controls {
    position: absolute;
    top: 0;
    right: 0;
    width: 240px;
    max-height: 100%;
    background: var(--bg-default);
    border-left: 1px solid var(--border-strong, var(--border-default));
    font-family: var(--font-family);
    font-size: 12px;
    color: var(--text-default);
    overflow-y: auto;
    user-select: none;
    z-index: 10;
    transition: width 0.2s ease;
  }

  @media (max-width: 600px) {
    .gv-controls {
      width: 180px;
    }
  }

  .gv-controls * {
    color: inherit;
  }

  .gv-stats {
    padding: 10px 12px;
    font-size: 11px;
    color: var(--text-default);
    border-bottom: 1px solid var(--border-default);
  }

  .gv-section {
    border-bottom: 1px solid var(--border-default);
  }

  .gv-section:last-child {
    border-bottom: none;
  }

  .gv-section-header {
    padding: 8px 12px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-default);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gv-section-header:hover {
    background: var(--bg-hover);
  }

  .gv-section-chevron {
    transition: transform 0.15s ease;
    display: flex;
    align-items: center;
  }

  .gv-section-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .gv-section-body {
    padding: 6px 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gv-section-body.hidden {
    display: none;
  }

  .gv-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .gv-row label {
    flex-shrink: 0;
    color: var(--text-default);
    font-size: 12px;
  }

  .gv-row input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 4px;
    accent-color: var(--accent-color);
  }

  .gv-row-value {
    font-size: 10px;
    color: var(--text-default);
    min-width: 28px;
    text-align: right;
  }

  .gv-search-wrapper {
    position: relative;
  }

  .gv-search {
    width: 100%;
    padding: 6px 8px;
    padding-right: 24px;
    background: var(--bg-hover);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--text-default);
    font-size: 12px;
    font-family: var(--font-family);
    outline: none;
    box-sizing: border-box;
  }

  .gv-search:focus {
    border-color: var(--accent-color);
  }

  .gv-search::placeholder {
    color: var(--text-muted);
  }

  .gv-search-clear {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    cursor: pointer;
    color: var(--text-muted);
    display: none;
  }

  .gv-search-clear:hover {
    color: var(--text-default);
  }

  .gv-search-wrapper.has-text .gv-search-clear {
    display: block;
  }

  .gv-toggle {
    position: relative;
    width: 32px;
    height: 18px;
    flex-shrink: 0;
  }

  .gv-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .gv-toggle-track {
    position: absolute;
    inset: 0;
    background: var(--bg-subtle-contrast);
    border-radius: 9px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .gv-toggle input:checked + .gv-toggle-track {
    background: var(--accent-color, #4a9eff);
  }

  .gv-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--bg-default);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: transform 0.15s ease;
    pointer-events: none;
    box-sizing: border-box;
  }

  .gv-toggle input:checked ~ .gv-toggle-thumb {
    transform: translateX(14px);
  }

  .gv-button {
    background: var(--bg-hover);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-default);
    cursor: pointer;
    text-align: center;
  }

  .gv-button:hover {
    background: var(--bg-subtle-contrast);
    border-color: var(--border-strong);
  }
`;

// ---------------------------------------------------------------------------
// Quadtree — for spatial partitioning
// ---------------------------------------------------------------------------
class Quadtree {
  constructor(bounds, maxPoints = 4, maxLevel = 8) {
    this.bounds = bounds; // { x, y, width, height }
    this.maxPoints = maxPoints;
    this.maxLevel = maxLevel;
    this.level = 0;
    this.points = [];
    this.nodes = [];
  }

  clear() {
    this.points = [];
    this.nodes = [];
  }

  _split() {
    const nextLevel = this.level + 1;
    const { x, y, width, height } = this.bounds;
    const subWidth = width / 2;
    const subHeight = height / 2;

    this.nodes[0] = new Quadtree({ x: x + subWidth, y: y, width: subWidth, height: subHeight }, this.maxPoints, this.maxLevel);
    this.nodes[1] = new Quadtree({ x: x, y: y, width: subWidth, height: subHeight }, this.maxPoints, this.maxLevel);
    this.nodes[2] = new Quadtree({ x: x, y: y + subHeight, width: subWidth, height: subHeight }, this.maxPoints, this.maxLevel);
    this.nodes[3] = new Quadtree({ x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight }, this.maxPoints, this.maxLevel);

    for (const node of this.nodes) {
      node.level = nextLevel;
    }
  }

  _getIndex(point) {
    const { x, y, width, height } = this.bounds;
    const onTop = point.y < y + height / 2;
    const onLeft = point.x < x + width / 2;

    if (onTop) {
      return onLeft ? 1 : 0;
    } else {
      return onLeft ? 2 : 3;
    }
  }

  insert(point) {
    if (this.nodes.length) {
      const index = this._getIndex(point);
      this.nodes[index].insert(point);
      return;
    }

    this.points.push(point);

    if (this.points.length > this.maxPoints && this.level < this.maxLevel) {
      if (!this.nodes.length) {
        this._split();
      }
      for (const p of this.points) {
        const index = this._getIndex(p);
        this.nodes[index].insert(p);
      }
      this.points = [];
    }
  }

  retrieve(bounds, result) {
    if (!result) result = [];
    if (!this._intersects(bounds)) return result;

    for (let i = 0; i < this.points.length; i++) {
      result.push(this.points[i]);
    }

    if (this.nodes.length) {
      for (const node of this.nodes) {
        node.retrieve(bounds, result);
      }
    }
    return result;
  }
  
  _intersects(range) {
    const { x, y, width, height } = this.bounds;
    return !(range.x > x + width ||
             range.x + range.width < x ||
             range.y > y + height ||
             range.y + range.height < y);
  }
}

// ---------------------------------------------------------------------------
// GraphSimulation — force-directed physics engine
// ---------------------------------------------------------------------------
class GraphSimulation {
  constructor(nodes, edges) {
    this.nodes = nodes;
    this.edges = edges;

    // Force parameters
    this.centerForce = 0.1;
    this.repelForce = 8;
    this.linkForce = 0;
    this.linkDistance = 80;

    // Simulation state
    this.alpha = 1;
    this.alphaDecay = 0.003;
    this.alphaMin = 0.001;
    this.velocityDecay = 0.4;
    this.running = true;
    
    // Initialize quadtree for optimized repulsion calculation
    this.quadtree = new Quadtree(this._getBounds());

    // Build adjacency for quick edge lookup
    this._edgeMap = new Map();
    for (const edge of edges) {
      if (!this._edgeMap.has(edge.source)) this._edgeMap.set(edge.source, []);
      if (!this._edgeMap.has(edge.target)) this._edgeMap.set(edge.target, []);
      this._edgeMap.get(edge.source).push(edge);
      this._edgeMap.get(edge.target).push(edge);
    }

    // Find connected components via BFS so linked nodes start close together
    const guidToNode = new Map();
    for (const n of nodes) guidToNode.set(n.guid, n);
    const visited = new Set();
    const components = [];
    for (const n of nodes) {
      if (visited.has(n.guid)) continue;
      const component = [];
      const queue = [n];
      visited.add(n.guid);
      while (queue.length > 0) {
        const cur = queue.shift();
        component.push(cur);
        const edgesForNode = this._edgeMap.get(cur.guid) || [];
        for (const edge of edgesForNode) {
          const neighborGuid = edge.source === cur.guid ? edge.target : edge.source;
          if (!visited.has(neighborGuid)) {
            visited.add(neighborGuid);
            const neighbor = guidToNode.get(neighborGuid);
            if (neighbor) queue.push(neighbor);
          }
        }
      }
      components.push(component);
    }

    // Store components for center-of-mass force
    this._components = components;

    // Sort components largest first
    components.sort((a, b) => b.length - a.length);

    // Place each component in its own area
    const compCount = components.length;
    const cols = Math.ceil(Math.sqrt(compCount));
    const spacing = Math.sqrt(nodes.length) * 5;

    for (let ci = 0; ci < compCount; ci++) {
      const comp = components[ci];
      const col = ci % cols;
      const row = Math.floor(ci / cols);
      const cx = (col - (cols - 1) / 2) * spacing;
      const cy = (row - (Math.ceil(compCount / cols) - 1) / 2) * spacing;
      const r = Math.sqrt(comp.length) * 30;

      // Store the initial center target for this component
      comp._targetX = cx;
      comp._targetY = cy;

      for (let i = 0; i < comp.length; i++) {
        const angle = (2 * Math.PI * i) / comp.length;
        const n = comp[i];
        n.x = cx + Math.cos(angle) * r + (Math.random() - 0.5) * 20;
        n.y = cy + Math.sin(angle) * r + (Math.random() - 0.5) * 20;
        n.vx = 0;
        n.vy = 0;
        n.fx = null;
        n.fy = null;
      }
    }
  }

  // Helper to get the overall bounds of the graph for quadtree
  _getBounds() {
    if (this.nodes.length === 0) return { x: -50, y: -50, width: 100, height: 100 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    // Add some padding to the bounds to ensure nodes near the edge are included
    const padding = 100; 
    return { x: minX - padding, y: minY - padding, width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2 };
  }

  tick() {
    if (!this.running || this.alpha < this.alphaMin) {
      this.running = false;
      return false;
    }

    const alpha = this.alpha;
    const nodes = this.nodes;
    const edges = this.edges;

    // 1. Center force — pull each component toward its own center of mass
    const cf = this.centerForce;
    if (cf > 0) {
      for (const comp of this._components) {
        let cmx = 0, cmy = 0, count = 0;
        for (const n of comp) {
          if (n._hidden) continue;
          cmx += n.x;
          cmy += n.y;
          count++;
        }
        if (count === 0) continue;
        cmx /= count;
        cmy /= count;

        for (const n of comp) {
          if (n._hidden) continue;
          n.vx -= (n.x - cmx) * cf * alpha;
          n.vy -= (n.y - cmy) * cf * alpha;
        }
      }

      // Also apply a gentle global pull toward origin
      for (const n of nodes) {
        if (n._hidden) continue;
        n.vx -= n.x * cf * alpha * 0.1;
        n.vy -= n.y * cf * alpha * 0.1;
      }
    }

    // 2. Repulsion force using Quadtree
    const repel = this.repelForce;
    if (repel > 0) {
        this.quadtree.bounds = this._getBounds(); // Update bounds each tick
        this.quadtree.clear();
        for (const n of nodes) {
            // Only insert visible nodes into the quadtree
            if (!n._hidden) this.quadtree.insert(n);
        }

        for (const a of nodes) {
            if (a._hidden) continue;
            
            // Define a search radius for repulsion force
            const searchRadius = this.linkDistance * 2; 
            const searchBounds = {
                x: a.x - searchRadius,
                y: a.y - searchRadius,
                width: searchRadius * 2,
                height: searchRadius * 2,
            };
            
            // Retrieve candidate nodes from the quadtree within the search radius
            const candidates = this.quadtree.retrieve(searchBounds);

            for (const b of candidates) {
                // Ensure we don't calculate force with self or hidden nodes, and process each pair only once
                if (a.guid >= b.guid || b._hidden) continue; 

                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist2 = dx * dx + dy * dy;

                if (dist2 < 1) dist2 = 1; // Prevent division by zero if nodes overlap
                
                const dist = Math.sqrt(dist2);
                // Inverse square law for repulsion force
                const force = (repel * alpha) / dist; 
                
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                // Apply equal and opposite forces
                a.vx -= fx;
                a.vy -= fy;
                b.vx += fx;
                b.vy += fy;
            }
        }
    }

    // 3. Link (spring) force — pulls connected nodes toward linkDistance
    const lf = this.linkForce;
    const ld = this.linkDistance;
    if (lf > 0) {
      for (const edge of edges) {
        const source = edge.sourceNode;
        const target = edge.targetNode;
        if (!source || !target || source._hidden || target._hidden) continue;
        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) dist = 0.1;
        const displacement = (dist - ld) * lf * alpha;
        const fx = (dx / dist) * displacement;
        const fy = (dy / dist) * displacement;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 4. Integrate velocity + apply friction
    const decay = this.velocityDecay;
    for (const n of nodes) {
      if (n.fx !== null) {
        n.x = n.fx;
        n.vx = 0;
      } else {
        n.vx *= (1 - decay);
        n.x += n.vx;
      }
      if (n.fy !== null) {
        n.y = n.fy;
        n.vy = 0;
      } else {
        n.vy *= (1 - decay);
        n.y += n.vy;
      }
    }

    // Decay alpha
    this.alpha -= this.alphaDecay;
    if (this.alpha < this.alphaMin) {
      this.alpha = this.alphaMin;
      this.running = false;
    }

    return true;
  }

  reheat() {
    this.alpha = 1;
    this.running = true;
  }
}

// ---------------------------------------------------------------------------
// GraphRenderer — canvas rendering with pan/zoom/drag
// ---------------------------------------------------------------------------
class GraphRenderer {
  constructor(canvas, simulation, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sim = simulation;
    this.options = options;

    // Camera
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;

    // Interaction
    this.dragNode = null;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panOffsetStartX = 0;
    this.panOffsetStartY = 0;
    this.hoveredNode = null;

    // Display options
    this.nodeBaseSize = 0.5;
    this.showLabels = true;
    this.showArrows = false;
    this.lineThickness = 1;
    this.searchQuery = "";

    // Colors (read from CSS)
    this._readColors();

    // Animation
    this._raf = null;
    this._running = false;
    this._needsRender = true;

    this._bindEvents();
  }

  _readColors() {
    const style = getComputedStyle(this.canvas.closest(".gv-wrapper") || document.documentElement);
    this.colorBg = style.getPropertyValue("--bg-default").trim() || "#1e1e1e";
    this.colorText = style.getPropertyValue("--text-default").trim() || "#cccccc";
    this.colorTextMuted = style.getPropertyValue("--text-muted").trim() || "#888888";
    this.colorAccent = style.getPropertyValue("--accent-color").trim() || "#4a9eff";
    this.colorEdge = style.getPropertyValue("--text-default").trim() || "#cccccc";
    this.colorHover = style.getPropertyValue("--bg-hover").trim() || "#2a2a2a";
  }

  _bindEvents() {
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);

    this.canvas.addEventListener("mousedown", this._onMouseDown);
    this.canvas.addEventListener("mousemove", this._onMouseMove);
    this.canvas.addEventListener("mouseup", this._onMouseUp);
    this.canvas.addEventListener("mouseleave", this._onMouseUp);
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this._onDblClick);
    this.canvas.addEventListener("touchstart", this._onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this._onTouchEnd);
  }

  destroy() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener("mousedown", this._onMouseDown);
    this.canvas.removeEventListener("mousemove", this._onMouseMove);
    this.canvas.removeEventListener("mouseup", this._onMouseUp);
    this.canvas.removeEventListener("mouseleave", this._onMouseUp);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("dblclick", this._onDblClick);
    this.canvas.removeEventListener("touchstart", this._onTouchStart);
    this.canvas.removeEventListener("touchmove", this._onTouchMove);
    this.canvas.removeEventListener("touchend", this._onTouchEnd);
  }

  start() {
    this._running = true;
    this._loop();
  }

  _loop() {
    if (!this._running) return;
    const simActive = this.sim.tick();
    if (simActive || this._needsRender) {
      this._render();
      this._needsRender = false;
    }
    if (simActive || this.dragNode || this.isPanning || this._needsRender) {
      this._raf = requestAnimationFrame(() => this._loop());
    } else {
      this._raf = null;
    }
  }

  _ensureRunning() {
    if (!this._raf && this._running) {
      this._needsRender = true;
      this._loop();
    }
  }

  requestRedraw() {
    this._needsRender = true;
    this._ensureRunning();
  }

  _screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: (sx - rect.left - cx - this.offsetX) / this.scale,
      y: (sy - rect.top - cy - this.offsetY) / this.scale,
    };
  }

  _hitTest(wx, wy) {
    const hitRadius = 20 / this.scale; // Increased hit radius for easier interaction
    const candidates = this.sim.quadtree.retrieve({
        x: wx - hitRadius,
        y: wy - hitRadius,
        width: hitRadius * 2,
        height: hitRadius * 2,
    });

    let closestNode = null;
    let min_dist_sq = Infinity;

    for (const n of candidates) {
        if (n._hidden) continue;
        const r = this._nodeRadius(n) + (4 / this.scale); // Scale hit area with zoom
        const dx = wx - n.x;
        const dy = wy - n.y;
        const dist_sq = dx * dx + dy * dy;
        if (dist_sq <= r * r) {
            if (dist_sq < min_dist_sq) {
                min_dist_sq = dist_sq;
                closestNode = n;
            }
        }
    }
    return closestNode;
  }

  _nodeRadius(n) {
    const baseSize = this.nodeBaseSize;
    if (n.isOrphan) return baseSize + 1.6;
    return baseSize + Math.sqrt(n.linkCount) * 2;
  }

  // --- Mouse events ---

  _handleMouseDown(e) {
    if (e.button !== 0) return;
    const { x, y } = this._screenToWorld(e.clientX, e.clientY);
    const node = this._hitTest(x, y);

    if (node) {
      this.dragNode = node;
      node.fx = node.x;
      node.fy = node.y;
      this.sim.reheat();
      this.canvas.classList.add("grabbing");
      this._ensureRunning();
    } else {
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panOffsetStartX = this.offsetX;
      this.panOffsetStartY = this.offsetY;
      this.canvas.classList.add("grabbing");
      this._ensureRunning();
    }
  }

  _handleMouseMove(e) {
    if (this.dragNode) {
      const { x, y } = this._screenToWorld(e.clientX, e.clientY);
      this.dragNode.fx = x;
      this.dragNode.fy = y;
      return;
    }

    if (this.isPanning) {
      this.offsetX = this.panOffsetStartX + (e.clientX - this.panStartX);
      this.offsetY = this.panOffsetStartY + (e.clientY - this.panStartY);
      this._needsRender = true;
      return;
    }

    // Hover detection
    const { x, y } = this._screenToWorld(e.clientX, e.clientY);
    const node = this._hitTest(x, y);
    if (node !== this.hoveredNode) {
      this.hoveredNode = node;
      this.canvas.style.cursor = node ? "pointer" : "grab";
      this._needsRender = true;
      this._ensureRunning();
    }
  }

  _handleMouseUp() {
    if (this.dragNode) {
      this.dragNode.fx = null;
      this.dragNode.fy = null;
      this.dragNode = null;
    }
    this.isPanning = false;
    this.canvas.classList.remove("grabbing");
    this.canvas.style.cursor = this.hoveredNode ? "pointer" : "grab";
  }

  _handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const mx = e.clientX - rect.left - cx;
    const my = e.clientY - rect.top - cy;

    // Zoom toward cursor
    const newScale = Math.max(0.05, Math.min(10, this.scale * zoomFactor));
    const ratio = newScale / this.scale;
    this.offsetX = mx - (mx - this.offsetX) * ratio;
    this.offsetY = my - (my - this.offsetY) * ratio;
    this.scale = newScale;
    this._needsRender = true;
    this._ensureRunning();
  }

  _handleDblClick(e) {
    const { x, y } = this._screenToWorld(e.clientX, e.clientY);
    const node = this._hitTest(x, y);
    if (node && this.options.onNavigate) {
      this.options.onNavigate(node.guid);
    }
  }

  // --- Touch events ---

  _handleTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      const { x, y } = this._screenToWorld(t.clientX, t.clientY);
      const node = this._hitTest(x, y);

      if (node) {
        this.dragNode = node;
        node.fx = node.x;
        node.fy = node.y;
        this.sim.reheat();
        this._ensureRunning();
      } else {
        this.isPanning = true;
        this.panStartX = t.clientX;
        this.panStartY = t.clientY;
        this.panOffsetStartX = this.offsetX;
        this.panOffsetStartY = this.offsetY;
        this._ensureRunning();
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();
      this.dragNode = null;
      this.isPanning = false;
      this._pinchStartDist = this._touchDist(e.touches);
      this._pinchStartScale = this.scale;
    }
  }

  _handleTouchMove(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      if (this.dragNode) {
        const { x, y } = this._screenToWorld(t.clientX, t.clientY);
        this.dragNode.fx = x;
        this.dragNode.fy = y;
      } else if (this.isPanning) {
        this.offsetX = this.panOffsetStartX + (t.clientX - this.panStartX);
        this.offsetY = this.panOffsetStartY + (t.clientY - this.panStartY);
      }
    } else if (e.touches.length === 2 && this._pinchStartDist) {
      e.preventDefault();
      const dist = this._touchDist(e.touches);
      this.scale = Math.max(0.05, Math.min(10, this._pinchStartScale * (dist / this._pinchStartDist)));
      this._needsRender = true;
    }
  }

  _handleTouchEnd(e) {
    if (e.touches.length === 0) {
      if (this.dragNode) {
        this.dragNode.fx = null;
        this.dragNode.fy = null;
        this.dragNode = null;
      }
      this.isPanning = false;
      this._pinchStartDist = null;
    }
  }

  _touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Rendering ---

  _render() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Camera transform
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    ctx.translate(cx + this.offsetX, cy + this.offsetY);
    ctx.scale(this.scale, this.scale);

    const query = this.searchQuery.toLowerCase();
    const hasQuery = query.length > 0;

    // Draw edges
    ctx.strokeStyle = this.colorEdge;
    ctx.lineWidth = this.lineThickness / this.scale;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    for (const edge of this.sim.edges) {
      const s = edge.sourceNode;
      const t = edge.targetNode;
      if (!s || !t || s._hidden || t._hidden) continue;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();

    // Highlight edges connected to hovered node
    if (this.hoveredNode && !this.hoveredNode._hidden) {
      ctx.strokeStyle = this.colorAccent;
      ctx.lineWidth = (this.lineThickness + 0.5) / this.scale;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (const edge of this.sim.edges) {
        const s = edge.sourceNode;
        const t = edge.targetNode;
        if (!s || !t || s._hidden || t._hidden) continue;
        if (s !== this.hoveredNode && t !== this.hoveredNode) continue;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();
    }

    // Draw arrowheads if enabled
    if (this.showArrows) {
      ctx.fillStyle = this.colorEdge;
      const arrowSize = 6 / this.scale;
      for (const edge of this.sim.edges) {
        const s = edge.sourceNode;
        const t = edge.targetNode;
        if (!s || !t || s._hidden || t._hidden) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const r = this._nodeRadius(t);
        const ax = t.x - nx * r;
        const ay = t.y - ny * r;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - nx * arrowSize - ny * arrowSize * 0.5, ay - ny * arrowSize + nx * arrowSize * 0.5);
        ctx.lineTo(ax - nx * arrowSize + ny * arrowSize * 0.5, ay - ny * arrowSize - nx * arrowSize * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // Build set of neighbor guids for hovered node using edge map
    const hoverNeighbors = new Set();
    if (this.hoveredNode) {
      const hEdges = this.sim._edgeMap.get(this.hoveredNode.guid);
      if (hEdges) {
        for (const edge of hEdges) {
          const neighborGuid = edge.source === this.hoveredNode.guid ? edge.target : edge.source;
          hoverNeighbors.add(neighborGuid);
        }
      }
    }

    // Draw nodes
    for (const n of this.sim.nodes) {
      if (n._hidden) continue;
      const r = this._nodeRadius(n);
      const dimmed = hasQuery && !n._matchesSearch;
      const isHovered = n === this.hoveredNode;
      const isNeighbor = hoverNeighbors.has(n.guid);

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

      if (isHovered) {
        ctx.fillStyle = this.colorAccent;
        ctx.globalAlpha = 1;
      } else if (isNeighbor) {
        ctx.fillStyle = this.colorAccent;
        ctx.globalAlpha = dimmed ? 0.2 : 0.9;
      } else if (n.isTag) {
        ctx.fillStyle = this.colorTextMuted;
        ctx.globalAlpha = dimmed ? 0.08 : 0.5;
      } else if (n.isOrphan) {
        ctx.fillStyle = "#999";
        ctx.globalAlpha = dimmed ? 0.1 : 0.4;
      } else {
        ctx.fillStyle = this.colorAccent;
        ctx.globalAlpha = dimmed ? 0.08 : 0.6;
      }

      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw labels — only for hovered node + its neighbors, or when zoomed in
    const showZoomedLabels = this.showLabels && this.scale > 1.5;

    if (this.hoveredNode || showZoomedLabels) {
      const fontSize = 10 / this.scale;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      for (const n of this.sim.nodes) {
        if (n._hidden) continue;
        const isHovered = n === this.hoveredNode;
        const isNeighbor = hoverNeighbors.has(n.guid);
        const dimmed = hasQuery && !n._matchesSearch;

        // Show label if: hovered, neighbor of hovered, or zoomed in enough
        if (!isHovered && !isNeighbor && !showZoomedLabels) continue;
        if (dimmed && !isHovered && !isNeighbor) continue;

        const r = this._nodeRadius(n);
        const labelY = n.y - r - 3;
        if (isHovered) {
          ctx.fillStyle = this.colorText;
          ctx.globalAlpha = 1;
        } else if (isNeighbor) {
          ctx.fillStyle = this.colorText;
          ctx.globalAlpha = 0.85;
        } else {
          ctx.fillStyle = dimmed ? this.colorTextMuted : this.colorText;
          ctx.globalAlpha = dimmed ? 0.3 : 0.7;
        }
        ctx.fillText(n.title, n.x, labelY);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  updateSearch(query) {
    this.searchQuery = query;
    const q = query.toLowerCase();
    for (const n of this.sim.nodes) {
      n._matchesSearch = q.length === 0 || n.title.toLowerCase().includes(q);
    }
    this._needsRender = true;
    this._ensureRunning();
  }

  updateVisibility(showTags, showOrphans, showJournal) {
    for (const n of this.sim.nodes) {
      n._hidden = false;
      if (n.isTag && !showTags) n._hidden = true;
      if (n.isOrphan && !showOrphans) n._hidden = true;
      if (n.isJournal && !showJournal) n._hidden = true;
    }
    this._needsRender = true;
    this._ensureRunning();
  }

  centerGraph() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this._needsRender = true;
    this._ensureRunning();
  }
}

// ---------------------------------------------------------------------------
// GraphControls — HTML overlay panel with filters/display/forces controls
// ---------------------------------------------------------------------------
class GraphControls {
  constructor(container, renderer, simulation, ui) {
    this.renderer = renderer;
    this.simulation = simulation;
    this.ui = ui;
    this._el = document.createElement("div");
    this._el.className = "gv-controls";
    container.appendChild(this._el);

    // Sample the actual opaque background color from the DOM
    let bg = null;
    let el = container;
    while (el) {
      const style = getComputedStyle(el);
      const c = style.backgroundColor;
      if (c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)") {
        bg = c;
        break;
      }
      el = el.parentElement;
    }
    if (bg) this._el.style.backgroundColor = bg;

    this._collapsed = {
      forces: true,
    };
    this._build();
  }

  setStats(noteCount, edgeCount) {
    if (this._statsEl) {
      this._statsEl.textContent = `${noteCount} notes, ${edgeCount} connections`;
    }
  }

  destroy() {
    if (this._el.parentNode) this._el.parentNode.removeChild(this._el);
  }

  _build() {
    const el = this._el;
    el.innerHTML = "";

    // Stats
    this._statsEl = document.createElement("div");
    this._statsEl.className = "gv-stats";
    this._statsEl.textContent = "Loading...";
    el.appendChild(this._statsEl);

    // Filters section
    this._buildSection(el, "Filters", "filters", (body) => {
      // Search
      const searchWrapper = document.createElement("div");
      searchWrapper.className = "gv-search-wrapper";

      const search = document.createElement("input");
      search.type = "text";
      search.className = "gv-search";
      search.placeholder = "Search notes...";

      const clearBtn = document.createElement("div");
      clearBtn.className = "gv-search-clear";
      clearBtn.innerHTML = "&times;";
      clearBtn.onclick = () => {
        search.value = "";
        search.dispatchEvent(new Event("input"));
      };

      search.addEventListener("input", () => {
        const query = search.value;
        this.renderer.updateSearch(query);
        searchWrapper.classList.toggle("has-text", query.length > 0);
      });
      searchWrapper.appendChild(search);
      searchWrapper.appendChild(clearBtn);
      body.appendChild(searchWrapper);

      // Toggles
      this._addToggle(body, "Tags", true, (checked) => {
        this._showTags = checked;
        this.renderer.updateVisibility(this._showTags, this._showOrphans, this._showJournal);
      });
      this._showTags = true;

      this._addToggle(body, "Orphans", true, (checked) => {
        this._showOrphans = checked;
        this.renderer.updateVisibility(this._showTags, this._showOrphans, this._showJournal);
      });
      this._showOrphans = true;

      // NEW: Journal toggle
      this._addToggle(body, "Journal", true, (checked) => {
        this._showJournal = checked;
        this.renderer.updateVisibility(this._showTags, this._showOrphans, this._showJournal);
      });
      this._showJournal = true;
    });

    // Display section
    this._buildSection(el, "Display", "display", (body) => {
      this._addToggle(body, "Labels", this.renderer.showLabels, (checked) => {
        this.renderer.showLabels = checked;
        this.renderer.requestRedraw();
      });
      this._addToggle(body, "Arrows", this.renderer.showArrows, (checked) => {
        this.renderer.showArrows = checked;
        this.renderer.requestRedraw();
      });
      this._addButton(body, "Reset View", () => {
        this.renderer.centerGraph();
      });
    });

    // Forces section
    this._buildSection(el, "Forces", "forces", (body) => {
      this._addSlider(body, "Center", 0, 1, this.simulation.centerForce, 0.01, (v) => {
        this.simulation.centerForce = v;
        this.simulation.reheat();
        this.renderer.requestRedraw();
      });
      this._addSlider(body, "Repel", 0, 100, this.simulation.repelForce, 1, (v) => {
        this.simulation.repelForce = v;
        this.simulation.reheat();
        this.renderer.requestRedraw();
      });

      this._addSlider(body, "Link Dist", 10, 300, this.simulation.linkDistance, 5, (v) => {
        this.simulation.linkDistance = v;
        this.simulation.reheat();
        this.renderer.requestRedraw();
      });
    });
  }

  _buildSection(parent, title, key, buildFn) {
    const section = document.createElement("div");
    section.className = "gv-section";

    const header = document.createElement("div");
    header.className = "gv-section-header";

    const label = document.createElement("span");
    label.textContent = title;

    const chevron = document.createElement("span");
    chevron.className = "gv-section-chevron";
    chevron.innerHTML = this.ui.createIcon("chevron-down").outerHTML;

    header.appendChild(label);
    header.appendChild(chevron);

    const body = document.createElement("div");
    body.className = "gv-section-body";

    if (this._collapsed[key]) {
      body.classList.add("hidden");
      chevron.classList.add("collapsed");
    }

    header.addEventListener("click", () => {
      this._collapsed[key] = !this._collapsed[key];
      body.classList.toggle("hidden", this._collapsed[key]);
      chevron.classList.toggle("collapsed", this._collapsed[key]);
    });

    buildFn(body);
    section.appendChild(header);
    section.appendChild(body);
    parent.appendChild(section);
  }

  _addSlider(parent, label, min, max, defaultVal, step, onChange) {
    const row = document.createElement("div");
    row.className = "gv-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = defaultVal;

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "gv-row-value";
    valueDisplay.textContent = parseFloat(defaultVal).toFixed(step < 1 ? 2 : 0);

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      valueDisplay.textContent = v.toFixed(step < 1 ? 2 : 0);
      onChange(v);
    });

    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(valueDisplay);
    parent.appendChild(row);
  }

  _addToggle(parent, label, defaultVal, onChange) {
    const row = document.createElement("div");
    row.className = "gv-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const toggle = document.createElement("label");
    toggle.className = "gv-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = defaultVal;

    const track = document.createElement("span");
    track.className = "gv-toggle-track";

    const thumb = document.createElement("span");
    thumb.className = "gv-toggle-thumb";

    input.addEventListener("change", () => {
      onChange(input.checked);
    });

    toggle.appendChild(input);
    toggle.appendChild(track);
    toggle.appendChild(thumb);

    row.appendChild(lbl);
    row.appendChild(toggle);
    parent.appendChild(row);
  }

  _addButton(parent, label, onClick) {
    const button = document.createElement("button");
    button.className = "gv-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    parent.appendChild(button);
  }
}

// ---------------------------------------------------------------------------
// Plugin — AppPlugin: data collection, panel management, navigation
// ---------------------------------------------------------------------------
class Plugin extends AppPlugin {
  onLoad() {
    this.ui.injectCSS(GRAPH_CSS);

    this._panelElement = null;
    this._panel = null;
    this._renderer = null;
    this._controls = null;
    this._simulation = null;
    this._resizeObserver = null;
    this._buildVersion = 0;

    // Register custom panel type
    this.ui.registerCustomPanelType("graph-view", (panel) => {
      this._panel = panel;
      this._panelElement = panel.getElement();
      if (this._panelElement) {
        panel.setTitle("Graph View");
        this._initPanel();
      }
    });

    // Sidebar item
    this.ui.addSidebarItem({
      icon: "share",
      label: "Graph View",
      tooltip: "Open graph view of all notes",
      onClick: () => this._openPanel(),
    });

    // Command palette
    this.ui.addCommandPaletteCommand({
      label: "Open Graph View",
      icon: "share",
      onSelected: () => this._openPanel(),
    });

    // Deferred graph build
    setTimeout(() => this._buildGraph(), 1500);
  }

  onUnload() {
    this._destroyGraph();
    this._panelElement = null;
    this._panel = null;
  }

  async _openPanel() {
    // Close all other panels so graph view gets the full page
    const panels = this.ui.getPanels();
    for (const p of panels) {
      if (p.getElement() === this._panelElement) continue; // Don't close myself
      this.ui.closePanel(p);
    }
    const panel = await this.ui.createPanel();
    if (panel) {
      panel.navigateToCustomType("graph-view");
    }
  }

  _initPanel() {
    const container = this._panelElement;
    if (!container) return;

    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "gv-wrapper";

    const canvasArea = document.createElement("div");
    canvasArea.className = "gv-canvas-area";

    const canvas = document.createElement("canvas");
    canvas.className = "gv-canvas";
    canvasArea.appendChild(canvas);

    wrapper.appendChild(canvasArea);
    container.appendChild(wrapper);

    this._canvas = canvas;
    this._canvasArea = canvasArea;
    this._wrapper = wrapper;

    // If we already have graph data, render it
    if (this._graphData) {
      this._setupGraph(this._graphData.nodes, this._graphData.edges);
    } else {
      // Show loading state
      const stats = document.createElement("div");
      stats.className = "gv-stats";
      stats.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-hover);padding:12px 20px;border-radius:8px;border:1px solid var(--border-default);";
      stats.textContent = "Building graph...";
      canvasArea.appendChild(stats);
      this._loadingEl = stats;
    }

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => {
      // Canvas auto-resizes via CSS, renderer reads rect each frame
    });
    this._resizeObserver.observe(canvasArea);
  }

  _setupGraph(nodes, edges) {
    // Clean up any previous renderer
    this._destroyGraph();

    if (!this._canvas || !this._wrapper) return;

    // Remove loading indicator
    if (this._loadingEl && this._loadingEl.parentNode) {
      this._loadingEl.parentNode.removeChild(this._loadingEl);
      this._loadingEl = null;
    }

    // Create simulation
    this._simulation = new GraphSimulation(nodes, edges);

    // Resolve edge node references
    const nodeMap = new Map();
    for (const n of nodes) {
      nodeMap.set(n.guid, n);
      n._hidden = false;
      n._matchesSearch = true;
    }
    for (const e of edges) {
      e.sourceNode = nodeMap.get(e.source);
      e.targetNode = nodeMap.get(e.target);
    }

    // Create renderer
    this._renderer = new GraphRenderer(this._canvas, this._simulation, {
      onNavigate: (guid) => this._navigateToNote(guid),
    });

    // Create controls
    this._controls = new GraphControls(this._wrapper, this._renderer, this._simulation, this.ui);
    this._controls.setStats(
      nodes.filter(n => !n.isTag && !n.isJournal).length,
      edges.length
    );

    // Start rendering
    this._renderer.start();
  }

  _destroyGraph() {
    if (this._renderer) {
      this._renderer.destroy();
      this._renderer = null;
    }
    if (this._controls) {
      this._controls.destroy();
      this._controls = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._simulation = null;
  }

  async _buildGraph() {
    this._buildVersion++;
    const version = this._buildVersion;

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();
    const nodeByGuid = new Map();
    const edgeSet = new Set();

    try {
      const collections = await this.data.getAllCollections();

      for (const collection of collections) {
        if (version !== this._buildVersion) return;

        const records = await collection.getAllRecords();
        const collectionName = collection.getName();
        const isJournal = collection.isJournalPlugin();

        for (const record of records) {
          if (version !== this._buildVersion) return;

          const guid = record.guid;
          const title = record.getName() || "Untitled";

          if (!nodeSet.has(guid)) {
            nodeSet.add(guid);
            const node = {
              guid,
              title,
              collectionName,
              isJournal: isJournal,
              x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null,
              linkCount: 0,
              isOrphan: false,
              isTag: false,
              tags: new Set(),
            };
            nodes.push(node);
            nodeByGuid.set(guid, node);
          }

          // Extract references and tags from line items
          try {
            const lineItems = await record.getLineItems();
            for (const item of lineItems) {
              if (!item.segments) continue;
              for (const seg of item.segments) {
                if (seg.type === "ref" && seg.text?.guid) {
                  const targetGuid = seg.text.guid;
                  // Create edge (deduplicate using sorted pair)
                  const pair = guid < targetGuid ? `${guid}|${targetGuid}` : `${targetGuid}|${guid}`;
                  if (!edgeSet.has(pair)) {
                    edgeSet.add(pair);
                    edges.push({ source: guid, target: targetGuid });
                  }
                } else if (seg.type === "hashtag" && typeof seg.text === "string") {
                  const tagKey = `tag:${seg.text.toLowerCase()}`;
                  const node = nodeByGuid.get(guid);
                  if (node) node.tags.add(seg.text.toLowerCase());

                  // Create tag node if needed
                  if (!nodeSet.has(tagKey)) {
                    nodeSet.add(tagKey);
                    const tagNode = {
                      guid: tagKey,
                      title: `#${seg.text}`,
                      collectionName: "",
                      isJournal: false,
                      x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null,
                      linkCount: 0,
                      isOrphan: false,
                      isTag: true,
                      tags: new Set(),
                    };
                    nodes.push(tagNode);
                    nodeByGuid.set(tagKey, tagNode);
                  }

                  // Edge from record to tag
                  const tagPair = guid < tagKey ? `${guid}|${tagKey}` : `${tagKey}|${guid}`;
                  if (!edgeSet.has(tagPair)) {
                    edgeSet.add(tagPair);
                    edges.push({ source: guid, target: tagKey });
                  }
                }
              }
            }
          } catch (e) {
            // Skip records that fail
          }

          // Back-references
          try {
            const backRefs = await record.getBackReferenceRecords();
            for (const ref of backRefs) {
              const pair = guid < ref.guid ? `${guid}|${ref.guid}` : `${ref.guid}|${guid}`;
              if (!edgeSet.has(pair)) {
                edgeSet.add(pair);
                edges.push({ source: guid, target: ref.guid });
              }
            }
          } catch (e) {
            // Skip
          }
        }
      }
    } catch (e) {
      // Handle error gracefully
    }

    if (version !== this._buildVersion) return;

    // Calculate link counts and mark orphans
    const linkCounts = new Map();
    for (const edge of edges) {
      linkCounts.set(edge.source, (linkCounts.get(edge.source) || 0) + 1);
      linkCounts.set(edge.target, (linkCounts.get(edge.target) || 0) + 1);
    }
    for (const node of nodes) {
      node.linkCount = linkCounts.get(node.guid) || 0;
      node.isOrphan = node.linkCount === 0 && !node.isTag;
    }

    // Store graph data
    this._graphData = { nodes, edges };

    // If panel is already open, set up the graph
    if (this._canvas && this._wrapper) {
      this._setupGraph(nodes, edges);
    }
  }

  async _navigateToNote(guid) {
    // Don't navigate to tag nodes
    if (guid.startsWith("tag:")) return;

    const workspaceGuid = this.getWorkspaceGuid();
    if (!workspaceGuid) return;

    // Find a panel that isn't ours
    let targetPanel = null;
    const myElement = this._panelElement;
    const panels = this.ui.getPanels();
    for (const p of panels) {
      if (p.getElement() === myElement) continue;
      targetPanel = p;
      break;
    }
    if (!targetPanel) {
      targetPanel = await this.ui.createPanel();
    }

    if (targetPanel) {
      targetPanel.navigateTo({
        type: "edit_panel",
        rootId: guid,
        workspaceGuid: workspaceGuid,
      });
      this.ui.setActivePanel(targetPanel);
    }
  }
}