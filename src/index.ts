/**
 * A node of the graph.
 *
 * `T` is the type of the payload attached to a vertex.
 */
export type Vertex<T = any> = {
  /** Unique name of the vertex within the graph. */
  name: string;
  /** Vertices this vertex depends on (the ones that must run before it), keyed by name. */
  dependancy: Record<string, Vertex<T>>;
  /** Names of the vertices in `dependancy`, in insertion order. */
  dependancyNames: string[];
  /** `true` when this vertex has at least one outgoing edge. */
  hasOutgoing: boolean;
  /** Payload attached to the vertex. */
  data: T | undefined;
  /**
   * One-based execution level: `1` for vertices without dependencies, otherwise
   * one more than the highest stage among its dependencies. Vertices sharing a
   * stage can run in parallel.
   *
   * Computed on demand through {@link DAG.vertices} and {@link DAG.printPipeline};
   * treat it as read-only.
   */
  stage?: number;
};

export type Vertices<T = any> = Map<string, Vertex<T>>;

const ARROW = " -> ";

const isValidName = (name: unknown): name is string =>
  typeof name === "string" && name.trim().length > 0;

/**
 * A directed acyclic graph of named vertices.
 *
 * Edges point from a vertex to the vertices that must run after it, so an
 * edge `A -> B` means "A before B". Adding an edge that would close a cycle
 * throws instead of corrupting the graph.
 */
export class DAG<T = any> {
  private _names: string[] = [];
  private _vertices: Vertices<T> = new Map<string, Vertex<T>>();
  private _stagesDirty = true;

  /** Names of all vertices, in insertion order. */
  public get names(): string[] {
    return [...this._names];
  }

  /** All vertices, with `stage` recomputed if the graph changed since the last read. */
  public get vertices(): Vertices<T> {
    this.computeStages();
    return this._vertices;
  }

  /**
   * Adds a vertex, or updates the payload of an existing one.
   *
   * @returns the vertex, or `null` when the name is empty.
   */
  public addVertex(name: string, data?: T): Vertex<T> | null {
    if (!isValidName(name)) {
      return null;
    }

    const existing = this._vertices.get(name);
    if (existing) {
      // `undefined` is the only value that means "no payload change": falsy
      // payloads such as 0, "" and false are legitimate values.
      if (data !== undefined) {
        existing.data = data;
      }
      return existing;
    }

    const vertex: Vertex<T> = {
      name,
      dependancy: Object.create(null) as Record<string, Vertex<T>>,
      dependancyNames: [],
      hasOutgoing: false,
      data,
    };
    this._vertices.set(name, vertex);
    this._names.push(name);
    this._stagesDirty = true;
    return vertex;
  }

  /**
   * Adds a directed edge from `source` to `target` (`source` runs before `target`).
   *
   * Adding an edge that already exists is a no-op. Adding an edge that would
   * create a cycle throws, and leaves the graph untouched.
   *
   * @throws when either name is empty, when source and target are the same
   * vertex, or when the edge would introduce a cycle.
   */
  public addEdge(source: string, target: string): void {
    if (!isValidName(source) || !isValidName(target)) {
      const invalid = !isValidName(source) ? source : target;
      throw new Error(`invalid vertex name: ${JSON.stringify(invalid)}`);
    }

    if (source === target) {
      throw new Error(`cycle detected: ${source} --> ${source}`);
    }

    const fromNode = this.addVertex(source) as Vertex<T>;
    const toNode = this.addVertex(target) as Vertex<T>;

    if (toNode.dependancy[source]) {
      return;
    }

    const chain = this.findDependencyChain(fromNode, target);
    if (chain) {
      throw new Error(
        `cycle detected: ${[...chain].reverse().join(" --> ")} --> ${target}`
      );
    }

    fromNode.hasOutgoing = true;
    toNode.dependancy[source] = fromNode;
    toNode.dependancyNames.push(source);
    this._stagesDirty = true;
  }

  /**
   * Adds a vertex together with its edges.
   *
   * @param runBefore vertices that must run after `name`
   * @param runAfter vertices that must run before `name`
   */
  public addEdges(
    name: string,
    data?: T,
    runBefore?: string | string[],
    runAfter?: string | string[]
  ): void {
    if (!isValidName(name)) {
      throw new Error(`invalid vertex name: ${JSON.stringify(name)}`);
    }

    this.addVertex(name, data);

    for (const before of toList(runBefore)) {
      this.addEdge(name, before);
    }

    for (const after of toList(runAfter)) {
      this.addEdge(after, name);
    }
  }

  /**
   * Walks the graph depth-first and calls `fn` for every vertex after its
   * dependencies, which yields a topological order.
   */
  public topologicalSort(fn: (vertex: Vertex<T>, path: string[]) => void): void {
    const visited = new Set<string>();

    for (const name of this._names) {
      const vertex = this._vertices.get(name) as Vertex<T>;
      if (!vertex.hasOutgoing) {
        this.visit(vertex, fn, visited, []);
      }
    }
  }

  /**
   * Renders the graph as arrows, one line per connected component so that
   * unrelated components never look like they depend on each other.
   */
  public printGraph(): string {
    if (this._vertices.size === 0) {
      return "";
    }

    const order: string[] = [];
    this.topologicalSort((vertex) => order.push(vertex.name));

    return this.weaklyConnectedComponents()
      .map((component) => {
        const members = new Set(component);
        return order.filter((name) => members.has(name)).join(" --> ");
      })
      .join("\n");
  }

