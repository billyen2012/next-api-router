import App from "next/app";
import NextApiRouter, {
  MalformedJsonError,
  MethodNotAllowedError,
  NotFoundError,
  TimeoutError,
  collectAllChildRouters,
} from "./index";
import { makeHttpRequest } from "./src/util/makeHttpRequest";
import { sleep } from "./src/util/sleep";
import { NextApiRouteError } from "./src/errors";
import { NextApiRouterResponse } from "./src/response";
import { Readable } from "stream";

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
  const response = new NextApiRouterResponse();
  test("setHeader() can set header of the response", () => {
    response.setHeader("content-type", "random-type");
    expect(response.headers.get("content-type")).toBe("random-type");
  });

  test("set() can also header of the response", () => {
    response.set("content-type", "random-type");
    expect(response.headers.get("content-type")).toBe("random-type");
  });

  test("setHeaders() can muliple headers of the response", () => {
    response.setHeaders({
      "content-type": "random-type",
      "content-length": "100",
    });
    expect(response.headers.get("content-type")).toBe("random-type");
    expect(response.headers.get("content-length")).toBe("100");
  });

  test("json() will enforced application/json contet-type in header", () => {
    response.json({ foo: "bar" });
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("getHeader() can set header of the response", () => {
    response.setHeader("content-type", "random-type");
    expect(response.getHeader("content-type")).toBe("random-type");
  });

  test("getHeaders() can muliple headers of the response", () => {
    response.setHeaders({
      "content-type": "random-type",
      "content-length": "100",
    });

    const headers = response.getHeaders(["content-type", "content-length"]);
    expect(headers["content-type"]).toBe("random-type");
    expect(headers["content-length"]).toBe("100");
  });

  test("redirect() will set _redirectUrl and send", () => {
    response.redirect("/some/where");

    expect(response._redirectUrl).toBe("/some/where");
    expect(response._sent).toBe(true);
  });

  test("status() will update status code", () => {
    response.status(300);
    expect(response.statusCode).toBe(300);
  });

  test("removeHeader() can remove header", () => {
    response.setHeader("content-type", "random-type");
    response.removeHeader("content-type");
    expect(response.headers.get("content-type")).toBe(null);
  });

  test("send() will set Response object to _response", () => {
    response.send("test");
    expect(response._sent).toBe(true);
    expect(response._response).toBeInstanceOf(Response);
  });

  test("pipe() can take Readable", async () => {
    await response.pipe(new Readable());
    expect(response._response).toBeInstanceOf(Response);
  });

  test("pipe() can take a ReadableStream", async () => {
    await response.pipe(new ReadableStream());
    expect(response._response).toBeInstanceOf(Response);
  });

  test("pipe() type other than Readable or ReadableStream will throw error", async () => {
    const err = await response.pipe("not a readable").catch((err) => err);
    expect(err).toBeInstanceOf(Error);
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

  test("app will timeout if surpass timeout time", async () => {
    const request = makeHttpRequest(BASE_URL + TEST_TIME_OUT_ROUTE, {
      method: "GET",
    });
    const promise = routeHandler(request);
    await sleep(1100);
    const respone = await Promise.resolve(promise);
    expect(request.err).toBeInstanceOf(TimeoutError);
    expect(respone.status).toBe(408);
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
      timeout: 1000,
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
      await sleep(1000);
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
      await sleep(2000);
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
