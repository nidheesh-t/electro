



const loadHomepage = async (req, res)=>{
    try {
        return res.render("home")
        
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("Internal server error")
    }
}


const pageNotFound = async (req, res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        console.log("Page not found error");
        res.status(500).send("Internal server error")
    }
}


module.exports = {
    loadHomepage,
    pageNotFound
}