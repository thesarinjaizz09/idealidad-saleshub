const funnels = require("../db/models/funnel-model")
const encrypter = require("../lib/encryption/encrypter")

const addFunnels = async ({ funnelName, funnelParent, userChats }) => {
    try {
        const newFunnel = await funnels.create({
            _funnelName: funnelName,
            _funnelParent: funnelParent,
            _funnelChats: userChats,
            _funnelStages: [{
                _stageName: 'Inbox',
                _stageChats: userChats
            }]
        })

        if (newFunnel) {
            return {
                newFunnel
            }
        } else {
            return {
                funnelCreationErr: "Funnel Adding thread failed..."
            }
        }
    } catch (err) {
        console.log(err)
        return {
            funnelCreationErr: "Funnel Adding thread failed..."
        }
    }
}

const getFunnels = async ({ funnelId }) => {
    try {
        let existingFunnel = await funnels.findById(funnelId)

        if (existingFunnel) {
            return {
                existingFunnel
            }
        } else {
            return {
                funnelGettingErr: 'Funnel fetching thread failed...'
            }
        }
    } catch (errr) {
        return {
            funnelGettingErr: 'Funnel fetching thread denied...'
        }
    }
}

const deleteFunnels = async ({ funnelId }) => {
    try {
        let deletedFunnel = await funnels.findByIdAndDelete(funnelId)

        if (deletedFunnel) {
            return {
                deletedFunnel
            }
        } else {
            return {
                funnelDeletionErr: 'Funnel deletion thread failed...'
            }
        }
    } catch (errr) {
        return {
            funnelDeletionErr: 'Funnel deletion thread denied...'
        }
    }
}

const updateFunnels = async ({ funnelId, funnelUpdates }) => {
    try {
        let funnel = await funnels.findByIdAndUpdate(funnelId, funnelUpdates)
        let updatedFunnel = await funnels.findById(funnel._id)

        if (updatedFunnel) {
            return {
                updatedFunnel
            }
        } else {
            return {
                funnelUpdationErr: 'Funnel updation thread failed...'
            }
        }
    } catch (errr) {
        return {
            funnelUpdationErr: 'Funnel updation thread denied...'
        }
    }
}

module.exports = {
    addFunnels,
    getFunnels,
    updateFunnels,
    deleteFunnels
}