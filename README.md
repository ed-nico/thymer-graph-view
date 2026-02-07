# Graph View for Thymer

A [Thymer](https://thymer.com) plugin that renders an interactive force-directed graph of all your notes, references, and tags.

## Features

- **Force-Directed Layout** - Notes arrange themselves based on their connections using a physics simulation
- **References & Back-references** - Edges drawn between notes that link to each other
- **Tag Nodes** - Hashtags appear as their own nodes, connecting all notes that share them
- **Hover Highlighting** - Hover a node to highlight its connections and show labels for neighbors
- **Search** - Filter and dim nodes that don't match your query
- **Pan, Zoom & Drag** - Scroll to zoom, drag the canvas to pan, drag nodes to rearrange
- **Pinch-to-Zoom** - Touch support for mobile/tablet
- **Double-Click to Open** - Double-click any node to open that note in an adjacent panel
- **Adjustable Forces** - Tune center force, repulsion, and link distance from the controls panel

## Installation

1. In Thymer, open the **Command Palette** (Cmd/Ctrl + p)
2. Search for **"Plugins"** and select it
3. In **Global Plugins**, click **"Create Plugin"**
4. Give it a name (e.g., "Graph View")
5. Click **"Edit Code"**
6. Copy the contents of [`plugin.json`](plugin.json) into the **Configuration** field
7. Copy the contents of [`plugin.js`](plugin.js) into the **Custom Code** field
8. Click **Save**

The plugin will appear in your sidebar.

## Usage

- Click the **share icon** in the sidebar to open the Graph View panel
- **Hover** a node to see its title and highlight its connections
- **Double-click** a node to open that note in the adjacent panel
- **Scroll** to zoom in/out, **drag** the background to pan
- **Drag** a node to reposition it (the simulation reheats on drag)
- Use the **Controls panel** on the right to search, toggle tags/orphans, and adjust forces

## Controls Panel

### Filters

| Control | Description |
|---------|-------------|
| Search | Type to highlight matching notes and dim the rest |
| Tags | Toggle visibility of hashtag nodes |
| Orphans | Toggle visibility of unconnected notes |

### Display

| Control | Description |
|---------|-------------|
| Labels | Show/hide labels (labels also appear when zoomed in past 1.5x) |
| Arrows | Show/hide directional arrowheads on edges |
| Reset View | Reset pan, zoom, and center the graph |

### Forces

| Control | Range | Description |
|---------|-------|-------------|
| Center | 0 - 1 | Strength of the pull toward the center of mass |
| Repel | 0 - 100 | How strongly nodes push each other apart |
| Link Dist | 10 - 300 | Ideal distance between connected nodes |

## How It Works

The plugin collects all notes across every collection, extracts references (links between notes), back-references, and hashtags, then builds a graph with:

- **Nodes** for each note and each unique tag
- **Edges** for references, back-references, and note-to-tag relationships

The layout uses a custom force-directed simulation with three forces:

| Force | Purpose |
|-------|---------|
| Center | Pulls each connected component toward its center of mass |
| Repulsion | Pushes nearby nodes apart (inverse-square law via quadtree spatial partitioning) |
| Link spring | Pulls connected nodes toward the target link distance |

Node size scales with the number of connections. All processing runs locally in the browser.

## Known Limitations

- The graph must be rebuilt on plugin load (takes ~1.5s on startup)
- Very large workspaces (thousands of notes) may impact performance
- Tag nodes are generated from hashtags only, not from collection properties

## Requirements

- Thymer with notes containing references or tags for meaningful connections

## License

MIT
