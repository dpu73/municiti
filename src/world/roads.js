export const ROAD_TYPES = {
  dirt: {
    name: 'Dirt Track',
    lanes: 1,
    width: 4,
    speedLimit: 25,
    color: 0xb5935a,
    costPerUnit: 5,
    durability: 0.3,
    description: '1 lane · 25mph · $5/unit',
  },
  gravel: {
    name: 'Gravel Road',
    lanes: 2,
    width: 6,
    speedLimit: 35,
    color: 0x9e9e8a,
    costPerUnit: 15,
    durability: 0.5,
    description: '2 lane · 35mph · $15/unit',
  },
  asphalt: {
    name: 'Asphalt',
    lanes: 2,
    width: 8,
    speedLimit: 45,
    color: 0x555555,
    costPerUnit: 40,
    durability: 0.8,
    description: '2 lane · 45mph · $40/unit',
  },
  avenue: {
    name: 'Avenue',
    lanes: 4,
    width: 14,
    speedLimit: 45,
    color: 0x444444,
    costPerUnit: 80,
    durability: 0.85,
    description: '4 lane · 45mph · $80/unit',
  },
  highway: {
    name: 'Highway',
    lanes: 6,
    width: 22,
    speedLimit: 65,
    color: 0x333333,
    costPerUnit: 200,
    durability: 0.95,
    description: '6 lane · 65mph · $200/unit',
  },
};

let _nodeId = 0;
let _segmentId = 0;

export class RoadGraph {
  constructor() {
    this.nodes    = new Map(); // id -> node
    this.segments = new Map(); // id -> segment
  }

  getOrCreateNode(x, z, snapTolerance = 2) {
    for (const node of this.nodes.values()) {
      if (Math.abs(node.x - x) <= snapTolerance && Math.abs(node.z - z) <= snapTolerance) {
        return node;
      }
    }
    const node = { id: _nodeId++, x, z, segmentIds: [], intersectionType: 'none' };
    this.nodes.set(node.id, node);
    return node;
  }

  addSegment(ax, az, bx, bz, roadType = 'asphalt') {
    const nodeA = this.getOrCreateNode(ax, az);
    const nodeB = this.getOrCreateNode(bx, bz);
    if (nodeA.id === nodeB.id) return null;

    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dz * dz);

    const segment = {
      id: _segmentId++,
      nodeAId: nodeA.id,
      nodeBId: nodeB.id,
      roadType,
      length,
      condition: 1.0,
      owner: 'player',
      trafficLoad: 0,
    };

    nodeA.segmentIds.push(segment.id);
    nodeB.segmentIds.push(segment.id);
    this.segments.set(segment.id, segment);

    this._updateIntersection(nodeA);
    this._updateIntersection(nodeB);

    console.log(`[roads] Segment ${segment.id} added: ${roadType}, length ${length.toFixed(1)}, cost $${this.segmentCost(ax, az, bx, bz, roadType)}`);
    return segment;
  }

  _updateIntersection(node) {
    node.intersectionType = node.segmentIds.length >= 3 ? 'stop' : 'none';
  }

  segmentCost(ax, az, bx, bz, roadType) {
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dz * dz);
    return Math.ceil(length * ROAD_TYPES[roadType].costPerUnit);
  }
}