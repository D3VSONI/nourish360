import { Router, type IRouter } from "express";
import healthRouter from "./health";

import { router as nourish } from "./nourish";
import { dispatch } from "./dispatch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nourish, dispatch);

export default router;
