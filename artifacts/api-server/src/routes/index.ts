import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hyperframesRouter from "./hyperframes";
import butterbaseRouter from "./butterbase";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hyperframesRouter);
router.use(butterbaseRouter);

export default router;
