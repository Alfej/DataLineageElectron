export interface TableRelation {
  parentTableName: string;
  childTableName: string;
  parentTableType: string;
  childTableType: string;
  relationship: string;
  ClientID: string;
  AppID: string;
  [key: string]: any;
}

// Lightweight directed graph model useful for traversal and queries
export class GraphModel {
  // adjacency list from parent -> Set(children)
  private children: Map<string, Set<string>> = new Map();
  // reverse adjacency list child -> Set(parents)
  private parents: Map<string, Set<string>> = new Map();
  // store node metadata
  private nodes: Set<string> = new Set();

  constructor(relations: TableRelation[] = []) {
    this.buildFromData(relations);
  }

  clear() {
    this.children.clear();
    this.parents.clear();
    this.nodes.clear();
  }

  buildFromData(relations: TableRelation[]) {
    this.clear();
    for (const r of relations) {
      const p = String(r.parentTableName);
      const c = String(r.childTableName);
      if (!p || !c) continue;
      this.nodes.add(p);
      this.nodes.add(c);
      if (!this.children.has(p)) this.children.set(p, new Set());
      if (!this.parents.has(c)) this.parents.set(c, new Set());
      this.children.get(p)!.add(c);
      this.parents.get(c)!.add(p);
    }
  }

  addNode(id: string) {
    this.nodes.add(id);
  }

  addEdge(parent: string, child: string) {
    this.addNode(parent);
    this.addNode(child);
    if (!this.children.has(parent)) this.children.set(parent, new Set());
    if (!this.parents.has(child)) this.parents.set(child, new Set());
    this.children.get(parent)!.add(child);
    this.parents.get(child)!.add(parent);
  }

  getChildren(nodeId: string): string[] {
    return Array.from(this.children.get(nodeId) || []);
  }

  getParents(nodeId: string): string[] {
    return Array.from(this.parents.get(nodeId) || []);
  }

  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  getAllNodes(): string[] {
    return Array.from(this.nodes.values());
  }

  // Depth-first traversal
  dfs(start: string, visit: (node: string) => void, visited = new Set<string>()) {
    if (visited.has(start)) return;
    visited.add(start);
    visit(start);
    for (const c of this.getChildren(start)) this.dfs(c, visit, visited);
  }

  // Breadth-first traversal
  bfs(start: string, visit: (node: string) => void) {
    const q: string[] = [start];
    const visited = new Set<string>([start]);
    while (q.length) {
      const cur = q.shift()!;
      visit(cur);
      for (const c of this.getChildren(cur)) {
        if (!visited.has(c)) {
          visited.add(c);
          q.push(c);
        }
      }
    }
  }

  // Topological sort (Kahn's algorithm) — returns array or null if cycle
  topoSort(): string[] | null {
    const inDegree = new Map<string, number>();
    for (const n of this.getAllNodes()) inDegree.set(n, 0);
    for (const childs of this.children.values()) {
      for (const c of childs) inDegree.set(c, (inDegree.get(c) || 0) + 1);
    }
    const q: string[] = [];
    for (const [n, deg] of inDegree.entries()) if (deg === 0) q.push(n);
    const res: string[] = [];
    while (q.length) {
      const n = q.shift()!;
      res.push(n);
      for (const c of this.getChildren(n)) {
        inDegree.set(c, (inDegree.get(c) || 1) - 1);
        if (inDegree.get(c) === 0) q.push(c);
      }
    }
    return res.length === this.nodes.size ? res : null;
  }
}

export default GraphModel;
