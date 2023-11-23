/**
 * @param {number} ms
 */
export const sleep = (ms = 20) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
