import {
  NotFoundError,
  MalformedJsonError,
  NextApiRouteError,
  NoResponseFromHandlerError,
  TimeoutError,
  MethodNotAllowedError,
  InvalidReturnDataTypeError,
} from "./src/errors";
import { NextApiRouterResponse, getHeader, getHeaders } from "./src/response";
import { randomId } from "./src/util/randomId";
import typeis from "type-is";
import fs from "fs";
import path from "path";
import Static from "./src/static";
import { collectAllChildRouters } from "./src/util/collectAllChildrenRouters";
import {
  BASE_ROUTE_KEY,
  CURRENT_ROUTER_KEY,
  CHILD_ROUTERS_KEY,
  METHODS_KEY,
  PARENT_ROUTER_KEY,
  QUERY_PARAM_KEY,
  ROUTER_ID_KEY,
  SUPPORTED_HTTP_METHODS,
  WILDCARD_KEY,
  PROTECT_PREFIX,
  WILDCARD_PREFIX_KEY,
} from "./src/instance-constant";
import { makeTimeoutInstance } from "./src/util/makeTimeoutInstance";

/**
 * @callback NextApiProcessCallback
 * @param {Request | {query:{}, params:{}, data:any}} request
 * @param {NextApiRouterResponse} response
 * @param {(err)=>{}} next
 */

/**
 * @callback NextApiErrorHandlerCallback
 * @param {Error} err
 * @param {Request | {query:{}, params:{}, data:any}} request
 * @param {NextApiRouterResponse} response
 */

/**
 * @typedef {ReturnType<typeof NextApiRouter>} RouterInstance
 */

const getAllFilesInDirectory = (directoryPath) => {
  const absolutePath = path.resolve(directoryPath);

  let filesArray = [];

  const queue = [absolutePath];

  while (queue.length > 0) {
    const currentDirectory = queue.shift();
    const files = fs.readdirSync(currentDirectory);

    files.forEach((file) => {
      const filePath = path.join(currentDirectory, file);
      const relativePath = path.relative(absolutePath, filePath);

      if (fs.statSync(filePath).isDirectory()) {
        queue.push(filePath);
      } else {
        filesArray.push(relativePath);
      }
    });
  }

  return filesArray;
};

/**
 * prefixes are already sorted from longest to shortest
 * @param {undefined | string[]} prefixes
 * @param {string} urlPart
 */
const getWildcardPrefix = (prefixes, urlPart) => {
  if (!prefixes) {
    return "";
  }

  for (let prefix of prefixes) {
    if (urlPart.startsWith(prefix)) {
      return prefix;
    }
  }

  return "";
};

const makeNext = (response) => {
  const state = {
    shouldNext: false,
    nextReceivedError: null,
  };
  // create a promise to be resolved outside for next() trigger
  const nextPromise = new Promise((resolve) => {
    response._nextPromiseResolver = resolve;
  });

  response._nextPromise = nextPromise;

  const next = (err = undefined) => {
    response.resolveNext();
    // call to resolve promise
    Promise.resolve(nextPromise);
    if (err instanceof Error) {
      state.nextReceivedError = err;
      return;
    }
    state.shouldNext = true;
  };

  return {
    next,
    nextPromise,
    state,
  };
};

/**
 * @param {RouterInstance} currentRouter
 */
const collectMiddlewaresFromParentRouter = (
  currentRouter,
  middlewares = []
) => {
  const parent = currentRouter.routable[PARENT_ROUTER_KEY];

  if (parent) {
    middlewares.unshift(...parent._middlewareCollections);
    return collectMiddlewaresFromParentRouter(parent, middlewares);
  }

  return (
    middlewares
      // remove duplicated callback function before return
      .filter((item, index) => middlewares.indexOf(item) === index)
  );
};

const getParamsRegisterCode = (paramsLocation = [], urlPartsCount) => {
  return `x${paramsLocation.join(",")}y${urlPartsCount}`;
};

