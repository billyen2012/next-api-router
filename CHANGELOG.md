# @billyen2012/next-api-router

## 1.3.4

### Patch Changes

- fix sub route more than 1 issue

## 1.3.3

### Patch Changes

- add more internal state for express.js middleware compatibility (now compatible to `helmet`, `cors` , `morgan` and `express-rate-limit`
- allow send `null` to body

## 1.3.2

### Patch Changes

- fix form() parser error when uploading a file

## 1.3.1

### Patch Changes

- update readme
- add homepage link

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
