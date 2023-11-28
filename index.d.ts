import { type Data as EjsData, type Options as EjsOptions } from "ejs";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { type OutgoingHttpHeaders, type IncomingHttpHeaders } from "http";
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

export declare class NextApiRouterResponse {
  headers: Headers;
  cookies: ReadonlyRequestCookies;
  setHeader(name: HttpHeaders[number], value: string): this;
  setHeaders(headers: OutgoingHttpHeaders | IncomingHttpHeaders): this;
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
  writeHead(statusCode: number, headers?: OutgoingHttpHeaders): this;
  writeLine(message?: number | string | Uint8Array): this;
  end(message?: number | string | Uint8Array): void;
  getHeader(name: HttpHeaders[number]): string;
  getHeaders: typeof GetHeaders;
}

export declare class NextApiRouteError extends Error {
  constructor(message: string);
  setMessage(value: string): this;
  setName(value: string): this;
}
export declare class NotFoundError extends NextApiRouteError {}
export declare class MalformedJsonError extends NextApiRouteError {}
export declare class NoReponseFromHandlerError extends NextApiRouteError {}
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
  getHeader(name: HttpHeaders[number]): string;
  getHeaders: typeof GetHeaders;
  // allowing add any prop
  [key: string]: any;
};

declare function GetHeaders<T extends string>(
  name?: HttpHeaders[number][] | T[] | string[]
): Partial<Record<T, string>>;

export type BodyParser = {
  text: () => NextApiProcessCallback;
  json: () => NextApiProcessCallback;
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
