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
const CHILD_ROUTERS = `child_routers_${INSTANCE_ID}`;
const SUB_ROUTES_KEY_PREFIX = `sub_${INSTANCE_ID}`;
const METHODS_KEY = `methods_${INSTANCE_ID}`;
const SUPPORTED_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
];

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
    timeout = 20 * 1000, // 20s
    apiFolderPath = "/api",
    ejsFolderPath = "",
  } = {}
) => {
  const routable = {
    [PARENT_ROUTER]: null,
    [CHILD_ROUTERS]: [],
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
      const next =
        // sub route has higher priority
        currentNode[SUB_ROUTES_KEY_PREFIX + "/" + urlPart] ??
        currentNode[urlPart] ??
        currentNode[QUERY_PARAM_KEY];
      if (next) {
        // map url part to params if the node is a url param
        if (typeof next.paramsKey !== "undefined") {
          paramsCollection.push([next.paramsKey, parseParam(urlPart)]);
          paramsLocation.push(i);
        }
        currentNode = next;
      } else {
        // no match, return undefined
        return undefined;
      }
    }

    // move forward to method
    currentNode = currentNode[METHODS_KEY][method];

    // if there is callbacks in currentNode, meaning there is route match
    if (currentNode) {
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
      return { ...currentNode, params };
    }
    // nothing matched, return undefined
    return { err: new MethodNotAllowedError() };
  };

  return {
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
        } = getRoutableNodeFromPathname(
          method,
          reqUrlObj.pathname,
          this.apiFolderPath,
          this._subRoutes
        ) ?? {};

        if (err instanceof Error) {
          await this._errorCallback(err, request, response);
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
            : this._middlewareCollections;

        let timeoutResolve = null;
        const timeoutPromise = new Promise((resolve) => {
          timeoutResolve = resolve;
        }).then(() => new TimeoutError("request timeout"));
        /** handle time out  */
        const handleTimeout = async () => {
          timeoutResolve();
        };

        const instanceTimeout =
          typeof timeout === "number"
            ? setTimeout(handleTimeout, timeout)
            : undefined;

        const cleanUp = () => {
          if (typeof timeout !== "undefined") {
            clearTimeout(instanceTimeout);
          }
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
                await this._errorCallback(nextReceivedError, request, response);
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

        if (result instanceof Error) {
          cleanUp();
          await this._errorCallback(result, request, response);
          return response._response;
        }

        if (result instanceof Response) {
          return result;
        }

        cleanUp();
        // no match route
        if (callbacks.length == 0) {
          await this._errorCallback(
            new NotFoundError("Not Found"),
            request,
            response
          );
          return response._response;
        }

        // no response
        await this._errorCallback(
          new NoResponseFromHandlerError(
            `route '${reqUrlObj.pathname}' does not return any response.`
          ),
          request,
          response
        );

        return response._response;
      };
    },
  };
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
