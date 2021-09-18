const ordersRepository = require('./repositories/ordersRepository');
const { orderStatus } = require('./repositories/ordersRepository');
const { monitorTypes, getActiveMonitors } = require('./repositories/monitorsRepository');
const { execCalc, indexKeys } = require('./utils/indexes');

let WSS, beholder, exchange;

function startMiniTickerMonitor(broadcastLabel, logs) {
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');
    exchange.miniTickerStream(async (markets) => {
        if (logs) console.log(markets);

        try {
            Object.entries(markets).map(async (mkt) => {

                delete mkt[1].volume;
                delete mkt[1].quoteVolume;
                delete mkt[1].eventTime;
                const converted = {};
                Object.entries(mkt[1]).map(prop => converted[prop[0]] = parseFloat(prop[1]));
                const results = await beholder.updateMemory(mkt[0], indexKeys.MINI_TICKER, null, converted);
                if (results) results.map(r => WSS.broadcast({ notification: r }));
            })

            if (broadcastLabel && WSS) WSS.broadcast({ [broadcastLabel]: markets });
        } catch (err) {
            if (logs) console.error(err);
        }
    })
    console.log('Mini Ticker Monitor has started!');
}

let book = [];
function startBookMonitor(broadcastLabel, logs) {
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');
    exchange.bookStream(async (order) => {
        if (logs) console.log(order);

        try {
            if (book.length === 200) {
                if (broadcastLabel && WSS) WSS.broadcast({ [broadcastLabel]: book });
                book = [];
            }
            else book.push({ ...order });

            const orderCopy = { ...order };
            delete orderCopy.symbol;
            delete orderCopy.updateId;
            delete orderCopy.bestAskQty;
            delete orderCopy.bestBidQty;

            const converted = {};
            Object.entries(orderCopy).map(prop => converted[prop[0]] = parseFloat(prop[1]));

            const currentMemory = beholder.getMemory(order.symbol, indexKeys.BOOK);

            const newMemory = {};
            newMemory.previous = currentMemory ? currentMemory.current : converted;
            newMemory.current = converted;

            const results = await beholder.updateMemory(order.symbol, indexKeys.BOOK, null, newMemory);
            if (results) results.map(r => WSS.broadcast({ notification: r }));
        } catch (err) {
            if (logs) console.error(err);
        }
    })
    console.log('Book Monitor has started!');
}

async function loadWallet() {
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');
    const info = await exchange.balance();
    const wallet = Object.entries(info).map(async (item) => {
        const results = await beholder.updateMemory(item[0], indexKeys.WALLET, null, parseFloat(item[1].available));
        if (results) results.map(r => WSS.broadcast({ notification: r }));

        return {
            symbol: item[0],
            available: item[1].available,
            onOrder: item[1].onOrder
        }
    })
    return wallet;
}

function getLightOrder(updatedOrder) {
    const orderCopy = { ...updatedOrder };
    delete orderCopy.id;
    delete orderCopy.symbol;
    delete orderCopy.automationId;
    delete orderCopy.orderId;
    delete orderCopy.clientOrderId;
    delete orderCopy.transactTime;
    delete orderCopy.isMaker;
    delete orderCopy.commission;
    delete orderCopy.obs;
    delete orderCopy.Automation;
    delete orderCopy.createdAt;
    delete orderCopy.updatedAt;
    orderCopy.limitPrice = parseFloat(orderCopy.limitPrice);
    orderCopy.stopPrice = parseFloat(orderCopy.stopPrice);
    orderCopy.avgPrice = parseFloat(orderCopy.avgPrice);
    orderCopy.net = parseFloat(orderCopy.net);
    orderCopy.quantity = parseFloat(orderCopy.quantity);
    orderCopy.icebergQty = parseFloat(orderCopy.icebergQty);
    return orderCopy;
}

function notifyOrderUpdate(order) {
    let type = '';
    switch (order.status) {
        case 'FILLED': type = 'success'; break;
        case 'REJECTED':
        case 'CANCELED':
        case 'EXPIRED': type = 'error'; break;
        default: type = 'info'; break;
    }
    WSS.broadcast({ notification: { text: `Order #${order.orderId} was updated as ${order.status}`, type } });
}

