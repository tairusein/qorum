## 2026-10-29 - [Avoid `querySelectorAll("*")` in `localizeTree`]
**Learning:** Using `querySelectorAll("*")` for attribute localization is a codebase-specific anti-pattern causing massive redundant iterations, forcing iteration over every single DOM element instead of only those with translatable attributes.
**Action:** Replace `querySelectorAll("*")` with a specific selector like `querySelectorAll("[placeholder], [aria-label], [title]")` to target only the necessary elements, avoiding unnecessary DOM traversal and improving performance.
## 2024-05-16 - TreeWalker Root Iteration
**Learning:** `TreeWalker.nextNode()` skips the root node that is passed into `createTreeWalker`. If you need to process the root node as well, you must do it manually before the loop.
**Action:** When using `TreeWalker` to replace `querySelectorAll` or recursive traversals, always manually process the root node if it meets the filter criteria.
