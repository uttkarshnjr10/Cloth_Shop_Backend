import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// import routes
import authRouter from "./routes/auth.routes.js";
import imageRouter from "./routes/image.routes.js";
import productRouter from "./routes/product.routes.js";
import transactionRouter from "./routes/transaction.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

const app = express();

// Security Middleware
app.use(helmet());

// 
const allowedOrigins = [
  "http://localhost:5173",                     // Local Development
  "http://localhost:8080",                     // Local Preview
  "https://anupriya-fashion-hub.vercel.app",   // Production Frontend (Vercel)
  process.env.CORS_ORIGIN                      // Fallback from .env
].filter(Boolean); // Removes undefined/null values

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin); // Debugging log
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// --------------------------------

// Middleware
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// ROUTES
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/images", imageRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
  });
});

export { app };
// import dotenv from "dotenv";
// dotenv.config();

// import express from "express";
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import helmet from "helmet";

// // import routes
// import authRouter from "./routes/auth.routes.js";
// import imageRouter from "./routes/image.routes.js";
// import productRouter from "./routes/product.routes.js";
// import transactionRouter from "./routes/transaction.routes.js";
// import dashboardRouter from "./routes/dashboard.routes.js";

// const app = express();

// // Security Middleware
// app.use(helmet());

// // CORS Configuration
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       if (origin === process.env.CORS_ORIGIN) {
//         return callback(null, true);
//       }
//       callback(new Error("Not allowed by CORS"));
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// // app.options("*", cors());

// // Middleware
// app.use(express.json({ limit: "16kb" }));
// app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// app.use(express.static("public"));
// app.use(cookieParser());

// // ROUTES
// app.use("/api/v1/auth", authRouter);
// app.use("/api/v1/images", imageRouter);
// app.use("/api/v1/products", productRouter);
// app.use("/api/v1/transactions", transactionRouter);
// app.use("/api/v1/dashboard", dashboardRouter);

// app.use((err, req, res, next) => {
//   const statusCode = err.statusCode || 500;
//   const message = err.message || "Internal Server Error";

//   return res.status(statusCode).json({
//     success: false,
//     statusCode,
//     message,
//     errors: err.errors || [],
//   });
// });

// export { app };