  /**
   * Renders the vertices as a stage-by-stage pipeline: each column is a stage,
   * every vertex in a column can run in parallel.
   */
  public printPipeline(): string {
    const stages = this.stageGroups();
    if (stages.length === 0) {
      return "";
    }

    const width = Math.max(...this._names.map((name) => name.length));
    const cell = (name: string) => `| ${name.padEnd(width)} |`;
    const blank = " ".repeat(width + 4);
    const rowCount = Math.max(...stages.map((stage) => stage.length));
    const lines: string[] = [];

    for (let row = 0; row < rowCount; row++) {
      let line = "";
      stages.forEach((stage, column) => {
        if (column > 0) {
          line += row === 0 ? ARROW : " ".repeat(ARROW.length);
        }
        const vertex = stage[row];
        line += vertex ? cell(vertex.name) : blank;
      });
      lines.push(line.trimEnd());
    }

    return lines.join("\n");
  }

  private visit(
    vertex: Vertex<T>,
    fn: (vertex: Vertex<T>, path: string[]) => void,
    visited: Set<string>,
    path: string[]
  ): void {
    if (visited.has(vertex.name)) {
      return;
    }

    visited.add(vertex.name);
    path.push(vertex.name);

    for (const depName of vertex.dependancyNames) {
      const dependency = vertex.dependancy[depName];
      if (dependency) {
        this.visit(dependency, fn, visited, path);
      }
    }

    fn(vertex, path);
    path.pop();
  }

  /**
   * Returns the dependency chain `from -> ... -> target`, or `null` when
   * `target` is not an ancestor of `from`. Used to reject cycles with an
   * accurate message.
   */
  private findDependencyChain(
    vertex: Vertex<T>,
    target: string,
    path: string[] = [],
    exhausted: Set<string> = new Set<string>()
  ): string[] | null {
    path.push(vertex.name);

    if (vertex.name === target) {
      return path.slice();
    }

    if (exhausted.has(vertex.name)) {
      path.pop();
      return null;
    }
    exhausted.add(vertex.name);

    for (const depName of vertex.dependancyNames) {
      const dependency = vertex.dependancy[depName];
      if (!dependency) {
        continue;
      }
      const found = this.findDependencyChain(dependency, target, path, exhausted);
      if (found) {
        return found;
      }
    }

    path.pop();
    return null;
  }

  /**
   * Assigns `stage` to every vertex. Recomputed only when the graph changed,
   * and iteratively so that deep graphs cannot overflow the call stack.
   */
  private computeStages(): void {
    if (!this._stagesDirty) {
      return;
    }

    for (const vertex of this._vertices.values()) {
      vertex.stage = undefined;
    }

    for (const root of this._vertices.values()) {
      if (root.stage !== undefined) {
        continue;
      }

      const stack: Array<{ vertex: Vertex<T>; next: number }> = [
        { vertex: root, next: 0 },
      ];

      while (stack.length > 0) {
        const frame = stack[stack.length - 1] as { vertex: Vertex<T>; next: number };
        const { vertex } = frame;

        if (frame.next < vertex.dependancyNames.length) {
          const depName = vertex.dependancyNames[frame.next] as string;
          frame.next += 1;
          const dependency = vertex.dependancy[depName];
          if (dependency && dependency.stage === undefined) {
            stack.push({ vertex: dependency, next: 0 });
          }
          continue;
        }

        let maxStage = 0;
        for (const depName of vertex.dependancyNames) {
          const dependency = vertex.dependancy[depName];
          if (dependency && dependency.stage !== undefined) {
            maxStage = Math.max(maxStage, dependency.stage);
          }
        }
        vertex.stage = maxStage + 1;
        stack.pop();
      }
    }

    this._stagesDirty = false;
  }

  /** Vertices grouped by stage, in insertion order within each stage. */
  private stageGroups(): Vertex<T>[][] {
    this.computeStages();

    const groups: Vertex<T>[][] = [];
    for (const name of this._names) {
      const vertex = this._vertices.get(name) as Vertex<T>;
      const index = (vertex.stage ?? 1) - 1;
      (groups[index] ??= []).push(vertex);
    }
    return groups;
  }

  /** Groups of vertices that are connected when edge direction is ignored. */
  private weaklyConnectedComponents(): string[][] {
    const adjacency = new Map<string, string[]>();
    for (const name of this._names) {
      adjacency.set(name, []);
    }
    for (const name of this._names) {
      const vertex = this._vertices.get(name) as Vertex<T>;
      for (const depName of vertex.dependancyNames) {
        (adjacency.get(name) as string[]).push(depName);
        adjacency.get(depName)?.push(name);
      }
    }

    const seen = new Set<string>();
    const components: string[][] = [];

    for (const name of this._names) {
      if (seen.has(name)) {
        continue;
      }

      const component: string[] = [];
      const queue: string[] = [name];
      seen.add(name);

      for (let index = 0; index < queue.length; index++) {
        const current = queue[index] as string;
        component.push(current);
        for (const neighbour of adjacency.get(current) ?? []) {
          if (!seen.has(neighbour)) {
            seen.add(neighbour);
            queue.push(neighbour);
          }
        }
      }

      components.push(component);
    }

    return components;
  }
}

const toList = <V>(value: V | V[] | undefined): V[] => {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};
