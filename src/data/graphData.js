export const PALETTE = {
  SYSTEM:  { hi: '#00ccff', dim: '#003348' },
  MODEL:   { hi: '#00ff99', dim: '#003322' },
  CONCEPT: { hi: '#cc88ff', dim: '#220040' },
  SIGNAL:  { hi: '#ffaa00', dim: '#332200' },
  ACTOR:   { hi: '#ff5577', dim: '#330020' },
  PATTERN: { hi: '#55ddff', dim: '#002233' },
}

export const NODE_TYPES = Object.keys(PALETTE)

// Tag → color (deterministic hash)
const TAG_PALETTE = ['#00ccff','#00ff99','#ffaa00','#ff5577','#cc88ff','#55ddff','#ff8844','#44ffcc']
export function tagColor(tag) {
  let h = 0
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) % TAG_PALETTE.length
  return TAG_PALETTE[Math.abs(h)]
}

export const INITIAL_NODES = [
  { id: 0,  type: 'SYSTEM',  label: 'FEEDBACK LOOPS',   tags: ['systems'],           content: 'Reinforcing and balancing loops are the building blocks of complex systems.', x: -320, y: -200, role: 'standalone', parentIds: [], sectionId: null },
  { id: 1,  type: 'MODEL',   label: 'INVERSION',         tags: ['thinking'],          content: 'Avoid failure instead of seeking success. Think backwards.', x: -80,  y: -240, role: 'standalone', parentIds: [], sectionId: null },
  { id: 2,  type: 'CONCEPT', label: 'EMERGENCE',         tags: ['systems','complex'], content: 'Properties arising from interactions that cannot be predicted from parts alone.', x: 200, y: -200, role: 'standalone', parentIds: [], sectionId: null },
  { id: 3,  type: 'SIGNAL',  label: 'WEAK SIGNALS',      tags: ['foresight'],         content: 'Early, ambiguous indicators of future change. Easy to dismiss.', x: 340,  y: -40,  role: 'standalone', parentIds: [], sectionId: null },
  { id: 4,  type: 'ACTOR',   label: 'OPERATOR',          tags: [],                    content: 'The human in the loop. Decision-maker with full access.', x: -320, y:   60, role: 'standalone', parentIds: [], sectionId: null },
  { id: 5,  type: 'PATTERN', label: 'SECOND ORDER FX',   tags: ['thinking','systems'],content: 'Consequences of consequences. Most decision-makers stop at first order.', x: 40,  y:   60, role: 'standalone', parentIds: [], sectionId: null },
  { id: 6,  type: 'MODEL',   label: 'MAP vs TERRITORY',  tags: ['thinking'],          content: 'All models are wrong, some are useful. The map is not the place.', x: -140, y:  220, role: 'standalone', parentIds: [], sectionId: null },
  { id: 7,  type: 'SYSTEM',  label: 'TIPPING POINTS',    tags: ['systems','complex'], content: 'Thresholds at which a system rapidly changes state. Hard to reverse.', x: 260,  y:  200, role: 'standalone', parentIds: [], sectionId: null },
  { id: 8,  type: 'CONCEPT', label: 'COGNITIVE BIAS',    tags: ['thinking'],          content: 'Systematic errors in thinking. 200+ documented. Affect everyone.', x: -40,  y:  -60, role: 'standalone', parentIds: [], sectionId: null },
  { id: 9,  type: 'SIGNAL',  label: 'NOISE vs SIGNAL',   tags: ['foresight'],         content: 'Most data is noise. Bayesian updating helps separate the two.', x: 150,  y:  -80, role: 'standalone', parentIds: [], sectionId: null },
  { id: 10, type: 'PATTERN', label: 'PATH DEPENDENCE',   tags: ['systems'],           content: 'Current options constrained by historical decisions. QWERTY effect.', x: 360,  y:  140, role: 'standalone', parentIds: [], sectionId: null },
  { id: 11, type: 'ACTOR',   label: 'SYSTEM BOUNDARY',   tags: ['systems'],           content: 'What you include defines what you can understand. Choose carefully.', x: -250, y:  -60, role: 'standalone', parentIds: [], sectionId: null },
  { id: 12, type: 'MODEL',   label: 'FIRST PRINCIPLES',  tags: ['thinking'],          content: 'Decompose to fundamental truths. Expensive but yields high insight.', x: 80,   y:  260, role: 'standalone', parentIds: [], sectionId: null },
  { id: 13, type: 'CONCEPT', label: 'LEVERAGE POINTS',   tags: ['systems'],           content: 'Places to intervene in a system. Meadows ranked 12. Most are counterintuitive.', x: -180, y: 130, role: 'standalone', parentIds: [], sectionId: null },
]

export const EDGES = []

export const DEFAULT_SECTIONS = [
  { id: 'sec-0', label: 'PLANNING',    x: -1050, y: -500, width: 460, height: 1000, color: '#4488ff' },
  { id: 'sec-1', label: 'IN PROGRESS', x:  -540, y: -500, width: 460, height: 1000, color: '#ffaa00' },
  { id: 'sec-2', label: 'REVIEW',      x:   -30, y: -500, width: 460, height: 1000, color: '#cc88ff' },
  { id: 'sec-3', label: 'DONE',        x:   480, y: -500, width: 460, height: 1000, color: '#00ff99' },
]
