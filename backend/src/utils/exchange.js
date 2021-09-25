const Binance = require('node-binance-api');
const LOGS = process.env.BINANCE_LOGS === 'true';

module.exports = (settings) => {

    if (!settings) throw new Error(`The settings object is required to connect on exchange!`);

    const binance = new Binance({
        APIKEY: settings.accessKey,
        APISECRET: settings.secretKey,
        recvWindow: 60000,
        urls: {
            base: settings.apiUrl.endsWith('/') ? settings.apiUrl : settings.apiUrl + '/',
            stream: settings.streamUrl.endsWith('/') ? settings.streamUrl : settings.streamUrl + '/'
        },
        verbose: LOGS
    });

    function exchangeInfo() {
        return binance.exchangeInfo();
    }

    async function balance() {
        await binance.useServerTime();
        return binance.balance();
    }

    function buy(symbol, quantity, price, options) {
        if (price)
            return binance.buy(symbol, quantity, price, options);

        return binance.marketBuy(symbol, quantity);
    }

    function sell(symbol, quantity, price, options) {
        if (price)
            return binance.sell(symbol, quantity, price, options);

        return binance.marketSell(symbol, quantity);
    }

    function cancel(symbol, orderId) {
        return binance.cancel(symbol, orderId);
    }

    function orderStatus(symbol, orderId){
        return binance.orderStatus(symbol, orderId);
    }

    async function orderTrade(symbol, orderId){
        const trades = await binance.trades(symbol);
        return trades.find(t => t.orderId === orderId);
    }

    function miniTickerStream(callback) {
        binance.websockets.miniTicker(markets => {
            callback(markets)
        });
    }

    function bookStream(callback) {
        binance.websockets.bookTickers(order => {
            callback(order)
        });
    }

    function chartStream(symbol, interval, callback) {
        const streamUrl = binance.websockets.chart(symbol, interval, (symbol, interval, chart) => {
            const tick = binance.last(chart);
            if(tick && chart[tick] && chart[tick].isFinal === false)
                return;

            const ohlc = binance.ohlc(chart);
            callback(ohlc);
        });
        if(LOGS) console.log(`Chart Stream connected at ${streamUrl}`);
    }

    function terminateChartStream(symbol, interval) {
        //btcusdt@kline_1m
        binance.websockets.terminate(`${symbol.toLowerCase()}@kline_${interval}`);
        console.log(`Chart Stream ${symbol.toLowerCase()}@kline_${interval} terminated!`);
    }

    function userDataStream(balanceCallback, executionCallback, listStatusCallback) {
        binance.websockets.userData(
            balance => balanceCallback(balance),
            executionData => executionCallback(executionData),
            subscribedData => console.log(`userDataStream:subscribeEvent: ${JSON.stringify(subscribedData)}`),
            listStatusData => listStatusCallback(listStatusData));
    }

    async function tickerStream(symbol, callback){
        const streamUrl = binance.websockets.prevDay(symbol, (data, converted) => {
            callback(converted);
        })
        if(LOGS) console.log(`Ticker Stream connected at ${streamUrl}`);
    }

    function terminateTickerStream(symbol){
        binance.websockets.terminate(`${symbol.toLowerCase()}@ticker`);
        console.log(`Ticker Stream disconnected at ${symbol.toLowerCase()}@ticker`);
    }

    return {
        exchangeInfo,
        balance,
        buy,
        sell,
        cancel,
        miniTickerStream,
        bookStream,
        chartStream,
        terminateChartStream,
        terminateTickerStream,
        userDataStream,
        orderStatus,
        orderTrade,
        tickerStream
    }
}