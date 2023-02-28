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

const chatsSchema = new Schema({
    chatName: {
        type: String,
        default: ""
    },
    chatId: {
        type: String,
        default: ""
    },
    chatNumber: {
        type: String,
        default: ""
    },
    lastMessage: {
        type: String,
        default: ""
    },
    from: {
        type: String,
        default: "client"
    },
    chatLabel: {
        type: String,
        default: 'Neutral'
    }
})

const stagesSchema = new Schema({
    _stageName: {
        type: String,
        default: 'Stage'
    },
    _stageChats: [chatsSchema]
})

const FunnelsSchema = new Schema({
    _funnelName: {
        type: String,
        required: true
    },
    _funnelParent: {
        type: String,
        required: true
    },
    _funnelChats: [chatsSchema],
    _funnelStages: [stagesSchema]
})

// Converting the FunnelSchema to a model

const Funnels = mongoose.model('funnels', FunnelsSchema); //Compliling the UserSchema to commerceFox registered users model


// Exporting the model to be used by other modules

module.exports = Funnels; //exporting the model Users

// Instant Chat MongoDB model codebase completed