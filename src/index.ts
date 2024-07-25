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
  private _names: string[];
  private _vertices: Vertices;

  constructor() {
    this._names = [];
    this._vertices = new Map<string, Vertex>();
  }

  public get names() {
    return this._names;
  }

  public get vertices() {
    this.computeStages();
    return this._vertices;
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

  public addVertex(name: string, data?: any): Vertex | null {
    if (!name) {
      return null;
    }

    if (this._vertices.has(name)) {
      const vertex = this._vertices.get(name) as Vertex;
      if (data) vertex.data = data;
      return vertex;
    }

    const vertex: Vertex = {
      name,
      dependancy: {},
      dependancyNames: [],
      hasOutgoing: false,
      data,
    };
    this._vertices.set(name, vertex);
    this._names.push(name);
    return vertex;
  }

  public addEdge(source: string, target: string): void {
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

  public addEdges(
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

    this._names.forEach((name) => {
      const vertex = this._vertices.get(name) as Vertex;
      computeStageForVertex(vertex);
    });
  }

  public topologicalSort(fn: (v: Vertex, path: string[]) => void): void {
    const visited = new Map<string, boolean>();
    const { vertices, names } = this;

    for (const name of names) {
      const vertex = vertices.get(name) as Vertex;
      if (!vertex.hasOutgoing) {
        this.visit(vertex, fn, visited);
      }
    }
  }

  public printGraph(): string {
    const orderedNodes: string[] = [];
    this.topologicalSort((v: Vertex) => {
      orderedNodes.push(`${v.name}`);
    });

    const result = orderedNodes.join(" --> ");
    console.log(result);
    return result;
  }

  private _groupBy(array: Vertex[], key: keyof Vertex) {
    return array.reduce((result, currentValue) => {
      const groupKey = currentValue[key];
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(currentValue);
      return result;
    }, {} as Record<string, Vertex[]>);
  }

  public printPipeline() {
    const obj = Object.fromEntries(this.vertices.entries());
    const dagObj = Object.values(obj);
    const stages = Object.values(this._groupBy(dagObj, "stage"));

    const flatStages = stages.flat();
    const maxLength =
      Math.max(...flatStages.map((stageObj: Vertex) => stageObj.name.length)) +
      2;

    let result = "";

    // Build the top part with first task name in stages.
    stages.forEach((stage_inner, top_index) => {
      stage_inner.forEach((stageObj, index) => {
        if (stage_inner.length === 1) {
          result += `| ${stageObj.name.repeat(maxLength - 2)} |`;
        } else {
          if (index === 0)
            result += `| ${stageObj.name.repeat(maxLength - 2)} |`;
        }
      });
      // Add edges
      if (top_index < stages.length - 1) {
        result += ` ${" ".repeat(maxLength - 2)} -> `;
      }
    });
    result += "\n";

    // Build the parallel task names
    const maxParallelTaskCount = stages.reduce((acc, stage) => {
      acc = Math.max(acc, stage.length);
      return acc;
    }, 0);

    for (let i = 1; i < maxParallelTaskCount; i++) {
      stages.forEach((stage) => {
        const task = stage[i];
        if (task) {
          result += `| ${task.name.padEnd(maxLength - 2)} |`;
        } else {
          result += ` ${" ".repeat(maxLength * 3)} `;
        }
      });
      result += "\n";
    }
    return result;
  }
}
