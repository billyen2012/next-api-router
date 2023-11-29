# @billyen2012/next-api-router

## 1.3.0

### Minor Changes

- all incoming request must have correct `content-type` in the header to trigger the body-parser
- if number exceed Number.MAX_SAFE_INTEGER in query param or url param, it will just be a `string` of number instead of a `BigInt`
- added `form()` body-parser

### Patch Changes

- miscellaneous fixes

## 1.2.0

### Minor Changes

- add writeLine(), end() methods to response object.
- update readme.

### Patch Changes

- miscellaneous fixes.