/**
 * This is to obtain a unique url params register
 * e.g. /path/:param1/to/:param2
 *      /path/:name1/to/:name2/somewhere
 * The way to tell the difference of that two paths will be the location of the ":"
 * in the parts of the url, and total counts of the urls parts. Eventually, we will
 * be able to get a coordinate-like key-value value to correctly map those values from
 * the incoming url.
 */
const getUniqueUrlParamsRegister = (urlParts = []) => {
  const urlPartsCount = urlParts.length;
  let paramsLocation = [];
  for (let i = 0; i < urlPartsCount; i++) {
    if (urlParts[i].startsWith(":")) {
      paramsLocation.push(i);
    }
  }
  return getParamsRegisterCode(paramsLocation, urlPartsCount);
};

/**
 * @param {string} value
 */
const parseParam = (value) => {
  if (typeof value === "string") {
    // handle num case
    const validNumberRegex = /^(\d+(\.\d*)?|\.\d+)$/;
    if (validNumberRegex.test(value)) {
      if (value > Number.MAX_SAFE_INTEGER) {
        return value;
      }
      return Number(value);
    }
    // handle boolean case
    const truthyStr = value.toLocaleLowerCase();
    if (["true", "false"].includes(truthyStr)) {
      return truthyStr === "true";
    }
    return decodeURIComponent(value);
  }
  // any other case
  return value;
};

/**
 * check if bodyParser should parse the data
 */
const shouldParse = ({ req, type }) => {
  if (
    req.method.toLocaleLowerCase() === "get" ||
    !typeis.is(
      // pass a pseudo request object. All it need is headers
      req.headers.get("content-type"),
      type
    )
  ) {
    return false;
  }
  return true;
};

/**
 * @param {string | RouterInstance} method
 * @param {string} route
 * @param {Array<()=>{}>)} callbacks
 */
function mapRouteToRoutable(method, route, callbacks) {
  const parts = route
    .split("/")
    .map((str) => str.replace(/ /g, ""))
    .filter((str) => str !== "");

  let node = this.routable;

  // get unique url params register
  const urlParamsRegister = getUniqueUrlParamsRegister(parts);

  // meaning this an empty route, then push a base route identifier
  if (parts.length == 0) {
    parts.push(BASE_ROUTE_KEY);
  }

  for (const part of parts) {
    // url param, case
    if (part.startsWith(":")) {
      if (!node[QUERY_PARAM_KEY])
        node[QUERY_PARAM_KEY] = {
          paramsKey: {
            [urlParamsRegister]: part.replace(":", ""),
          },
        };
      else
        node[QUERY_PARAM_KEY].paramsKey[urlParamsRegister] = part.replace(
          ":",
          ""
        );

      node = node[QUERY_PARAM_KEY];
      continue;
    }

    // wildcard case
    if (part.endsWith("*")) {
      const wildcard = part.replace(/\*/g, "") + WILDCARD_KEY;
      const wildcardParts = wildcard.split(PROTECT_PREFIX);

      if (wildcardParts.length > 1) {
        const wildcardPrefix = wildcardParts[0];
        if (!node[WILDCARD_PREFIX_KEY]) {
          node[WILDCARD_PREFIX_KEY] = [];
        }
        // if wildcardPrefix not included, add it to the list
        if (!node[WILDCARD_PREFIX_KEY].includes(wildcardPrefix)) {
          node[WILDCARD_PREFIX_KEY].push(wildcardPrefix);
        }

        // sort from longest to shortest
        node[WILDCARD_PREFIX_KEY].sort((a, b) => b.length - a.length);
      }

      if (!node[wildcard]) {
        node[wildcard] = {};
      }
      node = node[wildcard];
      continue;
    }

    if (!node[part]) {
      node[part] = {};
    }

    node = node[part];
  }

  if (!node[METHODS_KEY]) {
    node[METHODS_KEY] = {};
  }

  // if method is router instance, map subrouter
  if (typeof method === "object" && method.routable) {
    return node;
  }

  // map method
  node[METHODS_KEY][method] = {
    callbacks,
    preMiddlewares: [...this._middlewareCollections],
    postMiddlewares: [],
  };

  return node[METHODS_KEY][method];
}

