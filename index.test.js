import NextApiRouter, {
  MalformedJsonError,
  MethodNotAllowedError,
  NotFoundError,
  TimeoutError,
} from "./index";
import { makeHttpRequest } from "./src/util/makeHttpRequest";
import { sleep } from "./src/util/sleep";
import { NextApiRouteError } from "./src/errors";
import { NextApiRouterResponse } from "./src/response";
import { Readable } from "stream";
import { collectAllChildRouters } from "./src/util/collectAllChildrenRouters";
import { makeTimeoutInstance } from "./src/util/makeTimeoutInstance";

const BASE_URL = "http://localhost:3000/api";
const TEST_TIME_OUT_ROUTE = "/timeout";
const TEST_HTTP_METHOD_ROUTE = "/method/test";
const TEST_ALL_HTTP_METHOD_ROUTE = "/method/all";
const TEST_PARSE_JSON = "/parse-json";
const TEST_PARSE_TEXT = "/parse-text";
const TEST_PARSE_FORM = "/parse-form";
const TEST_EJS_ROUTE = "/ejs";
const TEST_ERROR_ROUTE = "/error";
const TEST_ERROR_MESSAGE = "THIS IS AN ERROR";

const app = NextApiRouter({
  timeout: 1000,
  apiFolderPath: "/api",
  ejsFolderPath: "/src/test-use",
});

app.setApiFolderPath("/api");

app.get("/", (req, res) => {
  req.data = "BASE_ROUTE";
  res.send("OK");
});

app.get("/user/:userId/post/:postId", (req, res) => {
  res.send("OK");
});

app.get("/user/:uid/post/:pid/followers", (req, res) => {
  res.send("OK");
});

app.all(TEST_ALL_HTTP_METHOD_ROUTE, (req, res) => {
  req.data = "ALL";
  res.send("OK");
});

app.get(TEST_EJS_ROUTE, (req, res) => {
  res.render("template.ejs", { foo: "bar" });
});

app.get(TEST_TIME_OUT_ROUTE, (req, res, next) => {
  // keep empty for test
});

app.get(TEST_ERROR_ROUTE, async (req, res) => {
  throw new Error(TEST_ERROR_MESSAGE);
});

app.post(TEST_PARSE_JSON, app.bodyParser.json(), (req, res) => {
  res.send("OK");
});

app.post(TEST_PARSE_TEXT, app.bodyParser.text(), (req, res) => {
  res.send("OK");
});

app.post(TEST_PARSE_FORM, app.bodyParser.form(), (req, res) => {
  res.send("OK");
});

app
  .get(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    // add something to data object so it is testable
    req.data = "GET";
    res.send("OK");
  })
  .post(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "POST";
    res.send("OK");
  })
  .put(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "PUT";
    res.send("OK");
  })
  .delete(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "DELETE";
    res.send("OK");
  })
  .options(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "OPTIONS";
    res.send("OK");
  })
  .patch(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "PATCH";
    res.send("OK");
  })
  .head(TEST_HTTP_METHOD_ROUTE, (req, res) => {
    req.data = "HEAD";
    res.send("OK");
  });

app.get(BASE_URL + "/test");
app.errorHandler((err, req, res) => {
  // bind error to req object so that it is testable
  req.err = err;
  // return response that actually testable
  if (err instanceof NotFoundError) {
    return res.status(404).send("Not found");
  }
  if (err instanceof MalformedJsonError) {
    return res.status(400).send("Malformed json in body's payload");
  }
  if (err instanceof TimeoutError) {
    return res.status(408).send(TimeoutError);
  }
  if (err instanceof MethodNotAllowedError) {
    return res.status(405).send("Method not allowed");
  }

  res.status(500).send("Server Error");
});

const routeHandler = app.handler();

