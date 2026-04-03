import { Router } from "express";
import {login, registerUser} from "../controllers/auth.controller.js"
import { validate } from "../middlewares/validator.middleware.js";
import {userRegisterValidator} from "../validators/index.js"
import {userLoginValidator} from "../validators/index.js"
const router = Router();

router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, login);


export default router;