import axios from './BaseService';

const ORDERS_URL = `${process.env.REACT_APP_API_URL}/orders/`;
const { STOP_TYPES } = require('./ExchangeService');

export async function getOrders(symbol, page, token) {
    const ordersUrl = `${ORDERS_URL}${symbol}?page=${page}`;

    const headers = { 'authorization': token };
    const response = await axios.get(ordersUrl, { headers });
    return response.data;//{count, rows}
}

export async function cancelOrder(symbol, orderId, token) {
    const headers = { 'authorization': token };
    const response = await axios.delete(`${ORDERS_URL}${symbol}/${orderId}`, { headers });
    return response.data;
}

export async function syncOrder(beholderOrderId, token) {
    const headers = { 'authorization': token };
    const response = await axios.post(`${ORDERS_URL}${beholderOrderId}/sync`, null, { headers });
    return response.data;
}

export async function placeOrder(order, token) {
    const postOrder = {
        symbol: order.symbol.toUpperCase(),
        quantity: order.quantity,
        side: order.side.toUpperCase(),
        type: order.type.toUpperCase()
    }

    if (order.type !== "MARKET") postOrder.price = order.price;
    else if (order.type === "ICEBERG") postOrder.options = { icebergQty: order.icebergQty };
    else if (STOP_TYPES.indexOf(order.type) !== -1) postOrder.options = { stopPrice: order.stopPrice, type: postOrder.type };

    const headers = { 'authorization': token };
    const response = await axios.post(ORDERS_URL, postOrder, { headers });
    return response.data;
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

export async function getOrdersReport(symbol, startDate, endDate, token) {
    startDate = startDate ? startDate.getTime() : thirtyDaysAgo();
    endDate = endDate ? endDate.getTime() : getToday();

    const reportUrl = `${ORDERS_URL}reports/${symbol}?startDate=${startDate}&endDate=${endDate}`;
    const headers = { 'authorization': token };
    const response = await axios.get(reportUrl, { headers });
    return response.data;
}

export async function getDayTradeReport(symbol, date, token) {
    date = date ? date.getTime() : getStartToday();

    const reportUrl = `${ORDERS_URL}reports/${symbol}?date=${date}`;
    const headers = { 'authorization': token };
    const response = await axios.get(reportUrl, { headers });
    return response.data;
}
