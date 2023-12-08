import { TimeoutError } from "../errors";

/**
 * @param {number | ()=>number} routerTimeoutValue
 * @param {import(".").NextApiRouterRequest} request
 * @returns {{
 * timeoutInstance?: NodeJS.Timeout;
 * timeoutPromise?:Promise<TimeoutError>;
 * timeoutResolve?:(value:any)=> void;
 * handleTimeout?:()=>void;
 * }}
 */
export const makeTimeoutInstance = (routerTimeoutValue, request) => {
  if (routerTimeoutValue == false) {
    return {};
  }

  let timeoutResolve = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutResolve = resolve;
  }).then(() => new TimeoutError("request timeout"));
  /** handle time out  */
  const handleTimeout = () => {
    timeoutResolve();
  };

  const timeoutInstance =
    typeof routerTimeoutValue === "number"
      ? setTimeout(handleTimeout, routerTimeoutValue)
      : typeof routerTimeoutValue === "function"
      ? setTimeout(handleTimeout, routerTimeoutValue(request))
      : undefined;

  return { timeoutInstance, timeoutResolve, timeoutPromise, handleTimeout };
};
