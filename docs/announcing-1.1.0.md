# My DAG library sat untouched for a year. Its only interesting feature was broken.

I published `@graphtools/dag` in July 2024. Two hundred and forty-two lines of
TypeScript, a CI pipeline, changesets wired up for releases. Then I did not
touch it again.

A year later it had one star, no forks, no issues, and around 16 downloads a
month, which I assume are registry mirrors rather than people.

That is not a growth story that went wrong. It is a project that was never
launched. But when I reopened the code, the interesting part was not the lack
of traction. It was that the one feature that made the library different from
every other DAG package was broken, and the README described output that the
code could not produce.

## What the library actually does

Most "DAG" packages in JavaScript solve one problem: give me a topological
order. That problem is solved. `dependency-graph` gets about 99 million
downloads a month. `toposort` gets 69 million. Writing another one and hoping
to win on correctness is not a strategy.

Mine did one thing those do not. Besides the order, it computed a stage for
each node, meaning which nodes have no dependency between them and can run at
the same time, and it could render that as a pipeline:

```
| lint       | -> | build      | -> | e2e        |
                  | unit-tests |
```

That is the whole value proposition. If you are scheduling work, the stage
number is the useful part. The picture is how you explain the plan to someone
else.

## The bug

`printPipeline()` repeated the task name to fill the cell width:

```ts
result += `| ${stageObj.name.repeat(maxLength - 2)} |`;
```

It should have been `padEnd`. With single character names like `A` and `B`,
`repeat(1)` and `padEnd(1)` produce the same string, so every example looked
perfect. With real task names:

```
| buildbuildbuildbuildbuildbuild |        -> | testtesttesttesttesttest |        -> | deploydeploydeploydeploydeploydeploy |
```

Nobody would use a library that renders that. And the README used single
letters throughout, because I wrote the examples from the tests, and the tests
used single letters, because I wrote them from the examples.

## The README was wrong too

The second example claimed this output:

```
| A |   -> | B |   -> | C |   -> | E |   -> | F |
                      | D |
```

That draws `D` and `E` as parallel. The same example constructs `E` with
`runAfter: ["D"]`, so `E` cannot be in the same stage as `D`. The real output
is a straight chain. I had never run the example as written. The
documentation was a sketch of what I remembered the code doing.

## Why CI was green

Eight tests. All passing. None of them called `printPipeline()` at all.

The suite covered the parts I was confident about and skipped the part I was
selling. A green check told me the graph worked. It said nothing about the only
thing that differed from the competition.

## Two more things I found once I started looking

Stages were cached on the vertex and never invalidated. Read `dag.vertices`,
add an edge, read again: the stage is still the number from before the edge
existed. The `vertices` getter also computed stages as a side effect, which
looks harmless until someone holds a reference to the map.

Cycle errors were unhelpful:

```
cycle detected: C --> B --> A --> A
```

Two problems: a repeated node, and a path that is not the cycle. The real cycle
is `A --> B --> C --> A`. When the error message is the only debugging
information you get, a wrong message is a bug.

## What I changed

- `padEnd` instead of `repeat`, and each row trimmed.
- A dirty flag, so stages recompute when the graph changes and only then. The
  computation is iterative now, so a deep chain cannot overflow the stack.
- Cycle detection walks the dependency chain from the new source to the target
  and reports it in order.
- `Object.create(null)` for the dependency maps, so a vertex named `constructor`
  or `__proto__` cannot collide with `Object.prototype`.
- Empty names, self-edges, and cycles throw instead of returning quietly.
- `printGraph()` stopped writing to stdout, and unrelated components print on
  separate lines instead of being joined by an arrow that implies a dependency.
- Payloads can be falsy now. `addVertex("A", 0)` used to be ignored.
- `Vertex` and `Vertices` are exported, and `DAG` is generic over the payload.

## How I checked it this time

I wanted evidence rather than confidence. Three things changed.

The suite went from 8 tests to 27, including the cases that would have caught
all of the above. Run against the old code, 16 of them fail. A test that passes
against both the broken and the fixed version is not testing anything.

I generated 500 random DAGs and asserted invariants: every topological order
respects every edge, every stage equals one plus the maximum stage among its
dependencies, every node appears exactly once in the render, every back-edge is
rejected. About 12,000 assertions.

And the README examples are generated from the code. If the output changes, the
documentation has to change with it.

## What I would do differently

Write the README example first, then make it run in CI. An example you never
execute is not documentation, it is a wish.

Use realistic data in the demo. Single letter node names hid a rendering bug for
a year. If the example had said `build` and `test`, I would have found it in ten
minutes.

Test the feature you are selling. The tests I wrote were the tests I was
comfortable writing.

## Does this make the library popular?

No. It makes it correct, which is necessary and nowhere near sufficient. The
market for a topological sort is saturated, and fixing bugs does not create
demand for something nobody was looking for.

What it does is make the README's claim true, which is the minimum for asking
anyone to try it.

If you have a list of tasks with dependencies and you want to know which ones
can run in parallel, it now does that properly:

```
npm install @graphtools/dag
```

If you find a bug, open an issue. I will read it this time.

---

## Publishing notes (delete before posting)

**Title options**

1. My DAG library sat untouched for a year. Its only interesting feature was
   broken.
2. The ASCII pipeline renderer was harder than the graph.
3. I found three bugs in a year-old library, including one in its own README.

**Where to post**

- dev.to with tags `javascript`, `typescript`, `opensource`. Easiest first
  post, and it indexes well.
- r/node. Read the self-promotion rules first; if the subreddit requires it,
  post the story without the install link and put the link in a comment.
- Hacker News as a "Show HN" only if you have a screenshot and a demo. The
  essay is not a Show HN on its own.
- LinkedIn if you want the professional audience. Same title, add a screenshot
  of the pipeline output as the image.

**Before posting**

- Make sure `1.1.0` is on npm. The changeset release has to be merged and
  published first, otherwise every reader who runs `npm install` gets the
  broken renderer.
- Add a screenshot of the pipeline output as the post image. It is the only
  visual the post has.
- Put the repo link and the npm link in the first comment, not the body, if the
  platform penalises links.

**Don't claim**

- That it is faster than anything. You have not benchmarked it.
- That it is a toposort replacement. It is not trying to be.
- Any download or user numbers. There are none worth reporting, and inventing
  momentum is the fastest way to lose the audience that would have tried it.
