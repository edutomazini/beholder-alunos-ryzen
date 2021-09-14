const automationsRepository = require('../repositories/automationsRepository');
const beholder = require('../beholder');

function validateConditions(conditions) {
    return /^(MEMORY\[\'.+?\'\](\..+)?[><=!]+([0-9\.]+|(\'.+?\')|true|false|MEMORY\[\'.+?\'\](\..+)?)( && )?)+$/ig.test(conditions);
}

async function startAutomation(req, res, next) {
    const id = req.params.id;
    const automation = await automationsRepository.getAutomation(id);
    if (automation.isActive) return res.sendStatus(204);

    automation.isActive = true;

    beholder.updateBrain(automation.get({ plain: true }));

    await automation.save();

    if (automation.logs) console.log(`Automation ${automation.name} has started!`);

    res.json(automation);
}

async function stopAutomation(req, res, next) {
    const id = req.params.id;
    const automation = await automationsRepository.getAutomation(id);
    if (!automation.isActive) return res.sendStatus(204);

    beholder.deleteBrain(automation.get({ plain: true }));

    automation.isActive = false;
    await automation.save();

    if (automation.logs) console.log(`Automation ${automation.name} has stopped!`);

    res.json(automation);
}

async function getAutomation(req, res, next) {
    const id = req.params.id;
    const automation = await automationsRepository.getAutomation(id);
    res.json(automation);
}

async function getAutomations(req, res, next) {
    const page = req.query.page;
    const result = await automationsRepository.getAutomations(page);
    res.json(result);
}

async function insertAutomation(req, res, next) {
    const newAutomation = req.body;

    if (!validateConditions(newAutomation.conditions))
        return res.status(400).json('Invalid conditions!');

    const exists = await automationsRepository.automationExists(newAutomation.name);
    if (exists) return res.status(409).json(`The automation ${newAutomation.name} already exists!`);

    const savedAutomation = await automationsRepository.insertAutomation(newAutomation);

    if (savedAutomation.isActive) {
        beholder.updateBrain(savedAutomation);
    }

    res.status(201).json(savedAutomation);
}

async function updateAutomation(req, res, next) {
    const id = req.params.id;
    const newAutomation = req.body;

    if (!validateConditions(newAutomation.conditions))
        return res.status(400).json('Invalid conditions!');

    const updatedAutomation = await automationsRepository.updateAutomation(id, newAutomation);

    if (updatedAutomation.isActive) {
        beholder.deleteBrain(updatedAutomation);
        beholder.updateBrain(updatedAutomation);
    }
    else {
        beholder.deleteBrain(updatedAutomation);
    }

    res.json(updatedAutomation);
}

async function deleteAutomation(req, res, next) {
    const id = req.params.id;
    const currentAutomation = await automationsRepository.getAutomation(id);

    if (currentAutomation.isActive) {
        beholder.deleteBrain(currentAutomation);
    }
    await automationsRepository.deleteAutomation(id);
    res.sendStatus(204);
}

module.exports = {
    startAutomation,
    stopAutomation,
    getAutomation,
    getAutomations,
    insertAutomation,
    updateAutomation,
    deleteAutomation
}
