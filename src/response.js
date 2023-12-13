import { Readable } from "stream";
import { cookies } from "next/headers";
import fs from "fs";
import ejs from "ejs";
import etag from "etag";
import { fileMetaAsync } from "./util/fileMetaAsync";
import { NotFoundError } from "./errors";
import { request } from "undici";
// only the common MIME TYPE
const FILE_ENDING_TO_MIME_TYPE = {
  "7z": "application/x-7z-compressed",
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
  jsonld: "application/ld+json",
  mjs: "text/javascript",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rar: "application/vnd.rar",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  txt: "text/plain",
  vsd: "application/vnd.visio",
  wav: "audio/wav",
  webm: "video/webm",
  xls: "application/vnd.ms-excel",
  xml: "application/xml",
  zip: "application/zip",
};

// for cache etag locally
const eTagMap = new Map();

export function getHeader(name) {
  return this.headers.get(name);
}

export function getHeaders(names = []) {
  if (names instanceof Array && names.length > 0) {
    const headers = {};
    names.forEach((name) => {
      headers[name] = this.headers.get(name);
    });
    return headers;
  }

  const headers = {};
  this.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * @param {string} path
 */
const processPath = (path, fileName = "") => {
  const parts = String(path)
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "");

  // handle base case
  if (path.length == 0) return "";

  // check if last part of url contains at least one '.' in between. if not, add '.ejs' to the end
  const lastUrlParts = parts[parts.length - 1]
    .split(".")
    .map((str) => str.trim());

  parts[parts.length - 1] =
    lastUrlParts.length > 1
      ? lastUrlParts.join(".")
      : lastUrlParts[0] + fileName;

  // check if first part of url start with '/'. if not, add '/' to the it

  return "/" + parts.join("/");
};

/**
 *
 * @param {any} message
 * @returns {{
 *  type:'string' | 'readable'
 *  message: string | Readable
 * }}
 */
