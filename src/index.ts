type Vertex = {
  name: string;
  dependancy: Record<string, Vertex>;
  dependancyNames: string[];
  hasOutgoing: boolean;
  data: any;
  stage?: number;
};

type Vertices = Map<string, Vertex>;

export class DAG {
  names: string[];
  vertices: Vertices;

  constructor() {
    this.names = [];
    this.vertices = new Map<string, Vertex>();
  }

  private visit(
    vertex: Vertex,
    fn: (v: Vertex, path: string[]) => void,
    visited: Map<string, boolean> = new Map<string, boolean>(),
    path: string[] = [],
    stack: Set<string> = new Set<string>()
  ): void {
    const { name, dependancy, dependancyNames } = vertex;

    if (stack.has(name)) {
      throw new Error(`cycle detected: ${path.join(" --> ")} --> ${name}`);
    }

    if (visited.has(name)) {
      return;
    }

    stack.add(name);
    path.push(name);
    visited.set(name, true);

    for (const depName of dependancyNames) {
      if (dependancy[depName])
        this.visit(dependancy[depName], fn, visited, path, stack);
    }

    fn(vertex, path);
    stack.delete(name);
    path.pop();
  }

  addVertex(name: string, data?: any): Vertex | null {
    if (!name) {
      return null;
    }

    if (this.vertices.has(name)) {
      return this.vertices.get(name) as Vertex;
    }

    const vertex: Vertex = {
      name,
      dependancy: {},
      dependancyNames: [],
      hasOutgoing: false,
      data,
    };
    this.vertices.set(name, vertex);
    this.names.push(name);
    return vertex;
  }

  addEdge(source: string, target: string): void {
    if (!source || !target || source === target) {
      return;
    }

    const fromNode = this.addVertex(source);
    const toNode = this.addVertex(target);

    if (!fromNode || !toNode || toNode.dependancy[source]) {
      return;
    }

    const checkCycle = (vertex: Vertex, path: string[]) => {
      if (vertex.name === target) {
        throw new Error(`cycle detected: ${path.join(" --> ")} --> ${target}`);
      }
    };

    this.visit(fromNode, checkCycle);

    fromNode.hasOutgoing = true;
    toNode.dependancy[source] = fromNode;
    toNode.dependancyNames.push(source);
  }

  addEdges(
    name: string,
    data: any,
    runBefore: string | string[],
    runAfter: string | string[]
  ): void {
    this.addVertex(name, data);

    if (runBefore) {
      if (typeof runBefore === "string") {
        this.addEdge(name, runBefore);
      } else {
        runBefore.forEach((b) => this.addEdge(name, b));
      }
    }

    if (runAfter) {
      if (typeof runAfter === "string") {
        this.addEdge(runAfter, name);
      } else {
        runAfter.forEach((a) => this.addEdge(a, name));
      }
    }
  }

  private computeStages(): void {
    const stageMap: Map<string, number> = new Map();
    const computeStageForVertex = (vertex: Vertex): number => {
      if (vertex.stage !== undefined) {
        return vertex.stage;
      }

      let maxStage = 0;
      for (const depName of vertex.dependancyNames) {
        const depVertex = vertex.dependancy[depName];
        if (depVertex)
          maxStage = Math.max(maxStage, computeStageForVertex(depVertex));
      }

      const stage = maxStage + 1;
      vertex.stage = stage;
      stageMap.set(vertex.name, stage);
      return stage;
    };

    this.names.forEach((name) => {
      const vertex = this.vertices.get(name) as Vertex;
      computeStageForVertex(vertex);
    });
  }

  topologicalSort(fn: (v: Vertex, path: string[]) => void): void {
    this.computeStages(); // Ensure stages are computed before printing

    const visited = new Map<string, boolean>();
    const { vertices, names } = this;

    for (const name of names) {
      const vertex = vertices.get(name) as Vertex;
      if (!vertex.hasOutgoing) {
        this.visit(vertex, fn, visited);
      }
    }
  }

  printGraph(): string {
    const orderedNodes: string[] = [];
    this.topologicalSort((v: Vertex) => {
      orderedNodes.push(`${v.name}`);
    });

    const result = orderedNodes.join(" --> ");
    console.log(result);
    return result;
  }
}