describe("https methods", () => {
  const methods = ["GET", "POST", "DELETE", "PUT", "OPTIONS", "PATCH", "HEAD"];
  for (let method of methods) {
    const url = BASE_URL + TEST_HTTP_METHOD_ROUTE;
    test("test: " + method.toLowerCase() + "()", async () => {
      const request = makeHttpRequest(url, {
        method,
      });
      const response = await routeHandler(request);
      expect(response).toBeInstanceOf(Response);
      expect(request.data).toBe(method);
      expect(response.status).toBe(200);
    });
  }

  describe("test all()", () => {
    for (let method of methods) {
      const url = BASE_URL + TEST_ALL_HTTP_METHOD_ROUTE;
      test("should bind to all http method, test: " + method, async () => {
        const request = makeHttpRequest(url, {
          method,
        });
        const response = await routeHandler(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(request.data).toBe("ALL");
      });
    }
  });
});

describe("Basics of NextApiResponse class", () => {
  test("setHeader() can set header of the response", () => {
    const response = new NextApiRouterResponse();
    response.setHeader("content-type", "random-type");
    expect(response.headers.get("content-type")).toBe("random-type");
  });

  test("set() can also header of the response", () => {
    const response = new NextApiRouterResponse();
    response.set("content-type", "random-type");
    expect(response.headers.get("content-type")).toBe("random-type");
  });

  test("setHeaders() can muliple headers of the response", () => {
    const response = new NextApiRouterResponse();
    response.setHeaders({
      "content-type": "random-type",
      "content-length": "100",
    });
    expect(response.headers.get("content-type")).toBe("random-type");
    expect(response.headers.get("content-length")).toBe("100");
  });

  test("json() will enforced application/json contet-type in header", () => {
    const response = new NextApiRouterResponse();
    response.json({ foo: "bar" });
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("getHeader() can set header of the response", () => {
    const response = new NextApiRouterResponse();
    response.setHeader("content-type", "random-type");
    expect(response.getHeader("content-type")).toBe("random-type");
  });

  test("getHeaders() can muliple headers of the response", () => {
    const response = new NextApiRouterResponse();
    response.setHeaders({
      "content-type": "random-type",
      "content-length": "100",
    });

    const headers = response.getHeaders(["content-type", "content-length"]);
    expect(headers["content-type"]).toBe("random-type");
    expect(headers["content-length"]).toBe("100");
  });

  test("redirect() will set _redirectUrl and send", () => {
    const response = new NextApiRouterResponse();
    response._requestUrlObject = new URL("http://localhost:3000/");
    response.redirect("/some/where");

    expect(response._redirectUrl).toBe("/some/where");
    expect(response._sent).toBe(true);
  });

  test("status() will update status code", () => {
    const response = new NextApiRouterResponse();
    response.status(300);
    expect(response.statusCode).toBe(300);
  });

  test("removeHeader() can remove header", () => {
    const response = new NextApiRouterResponse();
    response.setHeader("content-type", "random-type");
    response.removeHeader("content-type");
    expect(response.headers.get("content-type")).toBe(null);
  });

  test("send() will set Response object to _responseMessageRaw and setoptions", async () => {
    const response = new NextApiRouterResponse();
    response.send("test");
    expect(response._sent).toBe(true);
    expect(response._responseMessageRaw).toBe("test");
    expect(response._responseOptions).not.toBeFalsy();
    expect(response._response).toBe(null);
  });

  test("An actual response will make after calling res._Response()", async () => {
    const response = new NextApiRouterResponse();
    response.send("test");
    expect(response._sent).toBe(true);
    expect(response._response).toBe(null);
    await response._Response();
    expect(response._response).toBeInstanceOf(Response);
    expect(await response._response.text()).toBe("test");
  });

  describe("sendFile() should send a file to client with have following characteristics", () => {
    const response = new NextApiRouterResponse();
    response._req = makeHttpRequest("http://localhost:3000/");
    beforeAll(async () => {
      await response.sendFile(process.cwd() + "/src/test-use/text.txt");
      await response._Response();
    });

    test("sendFile() should send a file", async () => {
      expect(response._response).toBeInstanceOf(Response);
      expect(await response._response.text()).toBe("test use");
    });

    test("sendFile() should have etag in header", async () => {
      expect(response.headers.get("etag")).toBeTruthy();
    });

    test("sendFile() should have content-length", async () => {
      expect(response.headers.get("content-length")).toBeTruthy();
    });

    test("sendFile() should have correct content-type", async () => {
      const contentType = response.headers.get("content-type");
      expect(contentType).toBeTruthy();
      expect(contentType.startsWith("text")).toBeTruthy();
    });
  });

  test("pipe() can take Readable", async () => {
    const response = new NextApiRouterResponse();
    response._req = makeHttpRequest("http://localhost:3000");
    const readable = new Readable();
    // push a `null` to signal end of readable (see https://nodejs.org/api/stream.html#readablepushchunk-encoding for details)
    readable.push(null);
    await response.pipe(readable);
    await response._Response();
    expect(response._response).toBeInstanceOf(Response);
    expect(response.isStreamEnded).toBeTruthy();
  });

  test("in pipe(), a Readable can be aborted with a AbortController signal", async () => {
    const response = new NextApiRouterResponse();
    response._req = makeHttpRequest("http://localhost:3000");
    const abortController = new AbortController();
    const readable = new Readable({
      signal: abortController.signal,
    });

    abortController.abort();
    await response.pipe(readable);
    expect(response.isStreamEnded).toBeTruthy();
  });

  test("pipe() can take a ReadableStream", async () => {
    const response = new NextApiRouterResponse();
    response._req = makeHttpRequest("http://localhost:3000");
    await response.pipe(new ReadableStream());
    await response._Response();
    expect(response._response).toBeInstanceOf(Response);
  });

  test("pipe() type other than Readable or ReadableStream will throw error", async () => {
    const response = new NextApiRouterResponse();
    const err = await response.pipe("not a readable").catch((err) => err);
    expect(err).toBeInstanceOf(Error);
  });

  test("setStatusMessage() can set statusText of response", async () => {
    const app = NextApiRouter();
    app.get("/test", (req, res) => {
      res.setStatusMessage("test");
      expect(res.statusMessage).toBe("test");
      res.send("");
    });
    const request = makeHttpRequest(BASE_URL + "/test", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.statusText).toBe("test");
  });

  test("writeHeader() can have 3 args, while second arg will modify statusMessage and thrid arg will be headers", async () => {
    const app = NextApiRouter();
    app.get("/test", (req, res) => {
      res.writeHead(201, "test", { "content-length": "100" });
      expect(res.statusMessage).toBe("test");
      res.end();
    });
    const request = makeHttpRequest(BASE_URL + "/test", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.status).toBe(201);
    expect(response.statusText).toBe("test");
    expect(response.headers.get("content-length")).toBe("100");
  });

  test("statusCode set and return the currently status code of the response object", async () => {
    const app = NextApiRouter();
    app.get("/test", (req, res) => {
      res.statusCode = 300;
      expect(res.statusCode).toBe(300);
      res.send();
    });
    const request = makeHttpRequest(BASE_URL + "/test", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.status).toBe(300);
  });
});

describe("behaviors", () => {
  test("all route should always return a Response object", async () => {
    const request = makeHttpRequest(BASE_URL, {
      method: "GET",
    });
    const response = await routeHandler(request);
    expect(response).toBeInstanceOf(Response);
  });

  test("app will return RouteNotFound if route does not exist", async () => {
    const request = makeHttpRequest(BASE_URL + "/somewhere/surely/not/exist", {
      method: "GET",
    });
    const response = await routeHandler(request);
    expect(request.err).toBeInstanceOf(NotFoundError);
    expect(response.status).toBe(404);
  });

  test("app will return MethodNotAllow if route exist but method is not", async () => {
    const request = makeHttpRequest(BASE_URL, {
      method: "POST",
    });
    const response = await routeHandler(request);
    expect(request.err).toBeInstanceOf(MethodNotAllowedError);
    expect(response.status).toBe(405);
  });

  test("app will intercept thrown error and pass to error handler", async () => {
    const request = makeHttpRequest(BASE_URL + TEST_ERROR_ROUTE, {
      method: "GET",
    });
    await routeHandler(request);
    expect(request.err).toBeInstanceOf(Error);
    expect(request.err.message).toBe(TEST_ERROR_MESSAGE);
  });

  test("writeHead(), writeLine() and end()", async () => {
    const app3 = NextApiRouter({ timeout: 3000 });
    app3.get("/writeline", (req, res) => {
      const run = async () => {
        res.writeHead(200, { "content-type": "text/html" });
        res.writeLine("start");
        for (let i = 0; i < 2; i++) {
          await sleep(50);
          res.writeLine(i);
        }
        res.end("end");
      };

      run();
    });
    const request = makeHttpRequest(BASE_URL + "/writeline", {
      method: "GET",
    });
    const response = await app3.handler()(request);

    // test writeHead
    expect(response.headers.get("content-type")).toBe("text/html");

    const reader = response.body.getReader();
    const expectResult = ["start", "0", "1", "end"];

    let i = 0;
    while (true) {
      const { done, value } = await reader.read();
      // test writeLine
      expect(value).toBe(expectResult[i]);
      i++;
      if (done) {
        break;
      }
    }
  });

  describe("middlewares", () => {
    // build a new app for testing middlewares
    const app2 = NextApiRouter({
      timeout: 100,
      apiFolderPath: "/api",
      ejsFolderPath: "/src/test-use",
    });

    const NOT_CALL_NEXT_ROUTE = "/not-call-next";

    app2.get(
      NOT_CALL_NEXT_ROUTE,
      (req, res, next) => {},
      (req, res) => {
        res.send("OK");
      }
    );

    app2.use((req, res, next) => {
      req.data = [0];
      next();
    });

    app2.get(
      "/",
      (req, res, next) => {
        req.data.push(1);
        next();
      },
      async (req, res, next) => {
        req.data.push(2);
        next();
      }
    );

    app2.use(async (req, res, next) => {
      await sleep(150);
      req.data.push(3);
    });

    app2.errorHandler((err, req, res) => {
      req.err = err;
      res.send(err.message);
    });

    const routeHandler = app2.handler();
    test("middleware should follow the sequence", async () => {
      const request = makeHttpRequest(BASE_URL, {
        method: "GET",
      });

      await routeHandler(request);
      expect(request.data[0]).toBe(0);
      expect(request.data[1]).toBe(1);
      expect(request.data[2]).toBe(2);
      expect(typeof request.data[3]).toBe("undefined");
      await sleep(200);
      expect(request.data[3]).toBe(3);
    });

    test("will stalled and timeout if next is not called", async () => {
      const request = makeHttpRequest(BASE_URL + NOT_CALL_NEXT_ROUTE, {
        method: "GET",
      });

      await routeHandler(request);
      expect(request.err).toBeInstanceOf(TimeoutError);
    });
  });
});

describe("url & query params", () => {
  test("':' sign will be turned url params in req.params", async () => {
    const request = makeHttpRequest(BASE_URL + "/user/1/post/2", {
      method: "GET",
    });
    await routeHandler(request);
    expect(request.params.userId).toBe(1);
    expect(request.params.postId).toBe(2);
  });

  test("url params can assigned different name in different route", async () => {
    const request = makeHttpRequest(BASE_URL + "/user/1/post/2/followers", {
      method: "GET",
    });
    await routeHandler(request);
    expect(request.params.uid).toBe(1);
    expect(request.params.pid).toBe(2);
  });

  test("query params will be assigned to req.query", async () => {
    const request = makeHttpRequest(BASE_URL + "?a=b&c=1", {
      method: "GET",
    });
    await routeHandler(request);
    expect(request.query.a).toBe("b");
    expect(request.query.c).toBe(1);
  });
});

describe("ejs", () => {
  test("render() will render ejs", async () => {
    const request = makeHttpRequest(BASE_URL + TEST_EJS_ROUTE, {
      method: "GET",
    });
    const response = await routeHandler(request);
    const body = await response.text();
    expect(body.startsWith("<html>")).toBeTruthy();
    expect(body.includes("bar")).toBeTruthy();
  });
});

describe("bodyParser", () => {
  test("json() will auto parse json in body (regardless header content-type)", async () => {
    const data = { a: "b" };
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_JSON, {
      body: JSON.stringify(data),
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });
    await routeHandler(request);
    expect(request.data.a).toBe("b");
  });

  test("json() parse empty object if body is empty", async () => {
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_JSON, {
      body: "",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });
    await routeHandler(request);
    expect(Object.keys(request.data).length).toBe(0);
  });

  test("json() will throw MalformedJson error if request body is not a valid JSON", async () => {
    const data = "not a json";
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_JSON, {
      body: data,
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });
    const res = await routeHandler(request);
    expect(request.err).toBeInstanceOf(MalformedJsonError);
  });

  test("text() will pase body as text", async () => {
    const text = "some random text";
    const data = Buffer.from(text);
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_TEXT, {
      body: data,
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
    });
    const res = await routeHandler(request);
    expect(typeof request.data).toBe("string");
    expect(request.data).toBe(text);
  });

  test("form() will parse url formdata", async () => {
    const form = new FormData();
    form.append("a", "b");
    form.append("c", "d");
    form.append("e", "1");
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_FORM, {
      body: form,
      method: "POST",
      // do not added content-type header, it will be added by the form object automatically
    });

    const res = await routeHandler(request);

    expect(request.data.a).toBe("b");
    expect(request.data.c).toBe("d");
    expect(request.data.e).toBe(1);
  });

  test("form() will parse empty object if body is empty", async () => {
    const request = makeHttpRequest(BASE_URL + TEST_PARSE_FORM, {
      body: "",
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    await routeHandler(request);
    expect(Object.keys(request.data).length).toBe(0);
  });
});

