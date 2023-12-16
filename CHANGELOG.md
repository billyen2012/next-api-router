# @billyen2012/next-api-router

## 1.10.1

### Patch Changes

- fixed based route of the nested router issue.

## 1.10.0

### Minor Changes

- add `rewrite()` to response object

## 1.9.4

### Patch Changes

- remove utility function `getBaseUrl()`. Instead, code example will be provided

## 1.9.3

### Patch Changes

- code refactor
- add `getBaseUrl()` utility function

## 1.9.2

### Patch Changes

- miscellaneous fixes

## 1.9.1

### Patch Changes

- fix prefixed wildcard route behavior

## 1.9.0

### Minor Changes

- now wildcard can use a prefix (e.g. `/example*`)

### Patch Changes

- use protect-prefix to completely removed the possibility of request route collision with internally used route

## 1.8.0

### Minor Changes

- new feature: allowing return data to be treated as response

### Patch Changes

- in `sendFile()`, unknown file type will use `application/octet-stream` for `content-type` header
- add more file type for setting content-type of `sendFile()`

## 1.7.2

### Patch Changes

- allow option timeout=false , which will completely disabled to built-in timeout mechanism
- optimize test
- code refactor

## 1.7.1

### Patch Changes

- miscellaneous fixes
- refactor

## 1.7.0

### Minor Changes

- add `res.sendFile()`
- add wildcard to route detechtion
- rewrite router-binding-to-router logic to enable more features
- rewrite `static()`
- the headers in `static(path, headers)` can now take a callback

### Patch Changes

- code refactor

## 1.6.3

### Patch Changes

- child router's error handler , if set, must call `next()` to move to it's parent error handler. This is to keep the coding style consistent.
- code refactor
- cutdown readme section

## 1.6.2

### Patch Changes

- error chaining: all error handlers between the child router (if-set) and outter most parent router will be executed until a response is sent
- fix method-now-allow issue introduced in v1.6.0
- timeout value should be getting from the it's own router instance instead of the outter most parent router

## 1.6.1

### Patch Changes

- fixed middleware disappear issue
- router/sub-router middleware selection

## 1.6.0

### Minor Changes

- add `setStatusMessage()`
- add `res.writeHead()` can now take 3 args.
- add `write()` method
- add props `statusMessage` and setter for `statusCode` to response

### Patch Changes

- fix naming typo in `.d.ts`

## 1.5.0

### Minor Changes

- add `static()` method for serving static files

### Patch Changes

- fix bug of route-not-found and method-not-allow issue

## 1.4.3

### Patch Changes

- fix `res.redirect()` issue
- fix child router not picking up post-middleware from the parent

## 1.4.2

### Patch Changes

- fix `json()` set header issue

## 1.4.1

### Patch Changes

- route method should also suffix/prefix with an instance id to prevent collision

## 1.4.0

### Minor Changes

- fix middleware issues in complex sequence

### Patch Changes

- add internal state for express.js middelware compatibility
- fix middelwares not called if 404

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
