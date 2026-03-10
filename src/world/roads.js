export const ROAD_TYPES = {
  dirt: {
    name:           'Dirt Track',
    lanes:          1,
    width:          4,
    speedLimit:     25,
    color:          0xb5935a,
    costPerUnit:    5,
    durability:     0.3,
    minTurnRadius:  5,
    description:    '1 lane · 25mph · $5/unit',
  },
  gravel: {
    name:           'Gravel Road',
    lanes:          2,
    width:          6,
    speedLimit:     35,
    color:          0x9e9e8a,
    costPerUnit:    15,
    durability:     0.5,
    minTurnRadius:  8,
    description:    '2 lane · 35mph · $15/unit',
  },
  asphalt: {
    name:           'Asphalt',
    lanes:          2,
    width:          8,
    speedLimit:     45,
    color:          0x555555,
    costPerUnit:    40,
    durability:     0.8,
    minTurnRadius:  15,
    description:    '2 lane · 45mph · $40/unit',
  },
  avenue: {
    name:           'Avenue',
    lanes:          4,
    width:          14,
    speedLimit:     45,
    color:          0x444444,
    costPerUnit:    80,
    durability:     0.85,
    minTurnRadius:  20,
    description:    '4 lane · 45mph · $80/unit',
  },
  highway: {
    name:           'Highway',
    lanes:          6,
    width:          22,
    speedLimit:     65,
    color:          0x333333,
    costPerUnit:    200,
    durability:     0.95,
    minTurnRadius:  40,
    description:    '6 lane · 65mph · $200/unit',
  },
};

let _nodeId    = 0;
let _segmentId = 0;

export class RoadGraph {
  constructor() {
    this.nodes    = new Map();
    this.segments = new Map();
  }

  getOrCreateNode(x, z, snapTolerance = 3) {
    for (const node of this.nodes.values()) {
      if (Math.abs(node.x - x) <= snapTolerance &&
          Math.abs(node.z - z) <= snapTolerance) return node;
    }
    const node = { id: _nodeId++, x, z, segmentIds: [], intersectionType: 'none' };
    this.nodes.set(node.id, node);
    return node;
  }

  addSegment(ax, az, bx, bz, roadType = 'asphalt', controlPoint = null) {
    const nodeA = this.getOrCreateNode(ax, az);
    const nodeB = this.getOrCreateNode(bx, bz);
    if (nodeA.id === nodeB.id) return null;

    const length = controlPoint
      ? this._bezierLength(ax, az, controlPoint.x, controlPoint.z, bx, bz)
      : Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);

    const segment = {
      id: _segmentId++,
      nodeAId:      nodeA.id,
      nodeBId:      nodeB.id,
      roadType,
      length,
      condition:    1.0,
      owner:        'player',
      trafficLoad:  0,
      controlPoint: controlPoint ?? null,
    };

    nodeA.segmentIds.push(segment.id);
    nodeB.segmentIds.push(segment.id);
    this.segments.set(segment.id, segment);
    this._updateIntersection(nodeA);
    this._updateIntersection(nodeB);
    return segment;
  }

  removeSegment(id) {
    const seg = this.segments.get(id);
    if (!seg) return;
    for (const nodeId of [seg.nodeAId, seg.nodeBId]) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      node.segmentIds = node.segmentIds.filter(s => s !== id);
      if (node.segmentIds.length === 0) this.nodes.delete(nodeId);
      else this._updateIntersection(node);
    }
    this.segments.delete(id);
    console.log(`[roads] Removed segment ${id}`);
  }

  _updateIntersection(node) {
    node.intersectionType = node.segmentIds.length >= 3 ? 'stop' : 'none';
  }

  _bezierLength(ax, az, cx, cz, bx, bz, steps = 20) {
    let len = 0, px = ax, pz = az;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const nx = it*it*ax + 2*it*t*cx + t*t*bx;
      const nz = it*it*az + 2*it*t*cz + t*t*bz;
      len += Math.sqrt((nx-px)**2 + (nz-pz)**2);
      px = nx; pz = nz;
    }
    return len;
  }

  segmentCost(ax, az, bx, bz, roadType, controlPoint = null) {
    const length = controlPoint
      ? this._bezierLength(ax, az, controlPoint.x, controlPoint.z, bx, bz)
      : Math.sqrt((bx-ax)**2 + (bz-az)**2);
    return Math.ceil(length * ROAD_TYPES[roadType].costPerUnit);
  }
}