const ordersRepository = require('./repositories/ordersRepository');
const { orderStatus } = require('./repositories/ordersRepository');
const { monitorTypes, getActiveMonitors } = require('./repositories/monitorsRepository');
const { MACD, RSI, indexKeys } = require('./utils/indexes');

let WSS, beholder, exchange;

function startMiniTickerMonitor(broadcastLabel, logs) {
    if (!exchange) return new Error('Exchange Monitor not initialized yet.');

    exchange.miniTickerStream((markets) => {
        if (logs) console.log(markets);

        try {
            //enviar para o Beholder

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

            //enviar para o Beholder
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
        //enviar para o Beholder

        return {
            symbol: item[0],
            available: item[1].available,
            onOrder: item[1].onOrder
        }
    })
    return wallet;
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

    setTimeout(() => {
        ordersRepository.updateOrderByOrderId(order.orderId, order.clientOrderId, order)
            .then(order => {
                if (order) {
                    //enviar para o beholder
                    if (broadcastLabel && WSS)
                        WSS.broadcast({ [broadcastLabel]: order });
                }
            })
            .catch(err => console.error(err));
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

    indexes.map(async (index) => {
        const params = index.split('_');
        const indexName = params[0];
        params.splice(0, 1);

        switch (indexName) {
            case indexKeys.RSI: {
                //calcula RSI
            }
            case indexKeys.MACD: {
                //calcula MACD
            }
            default: return;
        }
    });
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

        //enviar para o beholder

        try {

            if (broadcastLabel && WSS) WSS.broadcast({ [broadcastLabel]: lastCandle });
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
            }
        }, 250)//Binance only permits 5 commands / second
    })

    console.log('App Exchange Monitor is running!');
}

module.exports = {
    init,
    startChartMonitor
}