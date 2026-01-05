import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { app } from "./app.js";

dotenv.config({
    path: './.env'
});

connectDB()
    .then(() => {
        // app.listen(process.env.PORT || 8000, () => {
        //     console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
        // });
        const port = process.env.PORT || 8000;
       app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });