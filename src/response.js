import { Readable } from "stream";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import fs from "fs";
import ejs from "ejs";

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
  constructor({ reqOrigin = null, ejsFolderPath = "", ...restprops } = {}) {
    super(restprops);
    this._reqOrigin = reqOrigin;
    this._ejsFolderPath = ejsFolderPath;
  }
  _nextPromiseResolver = null;
  _redirectUrl = null;
  _headers = {};
  _status = null;
  _setContentType = null;
  _sent = null;
  _response = null;
  get cookies() {
    return cookies();
  }
  get statusCode() {
    return this._status;
  }
  get headersSent() {
    return this._sent;
  }
  setHeader(name, value) {
    this.headers.set(name, value);
    return this;
  }
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
    this.headers["Content-Type"] = "application/json";
    try {
      this.send(JSON.stringify(data));
    } catch {
      throw new Error("data is not valid json, can't not be stringify");
    }
  }
  redirect(url) {
    this._redirectUrl = url;
    this.redirected = true;
    // trigger send
    this.send();
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
    if (this._redirectUrl) {
      return redirect(this._redirectUrl);
    }

    const headers = this.getHeaders();

    const payloadOptions = {
      status: this._status || 200,
      headers,
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
  writeHead(statusCode, headers) {
    this.status(statusCode);
    this.setHeaders(headers);
    this._writeSetup();
    return this;
  }
  writeLine(message = "") {
    this._writeSetup();
    this._processWriteMessage(message);
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
