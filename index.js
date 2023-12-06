import {
  NotFoundError,
  MalformedJsonError,
  NextApiRouteError,
  NoResponseFromHandlerError,
  TimeoutError,
  MethodNotAllowedError,
} from "./src/errors";
import { NextApiRouterResponse, getHeader, getHeaders } from "./src/response";
import { randomId } from "./src/util/randomId";
import typeis from "type-is";
import fs from "fs";
import path from "path";
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

const INSTANCE_ID = randomId();
const QUERY_PARAM_KEY = `qp_${INSTANCE_ID}`;
const BASE_ROUTE_KEY = `base_${INSTANCE_ID}`;
const PARENT_ROUTER = `parent_router_${INSTANCE_ID}`;
const CURRENT_ROUTER = `current_router_${INSTANCE_ID}`;
const CHILD_ROUTERS = `child_routers_${INSTANCE_ID}`;
const SUB_ROUTES_KEY_PREFIX = `sub_${INSTANCE_ID}`;
const METHODS_KEY = `methods_${INSTANCE_ID}`;
const ROUTER_ID_KEY = `router_id_${INSTANCE_ID}`;
const TIMEOUT_VALUE_KEY = `timeout_${INSTANCE_ID}`;
// only the common MIME TYPE
const FILE_ENDING_TO_MIME_TYPE = {
  aac: "audio/aac",
  avi: "video/x-msvideo",
  bmp: "image/bmp",
  css: "text/css",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "application/javascript",
  json: "application/json",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  xml: "application/xml",
  zip: "application/zip",
};
const SUPPORTED_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
];

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
 * @param {RouterInstance} currentRouter
 */
