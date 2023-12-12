import { headers } from "next/headers";

export const getBaseUrl = () => {
  const _headers = headers();
  const proto = _headers.get("x-forwarded-proto");
  const host = _headers.get("x-forwarded-host");
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return null;
};
