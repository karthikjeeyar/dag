---
"@graphtools/dag": patch
---

Ship the build output in the published tarball.

`1.0.3` and `1.1.0` were published from CI without running a build, and
`files: ["dist"]` silently omits a directory that does not exist. The result
was a tarball containing only `package.json`, `README.md` and `LICENSE`, so
`require("@graphtools/dag")` failed with `Cannot find module dist/index.js`.

`prepack` now runs the build, so any `npm publish` or `npm pack` produces a
complete tarball, and npm aborts the publish if the build fails.

If you installed `1.0.3` or `1.1.0`, upgrade to this version.
