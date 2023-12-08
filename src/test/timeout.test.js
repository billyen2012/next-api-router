import NextApiRouter, { TimeoutError } from "../../index";
import { makeHttpRequest } from "../util/makeHttpRequest";
import { sleep } from "../util/sleep";
import Deferred from "../util/Deffer";

const app = NextApiRouter({ timeout: false });
const app2 = NextApiRouter();

jest.useFakeTimers({ advanceTimers: true });

const deffered = new Deferred();

const BASE_URL = "http://localhost:3000/api";

app.get("/test", async (req, res, next) => {
  await deffered.promise;
  res.send("OK");
});

app2.get("/timeout", async (req, res, next) => {});
app2.errorHandler((err, req, res) => {
  req.err = err;
  res.status(408).send();
});

describe("test router timeout", () => {
  /**
   * if timeout=false, meaning it will never timeout and the response will be stalled indefinitely until
   * a response is sent. To test this behavior, a deffered promise is created and added to the callback of
   * the route. A jest fake timer is used and advanced significant amount of time. If
   */
  test("if timeout = false, then it will never timeout", async () => {
    const request = makeHttpRequest(BASE_URL + "/test", {
      method: "GET",
    });

    let response = null;
    app
      .handler()(request)
      .then((_response) => {
        response = _response;
      });

    jest.advanceTimersByTime(1000 * 100000);
    await sleep(100);
    expect(response).toBe(null);
    deffered.resolve();
    await sleep(100);
    expect(response.status).not.toBe(408);
  });

  test("passed timeout time without sending any response will result timeout", async () => {
    const request = makeHttpRequest(BASE_URL + "/timeout", {
      method: "GET",
    });

    let response = null;
    app2
      .handler()(request)
      .then((_response) => {
        response = _response;
      });

    jest.advanceTimersByTime(1000 * 100000);
    await sleep(100);
    expect(response.status).toBe(408);
    expect(request.err).toBeInstanceOf(TimeoutError);
  });
});
