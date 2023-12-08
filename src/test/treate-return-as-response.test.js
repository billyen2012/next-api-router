import NextApiRouter from "../../index";
import fs from "fs";
import { makeHttpRequest } from "../util/makeHttpRequest";
import {
  InvalidReturnDataTypeError,
  MalformedJsonError,
  MethodNotAllowedError,
  NotFoundError,
  TimeoutError,
} from "../errors";
import Deffer from "../util/Deffer";
const app = NextApiRouter({ timeout: 5000, treatReturnAsResponse: true });
const BASE_URL = "http://localhost:3000/api";
app.get("/string", () => {
  return "test";
});
app.get("/number", () => {
  return 123;
});
app.get("/buffer", () => {
  return Buffer.from("test");
});
app.get("/object", () => {
  return { test: "test" };
});
app.get("/file", () => {
  const file = fs.createReadStream(process.cwd() + "/src/test-use/text.txt");
  return file;
});

app.get("/timeout", () => {});

app.get("/wrong-type", () => {
  return () => {};
});

app.get(
  "/cbs",
  () => {
    return 1;
  },
  () => {
    return 2;
  }
);

app.use((req, res) => {
  return { test: 1 };
});

app.get("/middleware-return", () => {
  return { test: 2 };
});

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

  res.status(500).send(err.message);
});

beforeEach(() => {
  jest.useRealTimers();
});

const handler = app.handler();

describe("test treat-return-as-esponse option behaviors", () => {
  test("can send a string", async () => {
    const request = makeHttpRequest(BASE_URL + "/string", {
      method: "GET",
    });
    const response = await handler(request);
    expect(await response.text()).toBe("test");
  });

  test("can send a number", async () => {
    const request = makeHttpRequest(BASE_URL + "/number", {
      method: "GET",
    });
    const response = await handler(request);
    expect(await response.text()).toBe("123");
  });

  test("can send a buffer", async () => {
    const request = makeHttpRequest(BASE_URL + "/buffer", {
      method: "GET",
    });
    const response = await handler(request);
    expect(await response.text()).toBe("test");
  });

  test("can send a file", async () => {
    const request = makeHttpRequest(BASE_URL + "/file", {
      method: "GET",
    });
    const response = await handler(request);
    expect(await response.text()).toBe("test use");
  });

  test("can send a json", async () => {
    const request = makeHttpRequest(BASE_URL + "/object", {
      method: "GET",
    });
    const response = await handler(request);
    const data = await response.json();
    expect(data.test).toBe("test");
  });

  test("will still timeout", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const request = makeHttpRequest(BASE_URL + "/timeout", {
      method: "GET",
    });

    const deffer = new Deffer();
    let response = null;
    handler(request).then((_response) => {
      response = _response;
      deffer.resolve();
    });
    jest.advanceTimersByTime(100000);
    await deffer.promise;
    expect(response.status).toBe(408);
  });

  test("will throw error if return wrong data type", async () => {
    const request = makeHttpRequest(BASE_URL + "/wrong-type", {
      method: "GET",
    });
    await handler(request);
    expect(request.err).toBeInstanceOf(InvalidReturnDataTypeError);
  });

  test("middleware return will also work", async () => {
    const request = makeHttpRequest(BASE_URL + "/middleware-return", {
      method: "GET",
    });
    const response = await handler(request);
    const data = await response.json();
    expect(data.test).toBe(1);
  });

  test("route level cbs chain will also work", async () => {
    const request = makeHttpRequest(BASE_URL + "/cbs", {
      method: "GET",
    });
    const response = await handler(request);
    expect(await response.text()).toBe("1");
  });
});
