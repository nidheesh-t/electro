const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const nocache = require("nocache");
const connectDB = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const passport = require("./config/passport");
const User = require("./models/userSchema");

// if (!process.env.SESSION_SECRET || !process.env.MONGO_URI) {
//     throw new Error("Missing required environment variables");
// }

connectDB();

app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
    res.locals.user = null;
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user);
            if (user && !user.isBlock) {
                res.locals.user = user;
            } else {
                req.session.destroy();
            }
        } catch (error) {
            console.error("Session validation error:", error);
            req.session.destroy();
        }
    }
    /*else if (req.isAuthenticated()) {
        res.locals.user = req.user;
    }*/
    next();
});

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);
app.use(express.static(path.join(__dirname, "public")));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(500).render("error", { message: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
});

module.exports = app;