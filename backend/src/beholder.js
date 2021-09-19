const { getDefaultSettings } = require('./repositories/settingsRepository');
const { actionTypes } = require('./repositories/actionsRepository');

const MEMORY = {};

let BRAIN = {};

let LOCK_BRAIN = false;

let BRAIN_INDEX = {};

let LOCK_MEMORY = false;

const LOGS = process.env.BEHOLDER_LOGS === 'true';
const INTERVAL = parseInt(process.env.AUTOMATION_INTERVAL || 0);

function init(automations) {

    try {
        LOCK_BRAIN = true;
        LOCK_MEMORY = true;

        BRAIN = {};
        BRAIN_INDEX = {};

        automations.map(auto => {
            if (auto.isActive && !auto.schedule)
                updateBrain(auto)
        });
    } finally {
        LOCK_BRAIN = false;
        LOCK_MEMORY = false;
        console.log('Beholder Brain has started!');
    }
}

function updateBrainIndex(index, automationId) {
    if (!BRAIN_INDEX[index]) BRAIN_INDEX[index] = [];
    BRAIN_INDEX[index].push(automationId);
}

function deleteBrainIndex(indexes, automationId) {
    if (typeof indexes === 'string') indexes = indexes.split(',');
    indexes.forEach(ix => {
        if (!BRAIN_INDEX[ix] || BRAIN_INDEX[ix].length === 0) return;
        const pos = BRAIN_INDEX[ix].findIndex(id => id === automationId);
        BRAIN_INDEX[ix].splice(pos, 1);
    });
}

function updateBrain(automation) {
    if (!automation.isActive || !automation.conditions) return;

    //otimizações opcionais
    if (automation.toJSON)
        automation = automation.toJSON();

    delete automation.createdAt;
    delete automation.updatedAt;
    //fim das otimizações opcionais

    BRAIN[automation.id] = automation;
    automation.indexes.split(',').map(ix => updateBrainIndex(ix, automation.id));
}

function deleteBrain(automation) {
    try {
        LOCK_BRAIN = true;
        delete BRAIN[automation.id];
        deleteBrainIndex(automation.indexes.split(','), automation.id);
        if (automation.logs) console.log(`Automation removed from BRAIN #${automation.id}`);
    }
    finally {
        LOCK_BRAIN = false;
    }
}

function findAutomations(indexKey) {
    const ids = BRAIN_INDEX[indexKey];
    if (!ids) return [];
    return [...new Set(ids)].map(id => BRAIN[id]);
}

function invertCondition(conditions) {
    const conds = conditions.split(' && ');
    return conds.map(c => {
        if (c.indexOf('current') !== -1) {
            if (c.indexOf('>') != -1) return c.replace('>', '<').replace('current', 'previous');
            if (c.indexOf('<') != -1) return c.replace('<', '>').replace('current', 'previous');
            if (c.indexOf('!') != -1) return c.replace('!', '').replace('current', 'previous');
            if (c.indexOf('==') != -1) return c.replace('==', '!==').replace('current', 'previous');
        }
    })
        .filter(c => c)
        .join(' && ');
}

async function sendSms(settings, automation) {
    await require('./utils/sms')(settings, automation.name + ' has fired!');
    if (automation.logs) console.log(`SMS sent!`);
    return { text: `SMS sent from automation '${automation.name}'`, type: 'success' };
}

async function sendEmail(settings, automation) {
    await require('./utils/email')(settings, automation.name + ' has fired!');
    if (automation.logs) console.log(`E-mail sent!`);
    return { text: `E-mail sent from automation '${automation.name}'`, type: 'success' };
}

function doAction(settings, action, automation) {
    try {
        switch (action.type) {
            case actionTypes.ALERT_EMAIL: return sendEmail(settings, automation);
            case actionTypes.ALERT_SMS: return sendSms(settings, automation);
            case actionTypes.ORDER: return { type: 'success', text: 'Order placed!' };
        }
    } catch (err) {
        if (automation.logs) {
            console.error(`${automation.name}:${action.type}`);
            console.error(err);
        }
        return { text: `Error at ${automation.name}: ${err.message}`, type: 'error' };
    }
}

