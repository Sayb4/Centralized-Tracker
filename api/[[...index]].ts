import { createStartHandler } from "@tanstack/start-server-core/vercel";
import { router } from "../../src/router";

export default createStartHandler({
  router,
});
