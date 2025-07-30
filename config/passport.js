const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();



passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: false // Explicitly set this if you're not using the req parameter
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });
            if (user) {
                if (user.isBlock) {
                    return done(null, false, { message: "User is blocked by admin" });
                }
                return done(null, user);
            }

            const email = profile.emails[0].value;
            user = await User.findOne({ email: email });

            if (user) {
                if (user.isBlock) {
                    return done(null, false, { message: "User is blocked by admin" });
                }
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }

            user = new User({
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                email: profile.emails[0].value,
                googleId: profile.id
            });
            await user.save();
            return done(null, user);

        } catch (error) {
            console.error("Google OAuth Error:", error);
            return done(error, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        console.error("Deserialize User Error:", error);
        done(error, null);
    }
})


module.exports = passport;