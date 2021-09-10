//const appEm = require('../app-em');
const monitorsRepository = require('../repositories/monitorsRepository');
const { monitorTypes } = require('../repositories/monitorsRepository');

async function startMonitor(req, res, next) {
    const id = req.params.id;
    const monitor = await monitorsRepository.getMonitor(id);
    if (monitor.isActive) return res.sendStatus(204);
    if (monitor.isSystemMon) return res.status(404).send(`You can't start or stop the system monitors.`);

    //testar e iniciar outros tipos aqui
    //appEm.startChartMonitor(monitor.symbol, monitor.interval, monitor.indexes ? monitor.indexes.split(',') : [], monitor.broadcastLabel, monitor.logs);

    monitor.isActive = true;
    await monitor.save();

    res.json(monitor);
}

async function stopMonitor(req, res, next) {
    const id = req.params.id;
    const monitor = await monitorsRepository.getMonitor(id);
    if (!monitor.isActive) return res.sendStatus(204);
    if (monitor.isSystemMon) return res.status(404).send(`You can't start or stop the system monitors.`);

    //testar e parar outros tipos aqui
    //appEm.stopChartMonitor(monitor.symbol, monitor.interval, monitor.indexes ? monitor.indexes.split(',') : [], monitor.logs);

    monitor.isActive = false;
    await monitor.save();

    res.json(monitor);
}

async function getMonitor(req, res, next) {
    const id = req.params.id;
    const monitor = await monitorsRepository.getMonitor(id);
    res.json(monitor);
}

async function getMonitors(req, res, next) {
    const page = req.query.page;
    const result = await monitorsRepository.getMonitors(page);
    res.json(result);
}

function validateMonitor(newMonitor) {
    if (newMonitor.type !== monitorTypes.CANDLES) {
        newMonitor.symbol = '*';
        newMonitor.interval = null;
        newMonitor.indexes = null;
    }

    if (newMonitor.broadcastLabel === 'none')
        newMonitor.broadcastLabel = null;

    return newMonitor;
}

async function insertMonitor(req, res, next) {
    const newMonitor = validateMonitor(req.body);
    const monitor = await monitorsRepository.insertMonitor(newMonitor);

    if (monitor.isActive){
        //appEm.startChartMonitor(monitor.symbol, monitor.interval, monitor.indexes ? monitor.indexes.split(',') : [], monitor.broadcastLabel, monitor.logs);
    }

    res.status(201).json(monitor.get({ plain: true }));
}

async function updateMonitor(req, res, next) {
    const id = req.params.id;
    const newMonitor = validateMonitor(req.body);

    const currentMonitor = await monitorsRepository.getMonitor(id);
    if (currentMonitor.isSystemMon) return res.sendStatus(403);

    const updatedMonitor = await monitorsRepository.updateMonitor(id, newMonitor);

    if (updatedMonitor.isActive) {
        //appEm.stopChartMonitor(currentMonitor.symbol, currentMonitor.interval, currentMonitor.indexes ? currentMonitor.indexes.split(',') : [], currentMonitor.logs);
        //appEm.startChartMonitor(updatedMonitor.symbol, updatedMonitor.interval, updatedMonitor.indexes ? updatedMonitor.indexes.split(',') : [], updatedMonitor.broadcastLabel, updatedMonitor.logs);
    }
    else{
        //appEm.stopChartMonitor(currentMonitor.symbol, currentMonitor.interval, currentMonitor.indexes ? currentMonitor.indexes.split(',') : [], currentMonitor.logs);
    }

    res.json(updatedMonitor);
}

async function deleteMonitor(req, res, next) {
    const id = req.params.id;
    const currentMonitor = await monitorsRepository.getMonitor(id);
    if (currentMonitor.isSystemMon) return res.sendStatus(403);

    if (currentMonitor.isActive){
        //appEm.stopChartMonitor(updatedMonitor.symbol, updatedMonitor.interval);
    }

    await monitorsRepository.deleteMonitor(id);

    res.sendStatus(204);
}

module.exports = {
    startMonitor,
    stopMonitor,
    getMonitor,
    getMonitors,
    insertMonitor,
    updateMonitor,
    deleteMonitor
}
