const settingsRepository = require('./repositories/settingsRepository');

const MEMORY = {};

let BRAIN = {};

let LOCK_BRAIN = false;

let BRAIN_INDEX = {};

let LOCK_MEMORY = false;

const LOGS = process.env.BEHOLDER_LOGS === 'true';

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

function invertConditions(conditions) {
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

async function evalDecision(automation) {
    if (!automation) return false;

    try {
        const indexes = automation.indexes ? automation.indexes.split(',') : [];
        const isChecked = indexes.every(ix => MEMORY[ix] !== null && MEMORY[ix] !== undefined);
        if (!isChecked) return false;

        const invertedConditions = invertConditions(automation.conditions);
        const evalCondition = automation.conditions + (invertedConditions ? ' && ' + invertedConditions : '');

        if (LOGS) console.log(`Beholder trying to evaluate:\n${evalCondition}\n at ${automation.name}`);

        const isValid = evalCondition ? eval(evalCondition) : true;
        if (!isValid) return false;

        if (LOGS || automation.logs)
            console.log(`Beholder evaluated a condition at automation: ${automation.name} => ${automation.conditions}`);

        if (!automation.actions || !automation.actions.length) {
            if (LOGS || automation.logs) console.log(`No actions defined for automation ${automation.name}`);
            return false;
        }

        const settings = await settingsRepository.getDefaultSettings();
        //para cada action da automation, executa a action com as settings

        console.log('EXECUTEI A AÇÃO');
    } catch (err) {
        if (automation.logs) console.error(err);
        return { type: 'error', text: `Error at evalDecision for '${automation.name}': ${err}` };
    }
}

function updateMemory(symbol, index, interval, value, executeAutomations = true) {
    const indexKey = interval ? `${index}_${interval}` : index;
    const memoryKey = `${symbol}:${indexKey}`;
    MEMORY[memoryKey] = value;

    if (LOGS) console.log(`Beholder Memory updated ${memoryKey} => ${JSON.stringify(value)}`);

    if (LOCK_BRAIN) {
        if (LOGS) console.log(`Beholder brain is locked, sorry!`);
        return false;
    }

    if(!executeAutomations) return false;

    try {
        const automations = findAutomations(memoryKey);
        if (!automations || !automations.length || LOCK_BRAIN) return false;

        LOCK_BRAIN = true;

        let results = automations.map(async (auto) => {
            return evalDecision(auto);
        }).flat();

        results = results.filter(r => r);

        if (!results || !results.length)
            return false;
        else
            return results;
    }
    finally {
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