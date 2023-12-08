export class NextApiRouteError extends Error {
  setMessage(value) {
    this.message = value;
    return this;
  }
  setName(value) {
    this.name = value;
    return this;
  }
}

export class NotFoundError extends NextApiRouteError {
  name = "NotFoundError";
}
export class MalformedJsonError extends NextApiRouteError {
  name = "MalformedJsonError";
}
export class NoResponseFromHandlerError extends NextApiRouteError {
  name = "NoResponseFromHandlerError";
}
export class TimeoutError extends NextApiRouteError {
  name = "TimeoutError";
}

export class MethodNotAllowedError extends NextApiRouteError {
  name = "MethodNotAllowedError";
}

export class InvalidReturnDataTypeError extends NextApiRouteError {
  name = "InvalidReturnDataTypeError";
}
