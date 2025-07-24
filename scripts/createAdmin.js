console.log(__dirname); // Logs the current directory

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const adminSchema = require("../models/adminSchema"); 

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect("mongodb://localhost:27017/electro", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const email = "admin@123.com";
        const password = "admin@123.com";

        // Check if the admin already exists
        const existingAdmin = await adminSchema.findOne({ email });
        if (existingAdmin) {
            console.log("Admin with this email already exists.");
            return;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new admin
        const newAdmin = new adminSchema({
            email,
            password: hashedPassword,
        });

        await newAdmin.save();
        console.log("Admin added successfully!");
    } catch (error) {
        console.error("Error adding admin:", error);
    } finally {
        mongoose.connection.close();
    }
};

createAdmin();