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

const membersSchema = new Schema({
    name: {
        type: String,
        default: ""
    },
    id: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        default: ""
    }
})

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

const TeamSchema = new Schema({
    _teamName: {
        type: String,
        required: true,
        min: 3
    },
    _teamAdmin: {
        type: String,
        required: true,
    },
    _teamPassword: {
        type: String,
        required: true
    },
    _teamActiveMembers: [membersSchema],
    _teamWpIntegration: {
        type: Boolean,
        deafault: false
    },
    _teamWpInstanceActive: {
        type: Boolean,
        deafault: false
    },
    _teamWpSessionData: {
        type: String,
        default: ""
    },
    _teamAdminAuthToken: {
        type: String,
        default: ""
    },
    _teamMembers: [membersSchema],
    _teamPendingMembers: [membersSchema],
    _teamChats: [chatsSchema],
    _totalMessagesSent: {
        type: Number,
        default: 0
    },
    _totalLeadsGained: {
        type: Number,
        default: 0
    },
    _totalMessagesSentThisWeek: {
        type: String,
        default: JSON.stringify([
            {
                day: 'sun',
                chats: 0
            },
            {
                day: 'mon',
                chats: 0
            },
            {
                day: 'tue',
                chats: 0
            },
            {
                day: 'wed',
                chats: 0
            },
            {
                day: 'thu',
                chats: 0
            },
            {
                day: 'fri',
                chats: 0
            },
            {
                day: 'sat',
                chats: 0
            },
            {
                total: 0
            }
        ])
    },
    _totalLeadsGainedThisWeek: {
        type: String,
        default: JSON.stringify([
            {
                day: 'sun',
                leads: 0
            },
            {
                day: 'mon',
                leads: 0
            },
            {
                day: 'tue',
                leads: 0
            },
            {
                day: 'wed',
                leads: 0
            },
            {
                day: 'thu',
                leads: 0
            },
            {
                day: 'fri',
                leads: 0
            },
            {
                day: 'sat',
                leads: 0
            },
            {
                total: 0
            }
        ])
    },
})

// Converting the UserSchema to a model

const teams = mongoose.model('teams', TeamSchema); //Compliling the UserSchema to commerceFox registered users model

// Exporting the model to be used by other modules

module.exports = teams; //exporting the model Users

// Instant Chat MongoDB model codebase completed