const directories = require("../db/models/directory-model")

const addDirectory = async ({ directoryName, directoryParent, userChats, facebookIntegration, allIntegration }) => {
    try {
        const newdirectory = await directories.create({
            _directoryName: directoryName,
            _directoryParent: directoryParent,
            _directoryChats: userChats,
            _facebookIntegration: facebookIntegration,
            _allIntegration: allIntegration
        })

        if (newdirectory) {
            return {
                newdirectory
            }
        } else {
            return {
                directoryCreationErr: "Directory Adding thread failed..."
            }
        }
    } catch (err) {
        console.log(err)
        return {
            directoryCreationErr: "Directory Adding thread failed..."
        }
    }
}

const getDirectory = async ({ directoryId }) => {
    try {
        let existingdirectory = await directories.findById(directoryId)

        if (existingdirectory) {
            return {
                existingdirectory
            }
        } else {
            return {
                directoryGettingErr: 'Directory fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            directoryGettingErr: 'Directory fetching thread denied...'
        }
    }
}

const deleteDirectory = async ({ directoryId }) => {
    try {
        let deleteddirectory = await directories.findByIdAndDelete(directoryId)

        if (deleteddirectory) {
            return {
                deleteddirectory
            }
        } else {
            return {
                directoryDeletionErr: 'Directory deletion thread failed...'
            }
        }
    } catch (errr) {
        return {
            directoryDeletionErr: 'Directory deletion thread denied...'
        }
    }
}

const updateDirectory = async ({ directoryId, directoryUpdates }) => {
    try {
        let directory = await directories.findByIdAndUpdate(directoryId, directoryUpdates)
        let updatedDirectory = await directories.findById(directory._id)

        if (updatedDirectory) {
            return {
                updatedDirectory
            }
        } else {
            return {
                directoryUpdationErr: 'Directory updation thread failed...'
            }
        }
    } catch (errr) {
        return {
            directoryUpdationErr: 'Directory updation thread denied...'
        }
    }
}

module.exports = {
    addDirectory,
    getDirectory,
    updateDirectory,
    deleteDirectory
}