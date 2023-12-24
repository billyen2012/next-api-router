import { deflate, gzip } from "zlib";

/**
 *
 * @param {string | ArrayBuffer | ArrayBufferView} input
 * @returns {Promise<Buffer>}
 */
export const gzipAsync = (input) => {
  return new Promise((resolve, reject) => {
    gzip(input, (error, resultBuffer) => {
      if (error) {
        return reject(error);
      }
      resolve(resultBuffer);
    });
  });
};
