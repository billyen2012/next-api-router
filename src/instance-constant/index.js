import { randomId } from "../util/randomId";

const INSTANCE_ID = randomId();
/**
 * a leading / is added to each reserved route key to completely removed the possibility of route collision
 * because the incoming route part (after spliited with "/") will never contain a leading /
 */
const PROTECT_PREFIX = "/";
const QUERY_PARAM_KEY = `${PROTECT_PREFIX}qp_${INSTANCE_ID}`;
const BASE_ROUTE_KEY = `${PROTECT_PREFIX}base_${INSTANCE_ID}`;
const PARENT_ROUTER_KEY = `${PROTECT_PREFIX}parent_router_${INSTANCE_ID}`;
const CURRENT_ROUTER_KEY = `${PROTECT_PREFIX}current_router_${INSTANCE_ID}`;
const CHILD_ROUTERS_KEY = `${PROTECT_PREFIX}child_routers_${INSTANCE_ID}`;
const METHODS_KEY = `${PROTECT_PREFIX}methods_${INSTANCE_ID}`;
const ROUTER_ID_KEY = `${PROTECT_PREFIX}router_id_${INSTANCE_ID}`;
const WILDCARD_KEY = `${PROTECT_PREFIX}*_${INSTANCE_ID}`;
const WILDCARD_PREFIX_KEY = `${PROTECT_PREFIX}wildcard_prefix_${INSTANCE_ID}`;
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
  PROTECT_PREFIX,
  WILDCARD_PREFIX_KEY,
  INSTANCE_ID,
  QUERY_PARAM_KEY,
  BASE_ROUTE_KEY,
  PARENT_ROUTER_KEY,
  CURRENT_ROUTER_KEY,
  CHILD_ROUTERS_KEY,
  METHODS_KEY,
  ROUTER_ID_KEY,
  WILDCARD_KEY,
  SUPPORTED_HTTP_METHODS,
};
