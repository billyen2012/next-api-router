import { getBaseUrl } from "../util/getBaseUrl";

jest.mock("next/headers", () => ({
  headers: () =>
    new Headers({
      "x-forwarded-proto": "http",
      "x-forwarded-host": "localhost:3000",
    }),
}));

describe("test getBaserUrl", () => {
  test("should return base url by combining x-forwarded-proto and x-forwarded-host in the header", () => {
    const url = getBaseUrl();
    expect(url).toBe("http://localhost:3000");
  });
});
