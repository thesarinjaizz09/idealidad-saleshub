// title: CommerceFox database server
// description: This is the database server for the CommerceFox website that helps in connecting to the database of CommerceFox
// version: 1.0.0
// date created: Feb 11, 2022
// author: Sarin Jaiswal


// Importing all the necessary modules for the db server

const mongoose = require('mongoose'); // Importing mongoose framework for connecting to the Mongo Database
const dotenv = require('dotenv'); // Importing the dotenv files to use the enviroment variables
const generateConnectionUrl = require("../src/connection-url-generator")
dotenv.config()


// Specifying the parameters fo the db server

const mongoURI = process.env.SALESHUB_DATABASE_URL; // Specifying the db url for connecting the server to it
const connection_string = generateConnectionUrl(58)

// Declaring a function whch will connect the db server to the respective MongoDB databse when called


const connectToMongoDB = async () => {
    mongoose
        .connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => {
            console.log("X--- Saleshub socket database connected succesfully ---X")
            console.log(`X--- Saleshub socket database connection url: ${connection_string} ---X`)
        })
        .catch(err => console.log(err));
}


// Exporting the function to be used by other modules

module.exports = connectToMongoDB; // exporting the connectToMongoDB function

// Db server codebase completed