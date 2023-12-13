import NextApiRouter from "../../index";
import { makeHttpRequest } from "../util/makeHttpRequest";

jest.mock("undici", () => ({
  request: async (props) => {
    const { Readable } = await import("stream");
    return {
      statusCode: 200,
      headers: {
        foo: "bar",
      },
      body: Readable.from(Buffer.from(JSON.stringify({ test: "test" }))),
    };
  },
}));

const app = NextApiRouter();

app.post("/test/test", (req, res) => {
  res.send("");
});

app.post("/test", async (req, res) => {
  await res.rewrite("/test/test");
});

test("rewrite will forward request to destination url", async () => {
  const request = makeHttpRequest("http://localhost:3000/test?a=b", {
    method: "POST",
    body: JSON.stringify({ test: "test" }),
  });
  const response = await app.handler()(request);
  // check status code
  expect(response.status).toBe(200);
  // check query is passed as it is
  expect(request.query.a).toBe("b");
  // check returned data
  const data = await response.json();
  expect(data.test).toBe("test");
  // check returned headers
  expect(response.headers.get("foo")).toBe("bar");
});
