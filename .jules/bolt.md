## 2026-10-29 - [Avoid `querySelectorAll("*")` in `localizeTree`]
**Learning:** Using `querySelectorAll("*")` for attribute localization is a codebase-specific anti-pattern causing massive redundant iterations, forcing iteration over every single DOM element instead of only those with translatable attributes.
**Action:** Replace `querySelectorAll("*")` with a specific selector like `querySelectorAll("[placeholder], [aria-label], [title]")` to target only the necessary elements, avoiding unnecessary DOM traversal and improving performance.
## 2023-10-29 - [Use reduce for DOM string concatenation]
**Learning:** Using `map().join("")` on arrays to generate HTML strings creates unnecessary intermediate arrays, adding garbage collection overhead, especially in frequent rendering loops.
**Action:** Replace `map().join("")` with `reduce((acc, item) => acc + render(item), "")` when generating HTML strings to avoid intermediate array allocations and improve rendering performance.
