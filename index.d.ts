import { type Data as EjsData, type Options as EjsOptions } from "ejs";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Readable } from "stream";
type HttpHeaders = [
  "accept",
  "accept-charset",
  "accept-datetime",
  "accept-encoding",
  "accept-language",
  "accept-patch",
  "accept-ranges",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "access-control-max-age",
  "access-control-request-headers",
  "access-control-request-method",
  "age",
  "allow",
  "alt-svc",
  "authorization",
  "cache-control",
  "connection",
  "content-disposition",
  "content-encoding",
  "content-language",
  "content-length",
  "content-location",
  "content-range",
  "content-type",
  "cookie",
  "date",
  "delta-base",
  "dnt",
  "etag",
  "expect",
  "expires",
  "forwarded",
  "from",
  "front-end-https",
  "host",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "im",
  "last-modified",
  "link",
  "location",
  "max-forwards",
  "origin",
  "p3p",
  "pragma",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "public-key-pins",
  "range",
  "referer",
  "refresh",
  "retry-after",
  "server",
  "set-cookie",
  "strict-transport-security",
  "te",
  "tk",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "user-agent",
  "vary",
  "via",
  "warning",
  "www-authenticate",
  "x-att-deviceid",
  "x-clacks-overhead",
  "x-content-type-options",
  "x-csrf-token",
  "x-do-not-track",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-frame-options",
  "x-http-method-override",
  "x-permitted-cross-domain-policies",
  "x-pingback",
  "x-powered-by",
  "x-request-id",
  "x-requested-with",
  "x-ua-compatible",
  "x-uidh",
  "x-wap-profile",
  "x-webkit-csp",
  "x-xss-protection"
];

export type HttpHeadersObject = {
  accept?: string;
  "accept-charset"?: string;
  "accept-datetime"?: string;
  "accept-encoding"?: string;
  "accept-language"?: string;
  "accept-patch"?: string;
  "accept-ranges"?: string;
  "access-control-allow-credentials"?: string;
  "access-control-allow-headers"?: string;
  "access-control-allow-methods"?: string;
  "access-control-allow-origin"?: string;
  "access-control-expose-headers"?: string;
  "access-control-max-age"?: string;
  "access-control-request-headers"?: string;
  "access-control-request-method"?: string;
  age?: string;
  allow?: string;
  "alt-svc"?: string;
  authorization?: string;
  "cache-control"?: string;
  connection?: string;
  "content-disposition"?: string;
  "content-encoding"?: string;
  "content-language"?: string;
  "content-length"?: string;
  "content-location"?: string;
  "content-range"?: string;
  "content-type"?: string;
  cookie?: string;
  date?: string;
  "delta-base"?: string;
  dnt?: string;
  etag?: string;
  expect?: string;
  expires?: string;
  forwarded?: string;
  from?: string;
  "front-end-https"?: string;
  host?: string;
  "if-match"?: string;
  "if-modified-since"?: string;
  "if-none-match"?: string;
  "if-range"?: string;
  "if-unmodified-since"?: string;
  im?: string;
  "last-modified"?: string;
  link?: string;
  location?: string;
  "max-forwards"?: string;
  origin?: string;
  p3p?: string;
  pragma?: string;
  "proxy-authenticate"?: string;
  "proxy-authorization"?: string;
  "proxy-connection"?: string;
  "public-key-pins"?: string;
  range?: string;
  referer?: string;
  refresh?: string;
  "retry-after"?: string;
  server?: string;
  "set-cookie"?: string;
  "strict-transport-security"?: string;
  te?: string;
  tk?: string;
  trailer?: string;
  "transfer-encoding"?: string;
  upgrade?: string;
  "user-agent"?: string;
  vary?: string;
  via?: string;
  warning?: string;
  "www-authenticate"?: string;
  "x-att-deviceid"?: string;
  "x-clacks-overhead"?: string;
  "x-content-type-options"?: string;
  "x-csrf-token"?: string;
  "x-do-not-track"?: string;
  "x-forwarded-for"?: string;
  "x-forwarded-host"?: string;
  "x-forwarded-proto"?: string;
  "x-frame-options"?: string;
  "x-http-method-override"?: string;
  "x-permitted-cross-domain-policies"?: string;
  "x-pingback"?: string;
  "x-powered-by"?: string;
  "x-request-id"?: string;
  "x-requested-with"?: string;
  "x-ua-compatible"?: string;
  "x-uidh"?: string;
  "x-wap-profile"?: string;
  "x-webkit-csp"?: string;
  "x-xss-protection"?: string;
};

