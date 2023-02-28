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

const funnelsSchema = new Schema({
    funnelName: {
        type: String,
        default: ""
    },
    funnelId: {
        type: String,
        default: ""
    }
})

const directorySchema = new Schema({
    directoryName: {
        type: String,
        default: ""
    },
    directoryId: {
        type: String,
        default: ""
    }
})

const ownChatsSchema = new Schema({
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

const assignedChatsSchema = new Schema({
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

const templateSchema = new Schema({
    type: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        default: ""
    },
    data: {
        type: String,
        reuquired: true
    },
    from: {
        type: String,
        default: ""
    },
    timestamp: {
        type: String,
        default: d.toString()
    }
})

const UserSchema = new Schema({
    _name: {
        type: String,
        required: true,
        min: 3
    },
    _email: {
        type: String,
        required: true,
        unique: true
    },
    _password: {
        type: String,
        required: true,
        min: 8
    },
    _chatBot: {
        type: Boolean,
        default: false
    },
    _chatBotTemplate: [templateSchema],
    _verified: {
        type: Boolean,
        default: false
    },
    _teamId: {
        type: String,
        default: "",
    },
    _teamRole: {
        type: String,
        default: "neutral"
    },
    _gsIntegration: {
        type: Boolean,
        default: false
    },
    _gsSessionData: {
        type: String,
        default: ""
    },
    _wpIntegration: {
        type: Boolean,
        default: false
    },
    _wpSessionData: {
        type: String,
        default: ""
    },
    _wpBackupIntegration: {
        type: Boolean,
        default: false
    },
    _wpBackupSessionData: {
        type: String,
        default: ""
    },
    _wpInstanceActive: {
        type: Boolean,
        default: false
    },
    _fbIntegration: {
        type: Boolean,
        default: false
    },
    _fbSessionData: {
        type: String,
        default: ""
    },
    _igIntegration: {
        type: Boolean,
        default: false
    },
    _igSessionData: {
        type: String,
        default: ""
    },
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
    _funnels: [funnelsSchema],
    _directories: [directorySchema],
    _wpChats: [ownChatsSchema],
    _assignedChats: [assignedChatsSchema],
}, {
    timestamps: true
})

// Converting the UserSchema to a model

const Users = mongoose.model('users', UserSchema); //Compliling the UserSchema to commerceFox registered users model


// Exporting the model to be used by other modules

module.exports = Users; //exporting the model Users

// Instant Chat MongoDB model codebase completed