const collectMiddlewaresFromParentRouter = (
  currentRouter,
  middlewares = []
) => {
  const parent = currentRouter.routable[PARENT_ROUTER];

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

/**
 * bfs to traverse through all childs routers
 * @param {RouterInstance} currentRouter
 * @returns
 */
export const collectAllChildRouters = (currentRouter) => {
  const queue = [...currentRouter.routable[CHILD_ROUTERS]];

  const collection = [];
  while (queue.length > 0) {
    const childRouter = queue.pop();
    collection.push(childRouter);
    queue.push(...childRouter.routable[CHILD_ROUTERS]);
  }

  return collection;
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

const NextApiRouter = (
  // configure default options here directly
  {
    timeout, // 20s
    apiFolderPath = "/api",
    ejsFolderPath = "",
  } = {}
) => {
  const routable = {
    [ROUTER_ID_KEY]: randomId(),
    [CURRENT_ROUTER]: null,
    [PARENT_ROUTER]: null,
    [CHILD_ROUTERS]: [],
    [TIMEOUT_VALUE_KEY]: timeout || 20 * 1000,
  };

  /**
   * @param {string} method
   * @param {string} route
   */
  function mapRouteToRoutable(method, route, callbacks) {
    const parts = route
      .split("/")
      .map((str) => str.replace(/ /g, ""))
      .filter((str) => str !== "");

    let node = routable;

    // get unique url params register
    const urlParamsRegister = getUniqueUrlParamsRegister(parts);

    // meaning this an empty route, then push a base route identifier
    if (parts.length == 0) {
      parts.push(BASE_ROUTE_KEY);
    }

    for (const part of parts) {
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

      if (!node[part]) {
        node[part] = {};
      }

      node = node[part];
    }

    if (!node[METHODS_KEY]) {
      node[METHODS_KEY] = {};
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
    method,
    pathname,
    apiFolderPath,
    subRoutes = []
  ) => {
    // remove api folder path
    pathname = pathname.replace(apiFolderPath, "");
    const subRoute = subRoutes.find((item) => pathname.startsWith(item));
    if (subRoute) {
      pathname = pathname.replace(subRoute, "");
    }

    let currentNode = subRoute
      ? routable[SUB_ROUTES_KEY_PREFIX + subRoute]
      : routable;

    let router = {
      current: currentNode[CURRENT_ROUTER],
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

    // we don't the paramsLocation yet, so it has to be collected here again
    const paramsLocation = [];
    // collect all params and it value in an array
    const paramsCollection = [];
    const urlPartsCount = urlParts.length;

    let i = -1;
    for (let urlPart of urlParts) {
      i += 1;
      // currentNode.routable does exist, meaning it is a sub-router instead of the node a router

      const next =
        // sub route has higher priority
        currentNode[SUB_ROUTES_KEY_PREFIX + "/" + urlPart] ??
        currentNode[urlPart] ??
        currentNode[QUERY_PARAM_KEY];

      if (typeof next !== "undefined" && next[CURRENT_ROUTER]) {
        router = {
          current: next[CURRENT_ROUTER],
        };
      }

      if (next) {
        // map url part to params if the node is a url param
        if (typeof next.paramsKey !== "undefined") {
          paramsCollection.push([next.paramsKey, parseParam(urlPart)]);
          paramsLocation.push(i);
        }
        currentNode = next;
      } else {
        // no match, return subRouter
        return { router: router.current };
      }
    }

    // if METHODS_KEY does not exist, meaning there is no method map to that route
    if (typeof currentNode[METHODS_KEY] === "undefined") {
      return { err: new NotFoundError(), router: router.current };
    }

    if (typeof currentNode[METHODS_KEY][method] === "undefined") {
      return { err: new MethodNotAllowedError(), router: router.current };
    }

    currentNode = currentNode[METHODS_KEY][method];

    const params = {};
    // mapping params
    if (paramsCollection.length > 0) {
      const urlParamsRegister = getParamsRegisterCode(
        paramsLocation,
        urlPartsCount
      );
      paramsCollection.forEach((item) => {
        const [paramsKeyObj, value] = item;
        params[paramsKeyObj[urlParamsRegister]] = value;
      });
    }
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
        // if PARENT_ROUTER not exist in routable, meaning it is outter most parent router and it's errorhandler is enforced
        !currentNode.routable[PARENT_ROUTER]
      ) {
        errorHandlers.push(currentNode._errorCallback);
      }

      return collectErrorHandler(
        currentNode.routable[PARENT_ROUTER],
        errorHandlers
      );
    };

    const errorHandlers = collectErrorHandler(router);

    for (let handler of errorHandlers) {
      await handler(err, req, res);
      // if received resposne in any of the errorhandler, then just return
      if (res._response) {
        return res._response;
      }
    }
  };

  const currentRouter = {
    get routable() {
      return routable;
    },
    _subRoutes: [],
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
    setApiFolderPath(value) {
      this.apiFolderPath = value;
      return this;
    },
    setEjsFolderPath(value) {
      this.ejsFolderPath = value;
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
        /**@type {ReturnType<typeof NextApiRouter>} */
        const subRouter = cbs[cbs.length - 1];
        routable[SUB_ROUTES_KEY_PREFIX + cbs[0]] = subRouter.routable;
        this._subRoutes.push(cbs[0]);
        // push all middleware to subrouter's middleware collection and each node's premiddlewares
        const middlewares = cbs.slice(1, cbs.length - 1);

        // add current router object into PARENT_ROUTER collection if not exist
        if (!subRouter.routable[PARENT_ROUTER]) {
          subRouter.routable[PARENT_ROUTER] = this;
        }

        // and add current router as it's child if not exist
        if (!this.routable[CHILD_ROUTERS].includes(subRouter)) {
          this.routable[CHILD_ROUTERS].push(subRouter);
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
     * @param {object} headers
     * @returns
     */
    static(route = "", folderPath = "", headers = {}) {
      if (!route.startsWith("/")) {
        route = "/" + route;
      }

      const filesDirs = getAllFilesInDirectory(folderPath);
      for (let fileDir of filesDirs) {
        this.get(route + "/" + fileDir, async (req, res, next) => {
          // make the best guess to the header content-type based on file-ending.
          const parts = fileDir.split(".");
          const fileEnding = parts[parts.length - 1];
          res.setHeader(
            "content-type",
            FILE_ENDING_TO_MIME_TYPE[fileEnding] ?? ""
          );
          // user override
          res.setHeaders(headers);
          // stream file to the client
          const stream = fs.createReadStream(folderPath + "/" + fileDir);
          await res.pipe(stream);
        });
      }
      return this;
    },
    handler() {
      /**
       * @param {Request} request
       */
      return async (request) => {
        // bind internal use state
        request._startAt = process.hrtime();
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
        });

        response._requestNextUrl = request.nextUrl;

        // match url parts to the routable and call middleware and route cb in sequences
        const {
          err = null,
          callbacks = [],
          postMiddlewares = [],
          preMiddlewares = [],
          params = {},
          router,
        } = getRoutableNodeFromPathname(
          method,
          reqUrlObj.pathname,
          this.apiFolderPath,
          this._subRoutes
        ) ?? {};

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
        const allCallbacks =
          callbacks.length > 0
            ? [...preMiddlewares, ...callbacks, ...postMiddlewares]
            : [...router._middlewareCollections];

        let timeoutResolve = null;
        const timeoutPromise = new Promise((resolve) => {
          timeoutResolve = resolve;
        }).then(() => new TimeoutError("request timeout"));
        /** handle time out  */
        const handleTimeout = async () => {
          timeoutResolve();
        };

        const routerTimeoutValue = router.routable[TIMEOUT_VALUE_KEY];

        const instanceTimeout =
          typeof routerTimeoutValue === "number"
            ? setTimeout(handleTimeout, routerTimeoutValue)
            : typeof routerTimeoutValue === "function"
            ? setTimeout(handleTimeout, routerTimeoutValue(request))
            : undefined;

        const cleanUp = () => {
          clearTimeout(instanceTimeout);
        };
        /** ************************************ */

        /** middleware and route call back exec */
        const handleCb = async () => {
          const cb = allCallbacks.shift();

          if (typeof cb !== "function") {
            return new Error(
              `a callback to route ${reqUrlObj.pathname} is not a function, received: ` +
                cb
            );
          }

          let shouldNext = false;
          let nextReceivedError = null;
          // create a promise to be resolved outside for next() trigger
          const nextPromise = new Promise((resolve) => {
            response._nextPromiseResolver = resolve;
          });
          const next = (err) => {
            response.resolveNext();
            // call to resolve promise
            Promise.resolve(nextPromise);
            if (err instanceof Error) {
              nextReceivedError = err;
              return;
            }
            shouldNext = true;
          };

          //bind nextPromise to  response object
          response._nextPromise = nextPromise;

          await Promise.all([cb(request, response, next), nextPromise]);

          return [shouldNext, nextReceivedError];
        };

        const exec = () => {
          return new Promise(async (resolve, reject) => {
            let isResolved = false;
            while (allCallbacks.length) {
              const result = await Promise.race([handleCb(), timeoutPromise])
                // enure error is catch in each callback so that user does have
                // to implement something like catchAsync like we have to do
                // in express.js
                .catch((err) => err);

              if (result instanceof Error) {
                // pass the error back and let error handled after it's resolved
                return resolve(result);
              }

              const [shouldNext, nextReceivedError] = result;

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

  routable[CURRENT_ROUTER] = currentRouter;
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
};
