// title: CommerceFox MongoDB model
// description: This is the module of the CommerceFox MongoDB
// version: 1.0.0
// date created: Feb 11, 2022
// author: Sarin Jaiswal


//Importing all the required packages

const mongoose = require('mongoose'); // Importing mongoose for connecting to mongoDB
const { Schema } = mongoose; // Importing the schema feature of the mongoose to declare the scheme of the user data storage
const dotenv = require('dotenv');
dotenv.config()

const smallChats = new Schema({
    field: {
        type: String,
        default: "None"
    }
})

const chatsSchema = new Schema({
    data: [smallChats]
})

const DirectorySchema = new Schema({
    _directoryName: {
        type: String,
        required: true
    },
    _directoryParent: {
        type: String,
        required: true
    },
    _facebookIntegration: {
        type: Boolean,
        defalut: false
    },
    _allIntegration: {
        type: Boolean,
        defalut: false
    },
    _directoryChats: [chatsSchema],
})

// Converting the FunnelSchema to a model

const Directories = mongoose.model('directories', DirectorySchema); //Compliling the UserSchema to commerceFox registered users model


// Exporting the model to be used by other modules

module.exports = Directories; //exporting the model Users

// Instant Chat MongoDB model codebase completed