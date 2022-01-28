const axios = require('axios');
const settingsRepository = require('../repositories/settingsRepository');

module.exports = async (settings, body, title = 'Beholder Notification', data = {}) => {

    if (!settings) throw new Error(`The settings object is required to send push notifications!`);
    if (!settings.pushToken) throw new Error(`The push token at settings is not defined!`);

    const response = await axios.post('https://exp.host/--/api/v2/push/send', {
        to: settings.pushToken,
        title,
        body,
        data
    })

    if (response.data.errors || response.data.data.status === 'error') {
        await settingsRepository.updateSettings(settings.id, { pushToken: null });
        throw new Error(`There was an error sending Push Notification for you.\n${JSON.stringify(response.data)}`);
    }
}