/**
 * return 10 characters random string
 */
export const randomId = () => {
  return Math.random().toString(32).slice(2);
};
