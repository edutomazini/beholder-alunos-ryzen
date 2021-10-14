const settingsRepository = require('../repositories/settingsRepository');
const ordersRepository = require('../repositories/ordersRepository');
const beholder = require('../beholder');
const logger = require('../utils/logger');

async function getOrders(req, res, next) {
    const symbol = req.params.symbol && req.params.symbol.toUpperCase();
    const page = parseInt(req.query.page);
    const orders = await ordersRepository.getOrders(symbol, page || 1);
    res.json(orders);
}

async function placeOrder(req, res, next) {
    const id = res.locals.token.id;
    const settings = await settingsRepository.getSettingsDecrypted(id);
    const exchange = require('../utils/exchange')(settings.get({ plain: true }));

    const { side, symbol, quantity, price, type, options, automationId } = req.body;

    let result;

    try {
        if (side === 'BUY')
            result = await exchange.buy(symbol, quantity, price, options);
        else if (side === 'SELL')
            result = await exchange.sell(symbol, quantity, price, options);
    }
    catch (err) {
        return res.status(400).json(err.body);
    }

    const order = await ordersRepository.insertOrder({
        automationId,
        symbol,
        quantity,
        type,
        side,
        limitPrice: price,
        stopPrice: options ? options.stopPrice : null,
        icebergQty: options ? options.icebergQty : null,
        orderId: result.orderId,
        clientOrderId: result.clientOrderId,
        transactTime: result.transactTime,
        status: result.status
    })

    res.status(201).json(order.get({ plain: true }));
}

async function cancelOrder(req, res, next) {
    const id = res.locals.token.id;
    const settings = await settingsRepository.getSettingsDecrypted(id);
    const exchange = require('../utils/exchange')(settings);

    const { symbol, orderId } = req.params;

    let result;
    try {
        result = await exchange.cancel(symbol, orderId);
    }
    catch (err) {
        return res.status(400).json(err.body);
    }

    const order = await ordersRepository.updateOrderByOrderId(result.orderId, result.origClientOrderId, {
        status: result.status
    })
    res.json(order.get({ plain: true }));
}

async function syncOrder(req, res, next) {
    const id = res.locals.token.id;
    const settings = await settingsRepository.getSettingsDecrypted(id);
    const exchange = require('../utils/exchange')(settings);

    const beholderOrderId = req.params.id;
    const order = await ordersRepository.getOrderById(beholderOrderId);
    if (!order) return res.sendStatus(404);

    let binanceOrder, binanceTrade;
    try {
        binanceOrder = await exchange.orderStatus(order.symbol, order.orderId);
        order.status = binanceOrder.status;
        order.transactTime = binanceOrder.updateTime;

        if (binanceOrder.status !== 'FILLED') {
            await order.save();
            return res.json(order);
        }

        binanceTrade = await exchange.orderTrade(order.symbol, order.orderId);
    }
    catch (err) {
        logger('system', err);
        return res.sendStatus(404);
    }

    const quoteQuantity = parseFloat(binanceOrder.cummulativeQuoteQty);
    order.avgPrice = quoteQuantity / parseFloat(binanceOrder.executedQty);
    order.isMaker = binanceTrade.isMaker;
    order.commission = binanceTrade.commission;

    const isQuoteComission = binanceTrade.commissionAsset && order.symbol.endsWith(binanceTrade.commissionAsset);
    if (isQuoteComission)
        order.net = quoteQuantity - parseFloat(binanceTrade.commission);
    else
        order.net = quoteQuantity;

    await order.save();

    res.json(order);
}

async function getLastOrders(req, res, next) {
    const orders = await ordersRepository.getLastFilledOrders();
    res.json(orders);
}

function calcVolume(orders, side, startTime, endTime) {
    startTime = !startTime ? 0 : startTime;
    endTime = !endTime ? Date.now() : endTime;

    const filteredOrders = orders.filter(o => o.transactTime >= startTime && o.transactTime < endTime && o.side === side);
    if (!filteredOrders || !filteredOrders.length) return 0;

    return filteredOrders.map(o => parseFloat(o.net))
        .reduce((a, b) => a + b);
}

function thirtyDaysAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function getStartToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function getToday() {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

async function getOrdersReport(req, res, next) {
    if (req.query.date)
        return getDayTradeReport(req, res, next);
    else
        return getMonthReport(req, res, next);
}

const EMPTY_REPORT = {
    orders: 0,
    buyVolume: 0,
    sellVolume: 0,
    wallet: 0,
    profit: 0,
    profitPerc: 0,
    subs: [],
    series: [],
    automations: []
}

function groupByAutomations(orders){
    const automationsObj = {};
    orders.forEach(o => {
        const automationId = o.automationId ?? 'M';
        if (!automationsObj[automationId])
            automationsObj[automationId] = { name: o.automationId ? o['automation.name'] : 'Others', executions: 1, net: 0 };
        else
            automationsObj[automationId].executions++;

        if (o.side === 'BUY')
            automationsObj[automationId].net -= parseFloat(o.net);
        else
            automationsObj[automationId].net += parseFloat(o.net);
    })

    return Object.entries(automationsObj).map(prop => prop[1]).sort((a, b) => b.net - a.net);
}

async function getDayTradeReport(req, res, next) {
    const quote = req.params.quote;

    let startDate = req.query.date ? parseInt(req.query.date) : getStartToday();
    let endDate = startDate + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000) + 999;

    //permitir apenas 24h
    if ((endDate - startDate) > (1 * 24 * 60 * 60 * 1000)) startDate = getStartToday();

    const orders = await ordersRepository.getReportOrders(quote, startDate, endDate);
    if (!orders || !orders.length) return res.json({...EMPTY_REPORT, quote, startDate, endDate});

    const subs = [];
    const series = [];
    for (let i = 0; i < 24; i++) {
        const newDate = new Date(startDate);
        newDate.setHours(i);
        subs.push(`${i}h`);

        const lastMoment = new Date(newDate.getTime())
        lastMoment.setMinutes(59, 59, 999);

        const partialBuy = calcVolume(orders, 'BUY', newDate.getTime(), lastMoment.getTime());
        const partialSell = calcVolume(orders, 'SELL', newDate.getTime(), lastMoment.getTime());
        series.push(partialSell - partialBuy);
    }

    const buyVolume = calcVolume(orders, 'BUY');
    const sellVolume = calcVolume(orders, 'SELL');
    const profit = sellVolume - buyVolume;

    const wallet = beholder.getMemory(quote, 'WALLET');
    const profitPerc = (profit * 100) / (parseFloat(wallet) - profit);
    const automations = groupByAutomations(orders);

    res.json({
        quote,
        orders: orders.length,
        buyVolume,
        sellVolume,
        wallet,
        profit,
        profitPerc,
        startDate,
        endDate,
        subs,
        series,
        automations
    })
}

async function getMonthReport(req, res, next) {

    const quote = req.params.quote;

    let startDate = req.query.startDate ? parseInt(req.query.startDate) : thirtyDaysAgo();
    let endDate = req.query.endDate ? parseInt(req.query.endDate) : getToday();

    //permitir apenas 30 dias
    if ((endDate - startDate) > (31 * 24 * 60 * 60 * 1000)) startDate = thirtyDaysAgo();

    const orders = await ordersRepository.getReportOrders(quote, startDate, endDate);
    if (!orders || !orders.length) return res.json({...EMPTY_REPORT, quote, startDate, endDate});

    const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    const subs = [];
    const series = [];
    for (let i = 0; i < daysInRange; i++) {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + i);
        subs.push(`${newDate.getDate()}/${newDate.getMonth() + 1}`);

        const lastMoment = new Date(newDate.getTime())
        lastMoment.setHours(23, 59, 59, 999);

        const partialBuy = calcVolume(orders, 'BUY', newDate.getTime(), lastMoment.getTime());
        const partialSell = calcVolume(orders, 'SELL', newDate.getTime(), lastMoment.getTime());
        series.push(partialSell - partialBuy);
    }

    const buyVolume = calcVolume(orders, 'BUY');
    const sellVolume = calcVolume(orders, 'SELL');
    const profit = sellVolume - buyVolume;

    const wallet = beholder.getMemory(quote, 'WALLET');
    const profitPerc = (profit * 100) / (parseFloat(wallet) - profit);
    const automations = groupByAutomations(orders);

    res.json({
        quote,
        orders: orders.length,
        buyVolume,
        sellVolume,
        wallet,
        profit,
        profitPerc,
        startDate,
        endDate,
        subs,
        series,
        automations
    })
}

module.exports = {
    placeOrder,
    cancelOrder,
    getOrders,
    syncOrder,
    getLastOrders,
    getOrdersReport
}