const generateRouteMethod = (methods = []) => {
  /**
   * @param {string} route
   * @param {...NextApiProcessCallback[]} callbacks
   */
  return function (route, ...callbacks) {
    for (const method of methods) {
      this.routes.push(route);
      // map route and callback
      const node = mapRouteToRoutable.call(this, method, route, callbacks);
      this._nodeCollections.push(node);
    }
    return this;
  };
};

/**
 * @param {{[x:string]:any}} routable
 * @param {string} method HTTP method
 * @param {string} pathname url pathname from new URL()
 * @param {string} apiFolderPath the path of api folder
 * @returns {{
 *  params?:{
 *     [key:string]:string
 *  };
 *  callbacks:Array<Promise<()=>{}>>;
 *  preMiddlewares:Array<Promise<()=>{}>>;
 *  postMiddlewares:Array<Promise<()=>{}>>;
 *  router: RouterInstance
 * } | undefined}
 */
const getRoutableNodeFromPathname = (
  routable,
  method,
  pathname,
  apiFolderPath
) => {
  // helper function for processing the url params properly
  const params = {};
  let paramsLocation = [];
  let paramsCollection = [];
  let paramLocationCounter = 0;
  let offsetX = 0;
  const processUrlParams = ({ isWildcard = false } = {}) => {
    if (paramsCollection.length > 0) {
      const yValue = isWildcard
        ? paramLocationCounter + 1 // offsetY +1 if is processUrlParams is due to encounter of a wildcard.
        : paramLocationCounter;
      const urlParamsRegister = getParamsRegisterCode(
        paramsLocation.map((num) => num - offsetX),
        yValue
      );

      paramsCollection.forEach((item) => {
        const [paramsKeyObj, value] = item;
        params[paramsKeyObj[urlParamsRegister]] = value;
      });
      offsetX += paramLocationCounter;
      paramsCollection = [];
      paramsLocation = [];
      paramLocationCounter = 0;
    }
  };

  // remove api folder path
  pathname = pathname.replace(apiFolderPath, "");

  let currentNode = routable;

  let router = {
    current: currentNode[CURRENT_ROUTER_KEY],
  };

  const urlParts = pathname
    // remove api folder path
    .replace(apiFolderPath, "")
    // get url parts
    .split("/")
    // remove empty
    .filter((str) => str !== "");

  // meaning targt the base route
  if (urlParts.length == 0) {
    urlParts.push(BASE_ROUTE_KEY);
  }

  let wildcardNode = null;

  for (let i = 0; i < urlParts.length; i++) {
    const urlPart = urlParts[i];
    // currentNode.routable does exist, meaning it is a sub-router instead of the node a router
    if (currentNode.routable) {
      router = {
        current: currentNode,
      };
      currentNode = currentNode.routable;
      // if ever encounter a router, then url params must be addressed first
      processUrlParams();
    }

    // check if there is wild in current node, if yes, record the first occurance
    const prefixedWildcard =
      getWildcardPrefix(currentNode[WILDCARD_PREFIX_KEY], urlPart) +
      WILDCARD_KEY;
    // get prefix
    if (
      (currentNode[WILDCARD_KEY] || currentNode[prefixedWildcard]) &&
      !wildcardNode
    ) {
      wildcardNode = currentNode[prefixedWildcard] ?? currentNode[WILDCARD_KEY];
      processUrlParams({ isWildcard: true });
    }

    const next = currentNode[urlPart] ?? currentNode[QUERY_PARAM_KEY];

    if (next) {
      // map url part to params if the node is a url param
      if (typeof next.paramsKey !== "undefined") {
        paramsCollection.push([next.paramsKey, parseParam(urlPart)]);
        paramsLocation.push(i);
      }
      currentNode = next;
      paramLocationCounter++;
      continue;
    }

    currentNode = next;
    break;
  }

  // no route found case
  if (
    typeof currentNode === "undefined" ||
    typeof currentNode[METHODS_KEY] === "undefined"
  ) {
    // if there is no route found but there is wildcard occurance, set currentNode to the wildcard node
    if (wildcardNode) {
      currentNode = wildcardNode;
    } else {
      return { err: new NotFoundError(), router: router.current };
    }
  }

  // has route mapping but not the requested method

  if (typeof currentNode[METHODS_KEY][method] === "undefined") {
    return { err: new MethodNotAllowedError(), router: router.current };
  }

  currentNode = currentNode[METHODS_KEY][method];

  // mapping params
  processUrlParams();
  return { ...currentNode, params, router: router.current };
};

