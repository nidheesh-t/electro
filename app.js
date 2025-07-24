const express = require("express");
const app = express();
const path = require("path")
const env = require("dotenv").config()
const connectDB = require("./config/db");
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")


connectDB();



app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);

app.use(express.static(path.join(__dirname, "public")));


app.use("/", userRouter);
app.use("/admin", adminRouter);



const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
})


module.exports = app


