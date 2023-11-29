/**
 * `next.js` have a few custom props in the `Response` object. This will make `Response` object
 * that is compatible for testing the `Response` object from the `next.js`.
 */
export const makeHttpRequest = (url, { method, body, headers = {} } = {}) => {
  const searchUrl = new URL(url);
  const request = new Request(url, {
    method,
    body,
    headers,
  });

  request.nextUrl = {
    searchParams: searchUrl.searchParams,
  };

  return request;
};
