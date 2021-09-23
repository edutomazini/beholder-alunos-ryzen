import axios from './BaseService';

const BEHOLDER_URL = `${process.env.REACT_APP_API_URL}/beholder/`;

export async function getIndexes(token) {
    const headers = { 'authorization': token };
    const response = await axios.get(BEHOLDER_URL + 'memory/indexes', { headers });
    return response.data;
}

export async function getAnalysisIndexes(token){
    const headers = { 'authorization': token };
    const response = await axios.get(`${BEHOLDER_URL}analysis/`, { headers });
    return response.data;
}

export async function getMemoryIndex(symbol, index, interval, token) {
    const headers = { 'authorization': token };
    const response = await axios.get(`${BEHOLDER_URL}memory/${symbol}/${index}/${interval ? interval : ''}`, { headers });
    return response.data;
}