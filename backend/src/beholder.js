const MEMORY = {};

let BRAIN = {};

let LOCK_BRAIN = false;

let LOCK_MEMORY = false;

const LOGS = process.env.BEHOLDER_LOGS === 'true';

function init(automations) {
    //carrega o Brain
}

function updateMemory(symbol, index, interval, value) {
    const indexKey = interval ? `${index}_${interval}` : index;
    const memoryKey = `${symbol}:${indexKey}`;
    MEMORY[memoryKey] = value;

    if (LOGS) console.log(`Beholder Memory updated ${memoryKey} => ${JSON.stringify(value)}`);

    //lógica de processamento do estímulo


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

function getMemory() {
    return { ...MEMORY };
}

function getBrain() {
    return { ...BRAIN };
}

module.exports = {
    updateMemory,
    getMemory,
    getBrain,
    init,
    deleteMemory
}