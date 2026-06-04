import { createStartHandler } from "@tanstack/start-server-core/vercel";
import { getRouter } from "../../src/router";

export default createStartHandler({
  router: getRouter(),
});

