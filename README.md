# SKUNKWORKS // TACTILE GRAPH

A gesture-driven knowledge graph interface. Point, pinch, and drag information nodes around your screen using your webcam and hand tracking — or just use the mouse.

Built with React + Vite + MediaPipe Hands.

---

## Requirements

- **Node.js** v18+ (tested on v22.4)
- **Chrome** recommended (best MediaPipe support)
- Webcam optional — mouse fallback always works

---

## Install & Run

```bash
git clone <your-repo-url>
cd skunk_works
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **◉ ACTIVATE TRACKING**, allow camera access, raise your hand.

---

## Controls

### Hand Mode
| Gesture | Action |
|---|---|
| Index finger up | Hover cursor |
| Pinch near a node | Grab and drag |
| Pinch in empty space | Pan canvas |
| Both hands pinching — spread | Zoom in |
| Both hands pinching — close | Zoom out |

### Mouse Mode
| Input | Action |
|---|---|
| Drag node | Move node |
| Drag canvas | Pan |
| Scroll | Zoom |
| Click node | Open editor |

### Keyboard
| Key | Action |
|---|---|
| `M` | Toggle hand / mouse mode |
| `D` | Toggle debug panel |
| `Esc` | Close node editor (saves) |

---

## Node Editor

Click any node in mouse mode to open it.

- **Title** — label shown on the card
- **Type** — sets color (SYSTEM, MODEL, CONCEPT, SIGNAL, ACTOR, PATTERN)
- **Notes** — free-form text
- **Tags** — `Enter` or `,` to add, `Backspace` to remove last

**Tags create connections.** Nodes sharing a tag are linked by a dashed colored line:

```
FOOD TO BUY   tag: groceries
  EGGS        tag: groceries  ← connected to FOOD TO BUY and MILK
  MILK        tag: groceries  ← connected to FOOD TO BUY and EGGS
```

---

## Project Structure

```
src/
  App.jsx                    root: mode, nodes state, editor, tag edges
  hooks/
    useHandTracking.js       MediaPipe lifecycle → handState[]
  components/
    Gate.jsx                 activation / camera permission screen
    GraphCanvas.jsx          canvas render loop, physics, interaction
    HUD.jsx                  HTML overlay (title bar, status bar, scanlines)
    DebugPanel.jsx           live hand debug readout (D to toggle)
    ModeToggle.jsx           hand / mouse switcher
    NodeEditor.jsx           edit title, type, notes, tags
  data/
    graphData.js             node + edge definitions, tag color logic
  utils/
    physics.js               force simulation (repulsion + springs)
    gestures.js              pinch detection, landmark → screen coords
    draw.js                  all canvas draw functions
```

**Add nodes** — edit `INITIAL_NODES` in `src/data/graphData.js`.  
**Add UI** — create a component, import it in `App.jsx`.

---

## Build

```bash
npm run build    # output → dist/
npm run preview  # preview the build locally
```

---

## Notes

- MediaPipe WASM loads from jsDelivr CDN on first run — needs internet
- Hand tracking works best in good lighting with your hand clearly visible
- The debug panel (`D`) shows live pinch distance to help calibrate
- Node positions reset on page refresh (persistence not yet implemented)