function processExecutionData(executionData, broadcastLabel) {
    if (executionData.x === orderStatus.NEW) return;//ignora as novas, pois podem ter vindo de outras fontes

    const order = {
        symbol: executionData.s,
        orderId: executionData.i,
        clientOrderId: executionData.X === orderStatus.CANCELED ? executionData.C : executionData.c,
        side: executionData.S,
        type: executionData.o,
        status: executionData.X,
        isMaker: executionData.m,
        transactTime: executionData.T
    }

    if (order.status === orderStatus.FILLED) {
        const quoteAmount = parseFloat(executionData.Z);
        order.avgPrice = quoteAmount / parseFloat(executionData.z);
        order.commission = executionData.n;
        const isQuoteCommission = executionData.N && order.symbol.endsWith(executionData.N);
        order.net = isQuoteCommission ? quoteAmount - parseFloat(order.commission) : quoteAmount;
    }

    if (order.status === orderStatus.REJECTED) order.obs = executionData.r;

    setTimeout(async () => {
        try {
            const updatedOrder = await ordersRepository.updateOrderByOrderId(order.orderId, order.clientOrderId, order);
            if (updatedOrder) {

                notifyOrderUpdate(order);

                const orderCopy = getLightOrder(updatedOrder.get({ plain: true }));
                const results = await beholder.updateMemory(orderCopy.symbol, indexKeys.LAST_ORDER, null, orderCopy);
                if (results) results.map(r => WSS.broadcast({ notification: r }));
                if (broadcastLabel) WSS.broadcast({ [broadcastLabel]: order });
            }
        } catch (err) {
            console.error(err);
        }
    }, 3000)
}

function startUserDataMonitor(broadcastLabel, logs) {
    const [balanceBroadcast, executionBroadcast] = broadcastLabel ? broadcastLabel.split(',') : [null, null];

    loadWallet();

    if (!exchange) return new Error('Exchange Monitor not initialized yet.');
    exchange.userDataStream(
        balanceData => {
            if (logs) console.log(balanceData);

            try {
                const wallet = loadWallet();
                if (broadcastLabel && WSS) WSS.broadcast({ [balanceBroadcast]: wallet });
            } catch (err) {
                if (logs) console.error(err);
            }
        },
        executionData => {
            if (logs) console.log(executionData);
            processExecutionData(executionData, executionBroadcast);
        }
    )
    console.log('User Data Monitor has started!');
}

async function processChartData(symbol, indexes, interval, ohlc, logs) {
    if (typeof indexes === 'string') indexes = indexes.split(',');
    if (!indexes || !Array.isArray(indexes) || indexes.length === 0) return false;

    return Promise.all(indexes.map(async (index) => {
        const params = index.split('_');
        const indexName = params[0];
        params.splice(0, 1);

        try {
            const calc = execCalc(indexName, ohlc, ...params);
            if (logs) console.log(`${index} calculated: ${JSON.stringify(calc.current ? calc.current : calc)}`);
            return beholder.updateMemory(symbol, index, interval, calc, !!calc.current);
        } catch (err) {
            console.error(`Exchange Monitor => Can't calc the index ${index}:`);
            console.error(err);
            return false;
        }
    }));
}

function startChartMonitor(symbol, interval, indexes, broadcastLabel, logs) {
    if (!symbol) return new Error(`Can't start a Chart Monitor without a symbol.`);
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');

    exchange.chartStream(symbol, interval || '1m', async (ohlc) => {
        const lastCandle = {
            open: ohlc.open[ohlc.open.length - 1],
            close: ohlc.close[ohlc.close.length - 1],
            high: ohlc.high[ohlc.high.length - 1],
            low: ohlc.low[ohlc.low.length - 1],
            volume: ohlc.volume[ohlc.volume.length - 1],
        };

        if (logs) console.log(lastCandle);

        try {
            let totalResults = await beholder.updateMemory(symbol, indexKeys.LAST_CANDLE, interval, lastCandle);
            totalResults = totalResults.flat();

            if (totalResults) totalResults.filter(r => r).map(r => WSS.broadcast({ notification: r }));

            if (broadcastLabel && WSS) WSS.broadcast({ [broadcastLabel]: [lastCandle, last2Candle, last3Candle] });
            results = await processChartData(symbol, indexes, interval, ohlc, logs);

            if (results) {
                if (logs) console.log(`chartStream Results: ${results}`);
                results.map(r => WSS.broadcast({ notification: r }));
            }
        } catch (err) {
            if (logs) console.error(err);
        }
    })
    console.log(`Chart Monitor has started for ${symbol}_${interval}!`);
}