export declare class NextApiRouterResponse {
  headers: Headers;
  cookies: ReadonlyRequestCookies;
  _startAt: [number, number];
  setHeader(name: HttpHeaders[number], value: string): this;
  setHeaders(headers: HttpHeadersObject): this;
  status(code: number): this;
  json(data: object): this;
  redirect(url: string): void;
  pipe(stream: Readable | ReadableStream): Promise<void>;
  send(message?: any): void;
  render(
    path: string,
    data?: EjsData,
    options?: EjsOptions & { async?: boolean }
  ): Promise<void>;
  writeHead(statusCode: number, headers?: HttpHeadersObject): this;
  writeLine(message?: number | string | Uint8Array): this;
  end(message?: number | string | Uint8Array): void;
  getHeader(name: HttpHeaders[number]): string;
  getHeaders: typeof GetHeaders;
  removeHeader(name: string): this;
}
export declare class NextApiRouteError extends Error {
  constructor(message: string);
  setMessage(value: string): this;
  setName(value: string): this;
}
export declare class NotFoundError extends NextApiRouteError {}
export declare class MalformedJsonError extends NextApiRouteError {}
export declare class NoResponseFromHandlerError extends NextApiRouteError {}
export declare class TimeoutError extends NextApiRouteError {}
export declare class MethodNotAllowedError extends NextApiRouteError {}
export interface NextCallback {
  (error?: Error): void;
}

export interface NextApiProcessCallback {
  (
    req: NextApRouterRequest,
    res: NextApiRouterResponse,
    next: NextCallback
  ): void;
}

export interface NextApiErrorHandlerCallback {
  (
    err: Error | NextApiRouteError,
    req: NextApRouterRequest,
    res: NextApiRouterResponse
  ): void;
}

export type NextApRouterRequest = Request & {
  session?: any;
  cookies: ReadonlyRequestCookies;
  query: Record<string | number, any>;
  params: Record<string | number, any>;
  data?: any;
  ip?: string;
  getHeader(name: HttpHeaders[number]): string;
  getHeaders: typeof GetHeaders;
  _startAt: [number, number];
  // allowing add any prop
  [key: string]: any;
};

declare function GetHeaders<T extends string>(
  name?: HttpHeaders[number][] | T[] | string[]
): Partial<Record<T, string>>;

export type BodyParserOptions = {
  /**
   * refere to  [typeis](https://www.npmjs.com/package/type-is) for more info
   */
  type?: string[];
};

export type BodyParser = {
  text(options?: BodyParserOptions): NextApiProcessCallback;
  json(options?: BodyParserOptions): NextApiProcessCallback;
  form(options?: BodyParserOptions): NextApiProcessCallback;
};

export type NextApiRouterOptions = {
  timeout?: number;
  apiFolderPath?: string;
  ejsFolderPath?: string;
};

export interface NextApiRouterType {
  routes: string[];
  apiFolderPath: string;
  ejsFolderPath: string;
  bodyParser: BodyParser;
  get(route: string, ...args: NextApiProcessCallback[]): this;
  post(route: string, ...args: NextApiProcessCallback[]): this;
  put(route: string, ...args: NextApiProcessCallback[]): this;
  delete(route: string, ...args: NextApiProcessCallback[]): this;
  patch(route: string, ...args: NextApiProcessCallback[]): this;
  options(route: string, ...args: NextApiProcessCallback[]): this;
  head(route: string, ...args: NextApiProcessCallback[]): this;
  all(route: string, ...args: NextApiProcessCallback[]): this;
  use(...args: NextApiProcessCallback[]): this;
  use(
    route: string,
    ...args: Array<NextApiProcessCallback | NextApiRouterType>
  ): this;
  errorHandler(cb: NextApiErrorHandlerCallback): this;
  setApiFolderPath(value: string): this;
  setEjsFolderPath(value: string): this;
  handler(): (req: Request) => Promise<Response>;
  getHeader(name: string): string;
}

export default function NextApiRouter(
  options?: NextApiRouterOptions
): NextApiRouterType;
