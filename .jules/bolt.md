## 2026-10-29 - [Avoid `querySelectorAll("*")` in `localizeTree`]
**Learning:** Using `querySelectorAll("*")` for attribute localization is a codebase-specific anti-pattern causing massive redundant iterations, forcing iteration over every single DOM element instead of only those with translatable attributes.
**Action:** Replace `querySelectorAll("*")` with a specific selector like `querySelectorAll("[placeholder], [aria-label], [title]")` to target only the necessary elements, avoiding unnecessary DOM traversal and improving performance.

## 2024-05-16 - TreeWalker Root Iteration
**Learning:** `TreeWalker.nextNode()` skips the root node that is passed into `createTreeWalker`. If you need to process the root node as well, you must do it manually before the loop.
**Action:** When using `TreeWalker` to replace `querySelectorAll` or recursive traversals, always manually process the root node if it meets the filter criteria.

## 2026-10-29 - [Cache DOM queries outside event listeners]
**Learning:** Calling `document.querySelectorAll` inside a `click` event listener's loop, or any other frequently triggered event listener, causes redundant DOM queries that can degrade performance, especially on larger DOM trees.
**Action:** Cache the result of `document.querySelectorAll` in a variable outside the event listener and reuse that variable inside the listener.
**Learning:** Calling `document.querySelectorAll` inside a `click` event listener's loop, or any other frequently triggered event listener, causes redundant DOM queries that can degrade performance, especially on larger DOM trees.
**Action:** Cache the result of `document.querySelectorAll` in a variable outside the event listener and reuse that variable inside the listener.

## 2026-10-29 - [Use reduce for DOM string concatenation]
**Learning:** Using `map().join("")` on arrays to generate HTML strings creates unnecessary intermediate arrays, adding garbage collection overhead, especially in frequent rendering loops.
**Action:** Replace `map().join("")` with `reduce((acc, item) => acc + render(item), "")` when generating HTML strings to avoid intermediate array allocations and improve rendering performance.
