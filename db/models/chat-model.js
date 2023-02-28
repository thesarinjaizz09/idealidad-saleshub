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
const d = new Date()


const chatsSchema = new Schema({
    type: {
        type: String,
        default: ""
    },
    mimetype: {
        type: String,
        default: ""
    },
    data: {
        type: String,
        default: ""
    },
    caption: {
        type: String,
        default: ""
    },
    from: {
        type: String,
        default: "client"
    },
    timestamp: {
        type: String,
        default: d.toString()
    }
})

const ChatSchema = new Schema({
    _chatName: {
        type: String,
        default: ""
    },
    _chatNumber: {
        type: String,
        deafult: ""
    },
    _chatFunnel: {
        type: String,
        default: "None"
    },
    _chatParent: {
        type: String,
        default: ""
    },
    _chatParentTeam: {
        type: String,
        default: ""
    },
    _chatValue: {
        type: Number,
        default: 0
    },
    _chatDirectory: {
        type: String,
        default: "None"
    },
    _chatEmail: {
        type: String,
        default: "Not specified"
    },
    _chatCampaign: {
        type: String,
        default: "Not specified"
    },
    _chatBusiness: {
        type: String,
        default: "Not specified"
    },
    _chatObjective: {
        type: String,
        default: "Not specified"
    },
    _chatPlatform: {
        type: String,
        default: "Normal"
    },
    _chatLabel: {
        type: String,
        default: "Neutral"
    },
    _chatHandlerName: {
        type: String,
        default: "You"
    },
    _chatHandlerId: {
        type: String,
        default: ""
    },
    _chatMessages: [chatsSchema],
    _chatDate: {
        type: Date,
        default: Date.now()
    },
}, {
    timeStamps: true
})

// Converting the UserSchema to a model

const Chats = mongoose.model('chats', ChatSchema); //Compliling the UserSchema to commerceFox registered users model


// Exporting the model to be used by other modules

module.exports = Chats; //exporting the model Users

// Instant Chat MongoDB model codebase completed