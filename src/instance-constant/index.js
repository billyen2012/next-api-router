import { randomId } from "../util/randomId";

const INSTANCE_ID = randomId();
const QUERY_PARAM_KEY = `qp_${INSTANCE_ID}`;
const BASE_ROUTE_KEY = `base_${INSTANCE_ID}`;
const PARENT_ROUTER = `parent_router_${INSTANCE_ID}`;
const CURRENT_ROUTER = `current_router_${INSTANCE_ID}`;
const CHILD_ROUTERS = `child_routers_${INSTANCE_ID}`;
const METHODS_KEY = `methods_${INSTANCE_ID}`;
const ROUTER_ID_KEY = `router_id_${INSTANCE_ID}`;
const TIMEOUT_VALUE_KEY = `timeout_${INSTANCE_ID}`;
const WILDCARD_KEY = "*";
const SUPPORTED_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
];

export {
  INSTANCE_ID,
  QUERY_PARAM_KEY,
  BASE_ROUTE_KEY,
  PARENT_ROUTER,
  CURRENT_ROUTER,
  CHILD_ROUTERS,
  METHODS_KEY,
  ROUTER_ID_KEY,
  TIMEOUT_VALUE_KEY,
  WILDCARD_KEY,
  SUPPORTED_HTTP_METHODS,
};
