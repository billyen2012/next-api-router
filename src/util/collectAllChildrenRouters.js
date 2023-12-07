import { CHILD_ROUTERS } from "../instance-constant";

/**
 * bfs to traverse through all childs routers
 * @param {RouterInstance} currentRouter
 * @returns
 */
export const collectAllChildRouters = (currentRouter) => {
  const queue = [...currentRouter.routable[CHILD_ROUTERS]];

  const collection = [];
  while (queue.length > 0) {
    const childRouter = queue.pop();
    collection.push(childRouter);
    queue.push(...childRouter.routable[CHILD_ROUTERS]);
  }

  return collection;
};
