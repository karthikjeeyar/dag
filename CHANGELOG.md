# @graphtools/dag

## 1.1.0

### Minor Changes

- 66c8730: Fix the renderers, the stage cache, and silent failures.

  - `printPipeline()` pads names to a common width instead of repeating them, so
    any task name longer than a single character renders correctly. Parallel
    vertices are stacked in one column and rows no longer end in whitespace.
  - Stages are recomputed whenever the graph changes instead of being cached
    forever, so `vertices` and `printPipeline()` never report stale stages.
  - `addEdge()` and `addEdges()` now throw on an empty name instead of quietly
    doing nothing. `addEdge()` also throws on a self-reference or a cycle, and
    the message contains the full cycle (`A --> B --> C --> A`). A rejected edge
    leaves the graph untouched.
  - `printGraph()` no longer writes to stdout, and unrelated components are
    printed on separate lines instead of implying a dependency between them.
  - `addVertex()` accepts falsy payloads (`0`, `""`, `false`) when updating an
    existing vertex.
  - `Vertex` and `Vertices` are exported, and `DAG`/`Vertex` are generic over
    the payload type.
  - Removed the unused `add` runtime dependency.

## 1.0.3

### Patch Changes

- 3af9e96: Add print pipeline method

### Patch Changes

- ecef2f3: Add changeset and switch to pnpm