function stopChartMonitor(symbol, interval, indexes, logs) {
    if (!symbol) return new Error(`Can't stop a Chart Monitor without a symbol.`);
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');
    exchange.terminateChartStream(symbol, interval);
    if (logs) console.log(`Chart Monitor ${symbol}_${interval} stopped!`);

    beholder.deleteMemory(symbol, indexKeys.LAST_CANDLE, interval);

    if (indexes && Array.isArray(indexes))
        indexes.map(ix => beholder.deleteMemory(symbol, ix, interval));
}

function stopTickerMonitor(symbol, logs) {
    if (!symbol) return new Error(`Can't stop a Ticker Monitor without a symbol.`);
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');

    exchange.terminateTickerStream(symbol);

    if (logs) console.log(`Ticker Monitor ${symbol} stopped!`);

    beholder.deleteMemory(symbol, indexKeys.TICKER);
}

function getLightTicker(data) {
    delete data.eventType;
    delete data.eventTime;
    delete data.symbol;
    delete data.openTime;
    delete data.closeTime;
    delete data.firstTradeId;
    delete data.lastTradeId;
    delete data.numTrades;
    delete data.quoteVolume;
    delete data.closeQty;
    delete data.bestBidQty;
    delete data.bestAskQty;
    delete data.volume;

    data.priceChange = parseFloat(data.priceChange);
    data.percentChange = parseFloat(data.percentChange);
    data.averagePrice = parseFloat(data.averagePrice);
    data.prevClose = parseFloat(data.prevClose);
    data.high = parseFloat(data.high);
    data.low = parseFloat(data.low);
    data.open = parseFloat(data.open);
    data.close = parseFloat(data.close);
    data.bestBid = parseFloat(data.bestBid);
    data.bestAsk = parseFloat(data.bestAsk);

    return data;
}

async function startTickerMonitor(symbol, broadcastLabel, logs) {
    if (!symbol) return new Error(`Can't start a Ticker Monitor without a symbol.`);
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');

    exchange.tickerStream(symbol, async (data) => {
        if (logs) console.log(data);

        try {
            const ticker = getLightTicker({ ...data });
            const currentMemory = beholder.getMemory(symbol, indexKeys.TICKER);

            const newMemory = {};
            newMemory.previous = currentMemory ? currentMemory.current : ticker;
            newMemory.current = ticker;

            const results = await beholder.updateMemory(data.symbol, indexKeys.TICKER, null, newMemory);
            if (results) results.map(r => WSS.broadcast({ notification: r }));

            if (WSS && broadcastLabel) WSS.broadcast({ [broadcastLabel]: data });
        }
        catch (err) {
            if (logs) console.error(err);
        }
    })
    console.log(`Ticker Monitor has started for ${symbol}`);
}

async function init(settings, wssInstance, beholderInstance) {
    if (!settings || !beholderInstance) throw new Error(`You can't init the Exchange Monitor App without his settings. Check your database and/or startup code.`);

    WSS = wssInstance;
    beholder = beholderInstance;
    exchange = require('./utils/exchange')(settings);

    const monitors = await getActiveMonitors();
    monitors.map(m => {
        setTimeout(() => {
            switch (m.type) {
                case monitorTypes.MINI_TICKER:
                    return startMiniTickerMonitor(m.broadcastLabel, m.logs);
                case monitorTypes.BOOK:
                    return startBookMonitor(m.broadcastLabel, m.logs);
                case monitorTypes.USER_DATA:
                    return startUserDataMonitor(m.broadcastLabel, m.logs);
                case monitorTypes.CANDLES:
                    return startChartMonitor(m.symbol, m.interval, m.indexes ? m.indexes.split(',') : [], m.broadcastLabel, m.logs);
                case monitorTypes.TICKER:
                    return startTickerMonitor(m.symbol, m.broadcastLabel, m.logs);
            }
        }, 250)//Binance only permits 5 commands / second
    })

    console.log('App Exchange Monitor is running!');
}

module.exports = {
    init,
    startChartMonitor,
    stopChartMonitor,
    startTickerMonitor,
    stopTickerMonitor
}