async function evalDecision(automation) {
    if (!automation) return false;

    try {
        const indexes = automation.indexes ? automation.indexes.split(',') : [];
        const isChecked = indexes.every(ix => MEMORY[ix] !== null && MEMORY[ix] !== undefined);
        if (!isChecked) return false;

        const invertedCondition = invertCondition(automation.conditions);
        const evalCondition = automation.conditions + (invertedCondition ? ' && ' + invertedCondition : '');
        
        if (LOGS) console.log(`Beholder trying to evaluate:\n${evalCondition}\n at ${automation.name}`);

        const isValid = evalCondition ? eval(evalCondition) : true;
        if (!isValid) return false;

        if (!automation.actions || !automation.actions.length) {
            if (LOGS || automation.logs) console.log(`No actions defined for automation ${automation.name}`);
            return false;
        }

        if ((LOGS || automation.logs))
            console.log(`Beholder evaluated a condition at automation: ${automation.name} => ${automation.conditions}`);

        const settings = await getDefaultSettings();

        let results = automation.actions.map(async (action) => {
            const result = await doAction(settings, action, automation);
            if (automation.logs && result) console.log(`Result for action ${action.type} was ${JSON.stringify(result)}`);
            return result;
        })

        results = await Promise.all(results);

        if (automation.logs && results && results.length && results[0])
            console.log(`Automation ${automation.name} finished execution at ${new Date()}`);

        return results;
    } catch (err) {
        if (automation.logs) console.error(err);
        return { type: 'error', text: `Error at evalDecision for '${automation.name}': ${err}` };
    }
}

async function updateMemory(symbol, index, interval, value, executeAutomations = true) {
    if (!value) return false;
    if (value.get) value = value.get({ plain: true });

    if (LOCK_MEMORY) return false;

    const indexKey = interval ? `${index}_${interval}` : index;
    const memoryKey = `${symbol}:${indexKey}`;
    MEMORY[memoryKey] = value;

    if (LOGS) console.log(`Beholder memory updated: ${memoryKey} => ${JSON.stringify(value)}`);

    if (LOCK_BRAIN) {
        if (LOGS) console.log(`Beholder brain is locked, sorry!`);
        return false;
    }

    if (!executeAutomations) return false;

    const automations = findAutomations(memoryKey);
    if (!automations || !automations.length || LOCK_BRAIN) return false;

    LOCK_BRAIN = true;
    let results;

    try {
        const promises = automations.map(async (auto) => {
            return evalDecision(auto);
        });

        results = await Promise.all(promises);
        results = results.flat().filter(r => r);

        if (!results || !results.length)
            return false;
        else
            return results;
    }
    finally {
        if (results && results.length) {//se executou, segura a próxima
            setTimeout(() => {
                LOCK_BRAIN = false;
            }, INTERVAL)
        }
        else
            LOCK_BRAIN = false;
    }
}

function deleteMemory(symbol, index, interval) {
    try {
        const indexKey = interval ? `${index}_${interval}` : index;
        const memoryKey = `${symbol}:${indexKey}`;
        if (MEMORY[memoryKey] === undefined) return;

        LOCK_MEMORY = true;
        delete MEMORY[memoryKey];

        if (LOGS) console.log(`Beholder memory delete: ${memoryKey}!`);
    } finally {
        LOCK_MEMORY = false;
    }
}

function getMemory(symbol, index, interval) {
    if (symbol && index) {
        const indexKey = interval ? `${index}_${interval}` : index;
        const memoryKey = `${symbol}:${indexKey}`;

        const result = MEMORY[memoryKey];
        return typeof result === 'object' ? { ...result } : result;
    }

    return { ...MEMORY };
}

function getBrain() {
    return { ...BRAIN };
}

function getBrainIndexes() {
    return { ...BRAIN_INDEX };
}

function flattenObject(ob) {
    var toReturn = {};

    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;

        if ((typeof ob[i]) == 'object' && ob[i] !== null) {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;

                toReturn[i + '.' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

function getEval(prop) {
    if (prop.indexOf('MEMORY') !== -1) return prop;
    if (prop.indexOf('.') === -1) return `MEMORY['${prop}']`;

    const propSplit = prop.split('.');
    const memKey = propSplit[0];
    const memProp = prop.replace(memKey, '');
    return `MEMORY['${memKey}']${memProp}`;
}

function getMemoryIndexes() {
    return Object.entries(flattenObject(MEMORY)).map(prop => {
        if (prop[0].indexOf('previous') !== -1) return false;
        const propSplit = prop[0].split(':');
        return {
            symbol: propSplit[0],
            variable: propSplit[1],
            eval: getEval(prop[0]),
            example: prop[1]
        }
    })
        .filter(ix => ix)
        .sort((a, b) => {
            if (a.variable < b.variable) return -1;
            if (a.variable > b.variable) return 1;
            return 0;
        })
}

module.exports = {
    updateMemory,
    getMemory,
    getBrain,
    init,
    deleteMemory,
    getMemoryIndexes,
    getBrainIndexes,
    updateBrain,
    deleteBrain,
    findAutomations
}