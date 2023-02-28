const chats = require("../db/models/chat-model")

const addChat = async ({ chatName, chatNumber, chat, chatParent }) => {
    try {
        let newChat = await chats.create({
            _chatName: chatName === undefined ? "New Lead" : chatName,
            _chatNumber: chatNumber,
            _chatParent: chatParent,
            _chatValue: 0,
            _chatMessages: [{
                type: chat.type,
                mimetype: chat.mimetype === undefined ? "" : chat.mimetype,
                data: chat.data,
                caption: chat.caption === undefined ? "" : chat.caption
            }]
        })

        if (newChat) {
            return {
                newChat
            }
        } else {
            return {
                chatCreateErr: 'Chat creation thread failed...'
            }
        }

    } catch (err) {
        console.log(err)
        return {
            chatCreateErr: 'Chat creation thread denied...'
        }
    }
}

const createChat = async ({ chatName, chatNumber, chatParent, chatEmail, chatObjective, chatCampaign, chatBusiness, chatPlatform}) => {
    try {
        let newChat = await chats.create({
            _chatName: chatName === undefined ? "Unknown Customer" : chatName,
            _chatNumber: chatNumber,
            _chatParent: chatParent,
            _chatValue: 0,
            _chatEmail: chatName === undefined ? "Not Specified" : chatEmail,
            _chatObjective: chatObjective === undefined ? "Not Specified" : chatObjective,
            _chatObject: chatObjective === undefined ? "Not Specified" : chatObjective,
            _chatCampaign: chatCampaign === undefined ? "Not Specified" : chatCampaign,
            _chatBusiness: chatBusiness === undefined ? "Not Specified" : chatBusiness,
            _chatPlatform: chatPlatform === undefined ? "Not Specified" : chatPlatform,
        })

        if (newChat) {
            return {
                newChat
            }
        } else {
            return {
                chatCreateErr: 'Chat creation thread failed...'
            }
        }

    } catch (err) {
        return {
            chatCreateErr: 'Chat creation thread denied...'
        }
    }
}

const getChat = async ({ chatId }) => {
    try {
        let existingChat = await chats.findById(chatId)

        if (existingChat) {
            return {
                existingChat
            }
        } else {
            return {
                chatGettingErr: 'Chat fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            chatGettingErr: 'Chat fetching thread denied...'
        }
    }
}

const findChat = async ({ query }) => {
    try {
        let chat = await chats.find(query)

        if (chat) {
            return {
                chat
            }
        } else {
            return {
                chatNotFound: 'Chat fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            chatFindingErr: 'Chat fetching thread denied...'
        }
    }
}

const deleteChat = async ({ chatId }) => {
    try {
        let deletedChat = await chats.findByIdAndDelete(chatId)

        if (deletedChat) {
            return {
                deletedChat
            }
        } else {
            return {
                chatNotDeleted: 'Chat deleting thread failed...'
            }
        }
    } catch (errr) {
        return {
            chatDeletingErr: 'Chat deleting thread denied...'
        }
    }
}

const updateChat = async ({ chatId, chatUpdates }) => {
    try {
        // console.log({chatUpdates})
        let chat = await chats.findByIdAndUpdate(chatId, chatUpdates)
        let updatedChat = await chats.findById(chat._id)
        // console.log({updatedChat})

        if (updatedChat) {
            return {
                updatedChat
            }
        } else {
            return {
                chatUpdationErr: 'Chat updation thread failed...'
            }
        }
    } catch (errr) {
        return {
            chatUpdationErr: 'Team updation thread denied...'
        }
    }
}

module.exports = {
    addChat,
    getChat,
    updateChat,
    findChat,
    createChat,
    deleteChat
}