const processResponseMessage = (message) => {
  // null meaning no return body
  if (message == null) {
    return { type: "null", message };
  }
  /** buffer case */
  if (message instanceof Buffer) {
    return { type: "readable", message: new Readable.from(message) };
  }
  if (message instanceof ReadableStream) {
    return { type: "readable", message };
  }
  /** any other case */
  if (typeof message === "object") {
    // convert object to string type
    return { type: "string", message: JSON.stringify(message) };
  }

  return { type: "string", message: String(message) };
};
export class NextApiRouterResponse extends Response {
  constructor({
    reqOrigin = null,
    ejsFolderPath = "",
    req,
    ...restprops
  } = {}) {
    super(restprops);
    this._reqOrigin = reqOrigin;
    this._ejsFolderPath = ejsFolderPath;
    /**@type {import('../index').NextApiRouterRequest} */
    this._req = req;
  }
  _nextPromiseResolver = null;
  _redirectUrl = null;
  _headers = {};
  _status = null;
  _setContentType = null;
  _sent = null;
  _response = null;
  /**@type {URL} */
  _requestUrlObject = null;
  _statusText = null;
  get statusMessage() {
    return this._statusText || undefined;
  }
  set statusMessage(value) {
    this._statusText = value;
  }
  get statusCode() {
    return this._status;
  }
  set statusCode(value) {
    this._status = value;
  }
  get cookies() {
    return cookies();
  }
  get headersSent() {
    return this._sent;
  }
  setStatusMessage(message) {
    this.statusMessage = message;
    return this;
  }
  /**
   *
   * @param {import('../index').HttpHeaders[number]} name
   * @param {string} value
   * @returns
   */
  setHeader(name, value) {
    this.headers.set(name, value);
    return this;
  }
  /**
   *
   * @param {import('../index').HttpHeadersObject} headers
   * @returns
   */
  setHeaders(headers) {
    for (let key in headers) {
      this.headers.set(key, headers[key]);
    }
    return this;
  }
  getHeader(name) {
    return getHeader.call(this, name);
  }
  getHeaders(names = []) {
    return getHeaders.call(this, names);
  }
  /**
   * for express middleware compatibility only, do not expose to type
   */
  set(name, value) {
    this.setHeader(name, value);
    return this;
  }
  removeHeader(name) {
    this.headers.delete(name);
    return this;
  }
  status(code) {
    this._status = code;
    return this;
  }
  json(data) {
    this.headers.set("content-type", "application/json");
    try {
      this.send(JSON.stringify(data));
    } catch {
      throw new Error("data is not valid json, can't not be stringify");
    }
  }
  async sendFile(filePath, headers = {}) {
    // use file meta for  header info
    const fileMeta = await fileMetaAsync(filePath);

    if (fileMeta == false) {
      throw new NotFoundError();
    }
    // set content-length
    if (typeof fileMeta.size === "number") {
      this.setHeader("content-length", fileMeta.size);
    }
    // set etag
    const _etag = etag(JSON.stringify(fileMeta), { weak: true });
    if (typeof fileMeta.size === "number") {
      this.setHeader("etag", _etag);
    }

    // make the best guess to the header content-type based on file-ending.
    const parts = filePath.split(".");
    const fileEnding = parts[parts.length - 1];
    const contentType = FILE_ENDING_TO_MIME_TYPE[fileEnding] ?? "";
    this.setHeader("content-type", contentType || "application/octet-stream");

    // user override
    this.setHeaders(
      typeof headers === "function"
        ? headers(fileMeta, filePath, this._req)
        : headers
    );

    // if etag already exist, return 304
    if (eTagMap.get(_etag)) {
      return this.status(304).send();
    }

    // map new etag
    eTagMap.set(_etag, true);
    // stream file to the client
    const stream = fs.createReadStream(filePath);
    await this.pipe(stream);
  }
  redirect(url) {
    this._redirectUrl = url;
    // trigger send
    this.send();
  }
  /**
   * @param {string | URL} url
   * @param {import("../index").UndiciRequestOptions} options
   */
  async rewrite(url, options = {}) {
    const _headers = this._req.getHeaders();
    // dropping host header because it will cause https issue and
    // x-forwarded-* should be sufficient enough for remote resource to understand where the request is coming from.
    _headers["host"] = undefined;

    if (typeof url === "string" && url.startsWith("/")) {
      const _url = new URL(this._req.url);
      _url.pathname = url;
      url = _url;
    }

    /**
     * because `fetch` will automatically unzip gzip body, `request` form `undici` is used
     */
    const { statusCode, headers, body } = await request(url, {
      method: this._req.method,
      headers: _headers,
      body: this._req.body,
      ...options,
    });

    this.status(statusCode).setHeaders(headers).pipe(body);
  }
  /**
   * @param {Readable} stream
   */
  async pipe(stream) {
    if (stream instanceof ReadableStream) {
      this.send(stream);
      return;
    }

    if (stream instanceof Readable) {
      const readableStream = new ReadableStream({
        async pull(controller) {
          for await (const chunk of stream) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      this.send(readableStream);
      return;
    }

    throw new Error("pipe stream can only be a Readable or a ReadableStream");
  }

  /**
   * @param {string} path
   * @param {import('ejs').Data} [data]
   * @param {import('ejs').Options & {async?:boolean}} [options]
   * @returns
   */
  async render(path, data, options) {
    // check if path is template string our not
    const isXmlRegex = /^\s*<[\s\S]*>/;
    if (isXmlRegex.test(path)) {
      const render = await ejs.render(path, data, {
        async: true,
        ...options,
      });
      this.setHeader("content-type", "text/html; charset=utf-8");
      this.send(render);
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        fs.readFile(
          process.cwd() +
            processPath(this._ejsFolderPath) +
            processPath(path, ".ejs"),
          "utf8",
          async (err, template) => {
            if (err) {
              return reject(err);
            }
            const render = await ejs.render(template, data, {
              async: true,
              ...options,
            });
            // set content to text/html, or next.js will just set to text/plain and it will not be rendered by browser
            this.setHeader("content-type", "text/html; charset=utf-8");
            this.send(render);
            resolve();
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }
  resolveNext() {
    if (this._nextPromiseResolver) {
      this._nextPromiseResolver();
      this._nextPromiseResolver = null;
    }
  }
  send(message = null) {
    // _nextPromise will be bound from the handler()
    this.resolveNext();
    if (this._redirectUrl && !this._sent) {
      this._sent = true;

      if (
        typeof this._redirectUrl === "string" &&
        this._redirectUrl.startsWith("/")
      ) {
        const url = this._requestUrlObject;
        url.pathname = this._redirectUrl;
        this._response = Response.redirect(url, this.statusCode || 302);
        return;
      }

      this._response = Response.redirect(
        this._redirectUrl,
        this.statusCode || 302
      );
      return;
    }

    /**@type {ResponseInit} */
    const payloadOptions = {
      status: this._status || 200,
      statusText: this.statusMessage,
      headers: this.headers,
    };

    if (!this._sent) {
      this._startAt = process.hrtime();
      this._sent = true;

      const { message: processedMessage } = processResponseMessage(message);
      this._response = new Response(processedMessage, payloadOptions);
      return;
    }
  }
  _writeSetup() {
    if (!this._readstream) {
      this._isEnded = false;
      this._readstream = new ReadableStream({
        start: async (controller) => {
          this._readstreamController = controller;
        },
      });
    }

    if (!this._sent) {
      this.send(this._readstream);
    }
  }
  _processWriteMessage(message = "") {
    this._readstreamController.enqueue(
      message instanceof Uint8Array
        ? message
        : typeof message === "string"
        ? message
        : String(message)
    );
  }
  writeHead(statusCode, statusMessageOrHeaders, headers) {
    this.status(statusCode);

    if (typeof statusMessageOrHeaders === "string") {
      this.statusMessage = statusMessageOrHeaders;
      this.setHeaders(headers);
      this._writeSetup();
      return this;
    }

    this.setHeaders(statusMessageOrHeaders);
    this._writeSetup();
    return this;
  }
  writeLine(message = "") {
    this._writeSetup();
    this._processWriteMessage(message);
    return this;
  }
  write(message) {
    this.writeLine(message);
    return this;
  }
  end(message = "") {
    if (this._readstreamController && !this._isEnded) {
      this._processWriteMessage(message);
      this._readstreamController.close();
      this._isEnded = true;
    }
  }
}
