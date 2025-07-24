const User =  require("../../models/userSchema")



const loadHomepage = async (req, res) => {
    try {
        return res.render("home")

    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("Internal server error")
    }
}


const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        console.log("Page not found error");
        res.status(500).send("Internal server error")
    }
}


const loadSignup = async (req, res) => {
    try {
        return res.render("signup")

    } catch (error) {
        console.log("Signup page not found");
        res.status(500).send("Internal server error")
    }
}

const signup = async (req, res) => {
    const {firstName, lastName, phone, email, password} = req.body;
    try {

        const newUser = new User({firstName, lastName, phone, email, password})
        await newUser.save();
        return res.redirect("/signup")
        
    } catch (error) {
        console.error("Error for save user",error);
        res.status(500).send("Internal server error")
    }

}


const loadLogin = async (req, res) => {
    try {
        return res.render("login")

    } catch (error) {
        console.log("Signup page not found");
        res.status(500).send("Internal server error")
    }
}


module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadLogin,
    signup
}