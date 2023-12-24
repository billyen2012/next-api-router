import NextApiRouter, { compress } from "../../index";
import { makeHttpRequest } from "../util/makeHttpRequest";
import { unzipSync } from "zlib";
import fs from "fs";
const app = NextApiRouter();

// make size small for test purpose
app.use(compress({ size: 10 }));

const answer =
  "11111111111111111111111111111111111111111111111111111111111111111";

app.get("/string", (req, res) => {
  res.send(answer);
});

app.get("/json", (req, res) => {
  res.json({ test: answer });
});

app.get("/file", (req, res) => {
  res.sendFile(process.cwd() + "/src/test-use/compress.txt");
});

app.get("/stream", async (req, res) => {
  const stream = fs.createReadStream(
    process.cwd() + "/src/test-use/compress.txt"
  );
  await res.pipe(stream);
});

app.get("/buffer", async (req, res) => {
  res.send(Buffer.from(answer));
});

app.get("/will-not-compress", async (req, res) => {
  res.send("123456789");
});

const handler = app.handler();

describe("compress middleware", () => {
  test("will not compress if there is no accept-encoding header", async () => {
    const request = makeHttpRequest("http://localhost:3000/string");
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe(null);
  });
  test("will not compress if there is no gzip for accept-encoding header", async () => {
    const request = makeHttpRequest("http://localhost:3000/string", {
      headers: {
        "accept-encoding": "deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe(null);
  });
  test("will encoding if there is gzip for accept-encoding header", async () => {
    const request = makeHttpRequest("http://localhost:3000/string", {
      headers: {
        "accept-encoding": "gzip",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
  });
  test("will compress string", async () => {
    const request = makeHttpRequest("http://localhost:3000/string", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const unzip = unzipSync(buffer).toString("utf-8");
    expect(unzip.length).toBeGreaterThan(blob.size);
    expect(unzip).toBe(answer);
  });
  test("will compress json", async () => {
    const request = makeHttpRequest("http://localhost:3000/json", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const unzip = unzipSync(buffer).toString("utf-8");
    expect(unzip.length).toBeGreaterThan(blob.size);
    const json = JSON.parse(unzip);
    expect(json.test).toBe(answer);
  });
  test("will compress file", async () => {
    const request = makeHttpRequest("http://localhost:3000/file", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const unzip = unzipSync(buffer).toString("utf-8");
    expect(unzip.length).toBeGreaterThan(blob.size);
    expect(unzip).toBe(
      "111111111111111111111111111111111111111111111111111111"
    );
  });
  test("will compress stream", async () => {
    const request = makeHttpRequest("http://localhost:3000/stream", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const unzip = unzipSync(buffer).toString("utf-8");
    expect(unzip.length).toBeGreaterThan(blob.size);
    expect(unzip).toBe(
      "111111111111111111111111111111111111111111111111111111"
    );
  });
  test("will compress buffer", async () => {
    const request = makeHttpRequest("http://localhost:3000/buffer", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const unzip = unzipSync(buffer).toString("utf-8");
    expect(unzip.length).toBeGreaterThan(blob.size);
    expect(unzip).toBe(answer);
  });
  test("will not compress is data size is less than compress size config", async () => {
    const request = makeHttpRequest("http://localhost:3000/will-not-compress", {
      headers: {
        "accept-encoding": "gzip, deflate, br",
      },
    });
    const response = await handler(request);
    expect(response.headers.get("content-encoding")).toBe(null);
    expect(await response.text()).toBe("123456789");
  });
});