describe("complex routing", () => {
  const appA = NextApiRouter();
  const appB = NextApiRouter();
  const appC = NextApiRouter();
  const appD = NextApiRouter();
  const appE = NextApiRouter();
  appA.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appA") : ["appA"];
    next();
  });

  appB.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appB") : ["appB"];
    next();
  });

  appC.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appC") : ["appC"];
    next();
  });

  appD.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appD") : ["appD"];
    next();
  });

  appE.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appE") : ["appE"];
    next();
  });

  appA.use("/d", appD);

  appD.use("/e", appE);

  appE.get("/test", (req, res, next) => {
    req.data = req.data ? req.data.concat("appECb") : ["appECb"];
    next();
  });

  appE.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appEpost") : ["appEpost"];
    next();
  });

  appD.use((req, res, next) => {
    req.data = req.data ? req.data.concat("appDpost") : ["appDpost"];
    res.send("OK");
  });

  appC.get(
    "/test",
    (req, res, next) => {
      req.data = req.data ? req.data.concat("appCSchema") : ["appCSchema"];
      next();
    },
    (req, res) => {
      res.send("OK");
    }
  );

  appA.use(
    "/b",
    (req, res, next) => {
      req.data = req.data ? req.data.concat("appASchema") : ["appASchema"];
      next();
    },
    appB
  );

  appB.use(
    "/c",
    (req, res, next) => {
      req.data = req.data ? req.data.concat("appBSchema") : ["appBSchema"];
      next();
    },
    appC
  );

  appB.get("/test", (req, res) => {
    res.send("OK");
  });

  test("complex routing B", async () => {
    const request = makeHttpRequest(BASE_URL + "/b/test", {
      method: "GET",
    });

    const response = await appA.handler()(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(request.data).toBeInstanceOf(Array);
    expect(request.data.length).toBe(3);

    // check if middleware follow expected sequence
    const answers = ["appA", "appASchema", "appB"];
    for (let i = 0; i < request.data.length; i++) {
      expect(request.data[i]).toBe(answers[i]);
    }
  });

  test("complex routing C", async () => {
    const request = makeHttpRequest(BASE_URL + "/b/c/test", {
      method: "GET",
    });

    const response = await appA.handler()(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(request.data).toBeInstanceOf(Array);
    expect(request.data.length).toBe(6);
    // check if middleware follow expected sequence
    const answers = [
      "appA",
      "appASchema",
      "appB",
      "appBSchema",
      "appC",
      "appCSchema",
    ];
    for (let i = 0; i < request.data.length; i++) {
      expect(request.data[i]).toBe(answers[i]);
    }
  });

  test("complex routing D", async () => {
    const request = makeHttpRequest(BASE_URL + "/d/e/test", {
      method: "GET",
    });

    const response = await appA.handler()(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(request.data).toBeInstanceOf(Array);
    expect(request.data.length).toBe(6);
    // check if middleware follow expected sequence
    const answers = ["appA", "appD", "appE", "appECb", "appEpost", "appDpost"];
    for (let i = 0; i < request.data.length; i++) {
      expect(request.data[i]).toBe(answers[i]);
    }
  });
});

describe("Test NextApiRouteError class", () => {
  test("can set message and name with setMessage() and setName()", async () => {
    const error = new NextApiRouteError();
    expect(error.setMessage("test")).toBeInstanceOf(NextApiRouteError);
    expect(error.setName("TEST_ERROR")).toBeInstanceOf(NextApiRouteError);
    expect(error.message).toBe("test");
    expect(error.name).toBe("TEST_ERROR");
  });
});

describe("test functions", () => {
  test("collectAllChildRouters() should return all the child router instances", () => {
    const app1 = NextApiRouter();
    const app2 = NextApiRouter();
    const app3 = NextApiRouter();
    const app4 = NextApiRouter();
    const app5 = NextApiRouter();

    app1.use("/a", app2);
    app2.use("/c", app3);
    app1.use("/d", app4);
    app3.use("/e", app5);

    const nodes = collectAllChildRouters(app1);
    expect(nodes.length).toBe(4);
    for (let node of [app2, app3, app4, app5]) {
      expect(nodes.includes(node)).toBe(true);
    }
  });
});

describe(
  "test error chaining:\n" +
    "if error happend to child router, it will start from the child router and go all the way to its outter most parent." +
    "if any router in between has it's errorhandler set, it will be executed until a response is sent",
  () => {
    const app1 = NextApiRouter();
    app1.errorHandler((err, req, res) => {
      err.message += "app1";
      res.send(err.message);
    });

    const app2 = NextApiRouter();
    app2.get("/test", (req, res) => {
      throw new Error("");
    });

    const app3 = NextApiRouter();
    app3.errorHandler((err, req, res, next) => {
      err.message += "app3";
      next();
    });
    app3.get("/test", (req, res) => {
      throw new Error("");
    });

    const app4 = NextApiRouter();
    app4.errorHandler((err, req, res) => {
      err.message += "app4";
      res.send(err.message);
    });
    app4.get("/test", (req, res) => {
      throw new Error("");
    });

    const app5 = NextApiRouter();
    app5.errorHandler((err, req, res, next) => {
      err.message += "app5";
      next();
    });
    app5.get("/test", (req, res) => {
      throw new Error("");
    });

    const app6 = NextApiRouter();
    app6.errorHandler((err, req, res, next) => {
      err.message += "app5";
      next(new Error("override"));
    });
    app6.get("/test", (req, res) => {
      throw new Error("");
    });

    app1.use("/1", app2);

    app2.use("/2", app3);
    app2.use("/2-2", app4);
    app3.use("/3", app4);
    app4.use("/4", app5);

    app1.use("/6", app6);

    test("app2 should push error to app1 since app1 is outter most parent and app2 error handler is not set", async () => {
      const request = makeHttpRequest(BASE_URL + "/1/test", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(await response.text()).toBe("app1");
    });

    test("app3 should receive error of app3app1 because app3 error handler is set, app2 is not set and app3 did not return reponse", async () => {
      const request = makeHttpRequest(BASE_URL + "/1/2/test", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(await response.text()).toBe("app3app1");
    });

    test("app4 should receive error of app4 because app4 error handler is set and it does return a response", async () => {
      const request = makeHttpRequest(BASE_URL + "/1/2-2/test", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(await response.text()).toBe("app4");
    });

    test("if chaining app1<=app2<=app3<==app4<==app5, the error thrown in app5 should stop at app4 before app4 will return an error reponse", async () => {
      const request = makeHttpRequest(BASE_URL + "/1/2/3/4/test", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(await response.text()).toBe("app5app4");
    });

    test("next(err) will override the err object pass to the next error handler", async () => {
      const request = makeHttpRequest(BASE_URL + "/6/test", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(await response.text()).toBe("overrideapp1");
    });
  }
);

describe("test complex middlewares with sub-routers and wildcard", () => {
  const app1 = NextApiRouter();
  const app2 = NextApiRouter();
  const app3 = NextApiRouter();

  test("wildcard should catch all route", async () => {
    app1.get("/test/*", (req, res) => {
      res.send();
    });
    const request = makeHttpRequest(BASE_URL + "/test/some/random/route", {
      method: "GET",
    });
    const response = await app1.handler()(request);
    expect(response.status).toBe(200);
  });

  test("wildcard can ues a prefix", async () => {
    app1.get("/prefix/abc*", (req, res) => {
      res.send();
    });
    const request1 = makeHttpRequest(BASE_URL + "/prefix/abc/random/route", {
      method: "GET",
    });
    const response1 = await app1.handler()(request1);
    expect(response1.status).toBe(200);

    const request2 = makeHttpRequest(BASE_URL + "/prefix/other/random/route", {
      method: "GET",
    });
    const response2 = await app1.handler()(request2);
    expect(response2.status).toBe(404);

    const request3 = makeHttpRequest(BASE_URL + "/prefix/abcdef/random/route", {
      method: "GET",
    });

    const response3 = await app1.handler()(request3);
    expect(response3.status).toBe(200);
  });

  describe("url param can be processed in `use()` correctly, and a wildcard should not have conflict to the url param", () => {
    app1.use("/:a/b/:c", app2);
    app2.use("/:d/e", app3);
    app3.get("/:f", (req, res) => {
      res.send("OK");
    });

    test("url param can be processed in `use()` correctly", async () => {
      const request = makeHttpRequest(BASE_URL + "/a/b/c/d/e/f", {
        method: "GET",
      });
      const response = await app1.handler()(request);
      expect(response.status).toBe(200);
      expect(request.params).not.toBe(undefined);
      expect(request.params.a).toBe("a");
      expect(request.params.c).toBe("c");
      expect(request.params.d).toBe("d");
      expect(request.params.f).toBe("f");
    });

    test("wildcard should not have conflict to the url param", async () => {
      app3.get("/:wild/*", (req, res) => {
        res.send("OK");
      });
      const request = makeHttpRequest(
        BASE_URL + "/a/b/c/d/e/wild/some/random/route",
        {
          method: "GET",
        }
      );
      const response = await app1.handler()(request);
      expect(response.status).toBe(200);
      expect(request.params).not.toBe(undefined);
      expect(request.params.a).toBe("a");
      expect(request.params.c).toBe("c");
      expect(request.params.d).toBe("d");
      expect(request.params.wild).toBe("wild");
    });
  });
});

describe("test static()", () => {
  const app = NextApiRouter();
  app.use(
    "/static",
    (req, res, next) => {
      req.data = {
        static: true,
      };
      next();
    },
    app.static(process.cwd() + "/src/test-use", { test: "test" })
  );

  test("middleware should be accessed", async () => {
    const request = makeHttpRequest(BASE_URL + "/static/text.txt", {
      method: "GET",
    });
    await app.handler()(request);
    expect(request.data.static).toBeTruthy();
  });

  test("can acess file in directory", async () => {
    const request = makeHttpRequest(BASE_URL + "/static/text.txt", {
      method: "GET",
    });
    const response = await app.handler()(request);
    // the file might have already be read by other test , which will check by etag and return 304 with empty body
    if (response.status === 304) {
      expect(response.status).toBe(304);
      expect(await response.text()).toBe("");
    } else {
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("test use");
    }
  });

  test("can acess file in nested directory", async () => {
    const request = makeHttpRequest(BASE_URL + "/static/test-static/text.txt", {
      method: "GET",
    });
    const response = await app.handler()(request);
    if (response.status === 304) {
      expect(response.status).toBe(304);
      expect(await response.text()).toBe("");
    } else {
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("test use");
    }
  });

  test("if file not found, it will return 404", async () => {
    const request = makeHttpRequest(BASE_URL + "/static/directoy/not/exist", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.status).toBe(404);
  });

  test("header can be set by second arg", async () => {
    const request = makeHttpRequest(BASE_URL + "/static/test-static/text.txt", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.headers.get("test")).toBe("test");
  });

  test("header can be a funtion", async () => {
    const app = NextApiRouter();
    app.use(
      "/static",
      (req, res, next) => {
        req.data = {
          static: true,
        };
        next();
      },
      app.static(process.cwd() + "/src/test-use", (stats, path, req) => {
        // will pass the req object
        expect(req.data.static).toBeTruthy();
        // will have file path
        expect(path.split("/").length).toBeGreaterThan(0);
        // will have file meta
        expect(stats.isFile()).toBeTruthy();
        return {
          test: "test2",
        };
      })
    );

    const request = makeHttpRequest(BASE_URL + "/static/test-static/text.txt", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.headers.get("test")).toBe("test2");
  });
});

describe("test restrictions", () => {
  test("callback as last arg of use() will throw", async () => {
    const t = () => {
      const app = NextApiRouter();
      app.use(
        "/static",
        (req, res, next) => {
          next();
        },
        (req, res) => {
          res.send("OK");
        }
      );
    };
    expect(t).toThrow(Error);
  });
});

describe("test util", () => {
  describe("makeTimeoutInstance", () => {
    test("if routerTimeoutValue is false, it will return an empty object", async () => {
      const obj = makeTimeoutInstance(false);
      expect(Object.keys(obj).length).toBe(0);
    });

    test("if routerTimeoutValue is not false, it should return proper object", async () => {
      const { timeoutInstance, timeoutPromise, timeoutResolve, handleTimeout } =
        makeTimeoutInstance(300);
      expect(typeof handleTimeout).toBe("function");
      expect(typeof timeoutResolve).toBe("function");
      expect(typeof timeoutInstance).toBe("object");
      expect(timeoutPromise).toBeInstanceOf(Promise);
    });

    test("if timeout is a function, it will call the function pass reqeust to the callback", async () => {
      const reqeust = {};
      const timeout = (req) => {
        req.a = "b";
        return 300;
      };

      makeTimeoutInstance(timeout, reqeust);

      expect(reqeust.a).toBe("b");
    });
  });
});

describe("test custom request property", () => {
  test("ip", async () => {
    const request = makeHttpRequest(BASE_URL, {
      method: "GET",
      headers: {
        "x-forwarded-for": "127.0.0.1",
      },
    });
    await routeHandler(request);
    expect(request.ip).toBe("127.0.0.1");
  });
});

describe("check base route access", () => {
  const app1 = NextApiRouter();
  const app2 = NextApiRouter();
  const app3 = NextApiRouter();
  app1.get("/", (req, res) => {
    res.send("1");
  });
  app2.get("/", (req, res) => {
    res.send("2");
  });
  app3.get("/", (req, res) => {
    res.send(req.params);
  });
  app1.use("/app2", app2);

  app1.use("/app3/:foo/:bar", app3);

  test("app1 should have access to its base route", async () => {
    const request = makeHttpRequest(BASE_URL + "/api/", {
      method: "GET",
    });
    const response = await app1.handler()(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("1");
  });

  test("app2 should have access to its base route after nesting to the app1", async () => {
    const request = makeHttpRequest(BASE_URL + "/api/app2", {
      method: "GET",
    });
    const response = await app1.handler()(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("2");
  });

  test("app3 should have access to its base route after nesting to the app1 and also the url params", async () => {
    const request = makeHttpRequest(BASE_URL + "/api/app3/a/b", {
      method: "GET",
    });
    const response = await app1.handler()(request);
    expect(response.status).toBe(200);
    expect(request.params.foo).toBe("a");
    expect(request.params.bar).toBe("b");
  });
});

describe("test nested route url params", () => {
  const app = NextApiRouter();

  const app2 = NextApiRouter();

  const app3 = NextApiRouter();

  app.use("/:a", app2);

  app2.get("/:b/:c", (req, res) => {
    res.send({
      params: req.params,
    });
  });

  app2.use("/f/g", app3);

  app3.get("/:h", (req, res) => {
    res.send({
      params: req.params,
    });
  });

  test("query app2 should get proper url params", async () => {
    const request = makeHttpRequest(BASE_URL + "/api/1/2/3", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.status).toBe(200);
    expect(request.params.a).toBe(1);
    expect(request.params.b).toBe(2);
    expect(request.params.c).toBe(3);
  });

  test("query app2 should get proper url params", async () => {
    const request = makeHttpRequest(BASE_URL + "/api/1/f/g/5", {
      method: "GET",
    });
    const response = await app.handler()(request);
    expect(response.status).toBe(200);
    expect(request.params.a).toBe(1);
    expect(request.params.h).toBe(5);
  });
});