/**
 * @param {Error} err
 * @param {RouterInstance} router
 * @param {import('.').NextApiRouterRequest} req
 * @param {NextApiRouterResponse} res
 */
const processRouterError = async (err, router, req, res) => {
  // first collect all the "set" error handler from current to the outter most parent

  /**
   * @param {RouterInstance} currentNode
   * @param {Array<Promise<()=>{}>>} errorHandlers
   * @returns {Array<Promise<()=>{}>>}
   */
  const collectErrorHandler = (currentNode, errorHandlers = []) => {
    if (!currentNode) {
      return errorHandlers;
    }

    if (
      currentNode._errorHandlerIsSet ||
      // if PARENT_ROUTER_KEY not exist in routable, meaning it is outter most parent router and it's errorhandler is enforced
      !currentNode.routable[PARENT_ROUTER_KEY]
    ) {
      errorHandlers.push(currentNode._errorCallback);
    }

    return collectErrorHandler(
      currentNode.routable[PARENT_ROUTER_KEY],
      errorHandlers
    );
  };

  const errorHandlers = collectErrorHandler(router);

  for (let handler of errorHandlers) {
    const { state, next, nextPromise } = makeNext(res);

    await Promise.all([handler(err, req, res, next), nextPromise]);

    // override error if error is passed to next()
    if (state.nextReceivedError instanceof Error) {
      err = state.nextReceivedError;
    }
    // if received resposne in any of the errorhandler, then just return
    if (res._response) {
      return res._response;
    }
  }
};

/**
 *
 * @param {Promise<()=>void>} cb
 * @param {import(".").NextApiRouterRequest} request
 * @param {import(".").NextApiRouterResponse} response
 * @param {URL} url
 * @returns
 */
const handleCb = async (
  cb,
  request,
  response,
  url,
  treatReturnAsResponse = false
) => {
  if (typeof cb !== "function") {
    return new Error(
      `a callback to route ${url.pathname} is not a function, received: ` + cb
    );
  }

  const { state, next, nextPromise } = makeNext(response);

  const returnedData = await cb(request, response, next);

  // handle treating returned data as response and just call send() on behave of user.
  if (treatReturnAsResponse && !response._sent) {
    if (returnedData instanceof Error) {
      next(returnedData);
    } else if (
      returnedData instanceof Buffer ||
      returnedData instanceof ReadableStream
    ) {
      response.send(returnedData);
    } else if (returnedData instanceof fs.ReadStream) {
      response.pipe(returnedData);
    } else if (returnedData != this && !response._sent) {
      switch (typeof returnedData) {
        case "undefined":
          break;
        case "number":
        case "string":
          response.send(returnedData);
          break;
        case "object":
          response.json(returnedData);
        default:
          next(
            new InvalidReturnDataTypeError(
              "returned data type not supported, please ensured " +
                "your returned data type is either a number, string or object."
            )
          );
      }
    }
  }

  await nextPromise;

  return [state.shouldNext, state.nextReceivedError, returnedData];
};

