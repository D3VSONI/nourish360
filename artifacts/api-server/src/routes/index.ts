import { Router, type IRouter } from "express";
import healthRouter from "./health";

import { router as nourish } from "./nourish";
import { dispatch } from "./dispatch";
import { escalationTicketRouter } from "./escalation-tickets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nourish, dispatch, escalationTicketRouter);

export default router;
