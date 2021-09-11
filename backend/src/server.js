const database = require('./db');
const app = require('./app');
const settingsRepository = require('./repositories/settingsRepository');
const appEm = require('./app-em');
const appWs = require('./app-ws');

(async () => {
    console.log('Getting the default settings...');
    const settings = await settingsRepository.getDefaultSettings()
    if(!settings) throw new Error(`There is no settings.`);

    console.log('Initializing the Beholder Brain...');

    //inicializar o Beholder aqui

    console.log(`Starting the server apps...`);
    const server = app.listen(process.env.PORT, () => {
        console.log('App is running at ' + process.env.PORT);
    })

    const wss = appWs(server);

    appEm.init(settings, wss, {});//passar o beholder

})();