export default class Static {
  constructor({ folderPath = "", headers = {} } = {}) {
    this.folderPath = folderPath;
    this.headers = headers;
  }
}
