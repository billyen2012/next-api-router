import fs from "fs";

/**
 *
 * @param {string} path
 * @returns {Promise<fs.Stats | boolean>}
 */
export const fileMetaAsync = (path) => {
  return new Promise((resolve, reject) => {
    try {
      fs.stat(path, (err, stats) => {
        if (err) {
          // meaning file not exist
          if (err.code === "ENOENT") {
            return resolve(false);
          }
          return reject(err);
        }

        resolve(stats.isFile() ? stats : false);
      });
    } catch (err) {
      reject(err);
    }
  });
};
