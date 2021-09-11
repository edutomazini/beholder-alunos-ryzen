const MEMORY = {};

let BRAIN = {};

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
    init
}