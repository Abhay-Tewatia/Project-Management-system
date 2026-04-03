import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser";
const app = express();

// basic configuration for express app
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true,limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser());


// cors configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
    credentials: true,
    method:["GET", "POST", "PUT","PATCH","DELETE", "OPTIONS"] ,
    allowedHeaders: ["Content-Type", "Authorization"]
}))

// import the routes
import healthCheckRoute from "./routes/healthcheck.routes.js"

// register routes
import authRouter from "./routes/auth.routes.js"


// use the routes
app.use("/api/v1/healthcheck", healthCheckRoute)
app.use("/api/v1/auth", authRouter)


app.get("/" , (req, res) => {
    res.send("Hello World from app.js")
})

export default app;