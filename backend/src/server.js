const database = require('./db');
const app = require('./app');
const settingsRepository = require('./repositories/settingsRepository');
const automationsRepository = require('./repositories/automationsRepository');
const appEm = require('./app-em');
const appWs = require('./app-ws');
const beholder = require('./beholder');

(async () => {
    console.log('Getting the default settings...');
    const settings = await settingsRepository.getDefaultSettings()
    if (!settings) throw new Error(`There is no settings.`);

    console.log('Initializing the Beholder Brain...');

    const automations = await automationsRepository.getActiveAutomations();
    beholder.init(automations);

    console.log(`Starting the server apps...`);
    const server = app.listen(process.env.PORT, () => {
        console.log('App is running at ' + process.env.PORT);
    })

    const wss = appWs(server);

    appEm.init(settings, wss, beholder);

    // setTimeout(async () => {
    //     try {
    //         const result = await beholder.placeOrder(settings, automations[0], automations[0].actions[0]);
    //         console.log(result);
    //     } catch (err) {
    //         console.error(err);
    //     }
    // }, 5000)

})();