const NextApiRouter = (
  // configure default options here directly
  {
    timeout = 20 * 1000, // 20s
    apiFolderPath = "/api",
    ejsFolderPath = "",
    treatReturnAsResponse = false,
  } = {}
) => {
  const routable = {
    [ROUTER_ID_KEY]: randomId(),
    [CURRENT_ROUTER_KEY]: null,
    [PARENT_ROUTER_KEY]: null,
    [CHILD_ROUTERS_KEY]: [],
  };

  const currentRouter = {
    get routable() {
      return routable;
    },
    _timeout: timeout,
    _nodeCollections: [],
    _middlewareCollections: [],
    _errorCallback: async (err, req, res) => {
      if (err instanceof NotFoundError) {
        return res.status(404).send("Not found");
      }
      if (err instanceof MalformedJsonError) {
        return res.status(400).send("Malformed json in body's payload");
      }
      if (err instanceof TimeoutError) {
        return res.status(408).send("Request timeout");
      }
      if (err instanceof MethodNotAllowedError) {
        return res.status(405).send("Method not allowed");
      }

      console.log(err);

      res
        .status(500)
        .send(
          process.env.NODE_ENV === "development" ? err.stack : "Server Error"
        );
    },
    _errorHandlerIsSet: false,
    routes: [],
    all: generateRouteMethod(SUPPORTED_HTTP_METHODS),
    get: generateRouteMethod(["GET"]),
    post: generateRouteMethod(["POST"]),
    put: generateRouteMethod(["PUT"]),
    delete: generateRouteMethod(["DELETE"]),
    patch: generateRouteMethod(["PATCH"]),
    options: generateRouteMethod(["OPTIONS"]),
    head: generateRouteMethod(["HEAD"]),
    /**
     * @param {NextApiErrorHandlerCallback} cb
     */
    errorHandler(cb) {
      this._errorCallback = cb;
      this._errorHandlerIsSet = true;
      return this;
    },
    apiFolderPath,
    ejsFolderPath,
    treatReturnAsResponse,
    setApiFolderPath(value) {
      this.apiFolderPath = value;
      return this;
    },
    setEjsFolderPath(value) {
      this.ejsFolderPath = value;
      return this;
    },
    setTreatReturnAsResponse(value) {
      this.treatReturnAsResponse = value;
      return this;
    },
    bodyParser: {
      text({ type = ["text"] } = {}) {
        /**
         * @param {Request} req
         * @param {(err)=>{}} next
         */
        return async (req, res, next) => {
          if (!shouldParse({ req, type })) {
            return next();
          }
          try {
            req.data = await req.text();
            next();
          } catch (err) {
            next(err);
          }
        };
      },
      json({ type = ["json"] } = {}) {
        /**
         * @param {Request} req
         * @param {(err)=>{}} next
         */
        return async (req, res, next) => {
          if (!shouldParse({ req, type })) {
            return next();
          }
          try {
            const text = await req.text();
            if (text) {
              req.data = JSON.parse(text);
            } else {
              req.data = {};
            }
            next();
          } catch (err) {
            next(new MalformedJsonError("Malformed Json"));
          }
        };
      },
      form({ type = ["urlencoded", "multipart/form-data"] } = {}) {
        /**
         * @param {Request} req
         * @param {(err)=>{}} next
         */
        return async (req, res, next) => {
          if (!shouldParse({ req, type })) {
            return next();
          }
          try {
            const formData = await req.formData();

            const map = {};
            for (const [key, value] of formData.entries()) {
              map[key] = parseParam(value);
            }
            req.data = map;
            next();
          } catch (err) {
            /**
             * To handle "Could not parse content as FormData" error, just set data to empty object.
             * No need to forward to error handler because form-data is pretty much primitive behavior
             * of html and having malformed form-data in the body is extremely low.
             */
            req.data = {};
            next();
          }
        };
      },
    },
    /**
     * @param {...NextApiProcessCallback} cbs
     */
    use(...cbs) {
      // case for mapping sub route
      if (typeof cbs[0] === "string") {
        if (!cbs[0].startsWith("/")) {
          cbs[0] = "/" + route;
        }
        /**@type {ReturnType<typeof NextApiRouter>} */
        const subRouter = cbs[cbs.length - 1];
        const middlewares = cbs.slice(1, cbs.length - 1);

        if (subRouter instanceof Static) {
          return this._mapStatic(cbs[0], subRouter, middlewares);
        }

        // throw error if pass in the wrong arguement
        if (typeof subRouter !== "object" && !subRouter.routable) {
          const err = new Error(
            "In 'use()', if first arg is a route string, then the last arg must either be a router from 'NextApiRouter()' or static from 'app.static()'"
          );
          err.name = "InvalidArgument";
          throw err;
        }

        const node = mapRouteToRoutable.call(this, subRouter, cbs[0]);

        // add current router object into PARENT_ROUTER_KEY collection if not exist
        if (!subRouter.routable[PARENT_ROUTER_KEY]) {
          subRouter.routable[PARENT_ROUTER_KEY] = this;
        }

        // and add current router as it's child if not exist
        if (!this.routable[CHILD_ROUTERS_KEY].includes(subRouter)) {
          this.routable[CHILD_ROUTERS_KEY].push(subRouter);
        }

        // traverse to all the parent router and add all its collected middlewares as pre-middlewares
        const preMiddlewares = collectMiddlewaresFromParentRouter(subRouter);

        subRouter._middlewareCollections.unshift(
          ...preMiddlewares,
          ...middlewares
        );

        subRouter._nodeCollections.forEach((node) => {
          subRouter;
          node.preMiddlewares.unshift(
            // pass middleware already be collected in parent router
            ...[
              ...preMiddlewares,
              // then add the child router middlewares
              ...middlewares,
            ]
          );
        });
        // this node should also have access to the sub router node
        this._nodeCollections.push(...subRouter._nodeCollections);

        Object.assign(node, subRouter);
      }
      // case for adding middleware to current router
      else {
        // get collection of current router + all its child routers
        const routers = [this, ...collectAllChildRouters(this)];
        cbs.forEach((cb) => {
          routers.forEach((router) => {
            router._nodeCollections.forEach((node) => {
              node.postMiddlewares.push(cb);
            });
            router._middlewareCollections.push(cb);
          });
        });
      }
      return this;
    },
    /**
     *
     * @param {string} route relative route path
     * @param {string} folderPath absolute path to the folder
     * @param {import('.').HttpHeadersObject} headers
     * @returns
     */
    static(folderPath = "", headers = {}) {
      return new Static({ folderPath, headers });
    },
    /**
     *
     * @param {string} route relative route path
     * @param {Static} staticIntance absolute path to the folder
     * @param {import('.').HttpHeadersObject} headers
     * @returns
     */
    _mapStatic(route = "", staticIntance, middlewares = []) {
      const { folderPath, headers } = staticIntance;

      if (!route.startsWith("/")) {
        route = "/" + route;
      }

      const filesDirs = getAllFilesInDirectory(folderPath);
      for (let fileDir of filesDirs) {
        this.get(
          route + "/" + fileDir,
          ...[
            ...middlewares,
            async (req, res, next) => {
              res.sendFile(folderPath + "/" + fileDir, headers);
            },
          ]
        );
      }
    },
    handler() {
      /**
       * @param {Request} request
       */
      return async (request) => {
        // bind internal use state
        request._startAt = process.hrtime();

        // custom getter
        Object.defineProperty(request, "ip", {
          get: function () {
            return this.headers.get("x-forwarded-for") || undefined;
          },
        });

        // bind custom methods
        request.getHeader = getHeader.bind(request);
        request.getHeaders = getHeaders.bind(request);

        const { url, method } = request;
        const reqUrlObj = new URL(url);
        const response = new NextApiRouterResponse({
          reqOrigin: reqUrlObj.origin,
          ejsFolderPath: this.ejsFolderPath,
          req: request,
        });

        response._requestUrlObject = reqUrlObj;

        // match url parts to the routable and call middleware and route cb in sequences
        const {
          err = null,
          callbacks = [],
          postMiddlewares = [],
          preMiddlewares = [],
          params = {},
          router,
        } = getRoutableNodeFromPathname(
          this.routable,
          method,
          reqUrlObj.pathname,
          this.apiFolderPath
        );

        if (err instanceof Error) {
          await processRouterError(err, router, request, response);
          return response._response;
        }

        // map params , query and cookies to request object
        request.params = params;

        // handle search param
        request.query = {};
        for (const [key, value] of request.nextUrl.searchParams) {
          request.query[key] = parseParam(value);
        }

        // if route does not match, then just run through all middlewares
        /**@type {Array<()=>any>} */
        const allCallbacks =
          callbacks.length > 0
            ? [...preMiddlewares, ...callbacks, ...postMiddlewares]
            : [...router._middlewareCollections];

        const { timeoutPromise, timeoutInstance } = makeTimeoutInstance(
          router.routable[CURRENT_ROUTER_KEY]._timeout,
          request
        );

        const cleanUp = () => {
          clearTimeout(timeoutInstance);
        };
        /** ************************************ */

        const exec = () => {
          return new Promise(async (resolve, reject) => {
            let isResolved = false;
            while (allCallbacks.length) {
              const cb = allCallbacks.shift();
              const result =
                // if timeoutPromise=undefined, meaning user set timeout=false
                typeof timeoutPromise === "undefined"
                  ? await handleCb(
                      cb,
                      request,
                      response,
                      reqUrlObj,
                      this.treatReturnAsResponse
                    ).catch((err) => err)
                  : await Promise.race([
                      handleCb(
                        cb,
                        request,
                        response,
                        reqUrlObj,
                        this.treatReturnAsResponse
                      ),
                      timeoutPromise,
                    ])
                      // enure error is catch in each callback so that user does have
                      // to implement something like catchAsync like we have to do
                      // in express.js
                      .catch((err) => err);

              if (result instanceof Error) {
                // pass the error back and let error handled after it's resolved
                return resolve(result);
              }

              const [shouldNext, nextReceivedError, returnedData] = result;

              if (nextReceivedError) {
                cleanUp();
                await processRouterError(
                  nextReceivedError,
                  router,
                  request,
                  response
                );
                return resolve(response._response);
              }

              if (response._sent) {
                cleanUp();
                // do not return, user might still call() next after response sent
                resolve(response._response);
                isResolved = true;
              }

              if (!shouldNext) {
                break;
              }
            }

            if (!isResolved) {
              resolve(null);
            }
          });
        };

        const result = await exec().catch((err) => err);
        /** ************************* */

        cleanUp();

        if (result instanceof Error) {
          await processRouterError(result, router, request, response);
          return response._response;
        }

        if (result instanceof Response) {
          return result;
        }

        // no match route
        if (callbacks.length == 0) {
          await processRouterError(
            new NotFoundError("Not Found"),
            router,
            request,
            response
          );

          return response._response;
        }

        await processRouterError(
          new NoResponseFromHandlerError(
            `route '${reqUrlObj.pathname}' does not return any response.`
          ),
          request,
          response
        );
        // no response

        return response._response;
      };
    },
  };

  routable[CURRENT_ROUTER_KEY] = currentRouter;
  return currentRouter;
};

export default NextApiRouter;
export {
  NextApiRouterResponse,
  NotFoundError,
  MalformedJsonError,
  NextApiRouteError,
  NoResponseFromHandlerError,
  TimeoutError,
  MethodNotAllowedError,
  InvalidReturnDataTypeError,
};
