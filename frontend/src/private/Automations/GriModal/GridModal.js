import React, { useRef, useState, useEffect } from 'react';
import SelectSymbol from '../../../components/SelectSymbol/SelectSymbol';
import SwitchInput from '../../../components/SwitchInput/SwitchInput';
import { saveGrid } from '../../../services/AutomationsService';
import { getSymbol } from '../../../services/SymbolsService';
import SymbolPrice from '../../../components/SymbolPrice/SymbolPrice';
import WalletSummary from '../../../components/WalletSummary/WalletSummary';
import { getMemoryIndex } from '../../../services/BeholderService';
import GridTable from './GridTable';
import '../Automations.css';

/**
 * props:
 * - data
 * - onSubmit
 */
function GridModal(props) {

    const [error, setError] = useState('');

    const DEFAULT_AUTOMATION = {
        conditions: '',
        name: '',
        indexes: '',
        actions: []
    }

    const [automation, setAutomation] = useState(DEFAULT_AUTOMATION);

    const DEFAULT_GRID = {
        lowerLimit: '',
        upperLimit: '',
        levels: '',
        quantity: ''
    }
    const [grid, setGrid] = useState(DEFAULT_GRID);

    useEffect(() => {
        if (!props.data || !props.data.grids) return;
        setAutomation(props.data);

        if (!props.data.id) return setGrid(DEFAULT_GRID);

        const conditionSplit = props.data.conditions.split(' && ');
        if (!conditionSplit || conditionSplit.length < 2) return;

        const quantity = props.data.grids[0].orderTemplate.quantity;
        setGrid({
            lowerLimit: parseFloat(conditionSplit[0].split('>')[1]),
            upperLimit: parseFloat(conditionSplit[1].split('<')[1]),
            levels: props.data.grids.length + 1,
            quantity: quantity === 'MIN_NOTIONAL' ? 'Min. Notional' : quantity
        });
    }, [props.data])

    const [symbol, setSymbol] = useState(false);
    useEffect(() => {
        if (!automation.symbol) return;

        setError('');
        const token = localStorage.getItem('token');
        getSymbol(automation.symbol, token)
            .then(result => setSymbol(result))
            .catch(err => {
                console.error(err.response ? err.response.data : err.message);
                setError(err.response ? err.response.data : err.message);
            })
    }, [automation.symbol])

    function onSymbolChange(event) {
        setAutomation({ ...DEFAULT_AUTOMATION, symbol: event.target.value });
    }

    const [wallet, setWallet] = useState({ base: { symbol: '', qty: 0 }, quote: { symbol: '', qty: 0 } });
    async function loadWallet(symbol) {
        const token = localStorage.getItem('token');

        try {
            const baseQty = await getMemoryIndex(symbol.base, 'WALLET', null, token);
            const quoteQty = await getMemoryIndex(symbol.quote, 'WALLET', null, token);
            setWallet({ base: { qty: baseQty, symbol: symbol.base }, quote: { qty: quoteQty, symbol: symbol.quote } });
        } catch (err) {
            console.log(err => err.response ? err.response.data : err.message);
            setError(err.message);
        }
    }

    useEffect(() => {
        if (!symbol || !symbol.base) return;
        loadWallet(symbol);
    }, [symbol])

    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {

        const modal = document.getElementById('modalGrid');
        modal.addEventListener('hidden.bs.modal', (event) => {
            setIsVisible(false);
            setGridView(false);
            setAutomation(DEFAULT_AUTOMATION);
        })
        modal.addEventListener('shown.bs.modal', (event) => {
            setIsVisible(true);
            setGridView(false);
        })

    }, [])

    const btnClose = useRef('');
    const btnSave = useRef('');
    const inputTotal = useRef('');

    async function onSubmit(event) {
        setError('');
        const token = localStorage.getItem('token');

        const { current } = await getMemoryIndex(symbol.symbol, 'BOOK', null, token);
        if (current) {
            const minNotional = parseFloat(symbol.minNotional);
            const minLotSize = parseFloat(symbol.minLotSize);
            const qty = parseFloat(grid.quantity);

            if (qty >= 0) {
                if (qty < minLotSize)
                    return setError('Min. Lot Size: ' + symbol.minLotSize);

                const ask = parseFloat(current.bestAsk);
                const bid = parseFloat(current.bestBid);
                if (qty * bid < minNotional
                    || qty * ask < minNotional)
                    return setError('Min. Notional: ' + symbol.minNotional);
            }
        }

        automation.name = `GRID ${automation.symbol} #${grid.levels}`;
        automation.actions = [{ type: 'GRID' }];
        automation.indexes = `${automation.symbol}:BOOK`;
        automation.conditions = `MEMORY['${automation.symbol}:BOOK'].current.bestAsk>${grid.lowerLimit} && MEMORY['${automation.symbol}:BOOK'].current.bestBid<${grid.upperLimit}`;

        saveGrid(automation.id, automation, grid.levels, grid.quantity, token)
            .then(result => {
                btnClose.current.click();
                if (props.onSubmit) props.onSubmit(result);
            })
            .catch(err => {
                console.error(err.response ? err.response.data : err.message);
                setError(err.response ? err.response.data : err.message);
            })
    }

    function onAutomationChange(event) {
        setAutomation(prevState => ({ ...prevState, [event.target.id]: event.target.value }));
    }

    function onGridChange(event) {
        const value = event.target.value === 'Min. Notional' ? 'MIN_NOTIONAL' : parseFloat(event.target.value);
        setGrid(prevState => ({ ...prevState, [event.target.id]: value }));
        if (event.target.id === 'quantity') {
            if (value < parseFloat(symbol.minLotSize)) {
                setError('Min. Lot Size: ' + symbol.minLotSize);
                btnSave.current.disabled = true;
            }
            else {
                btnSave.current.disabled = false;
                setError('');
            }
        }
    }

    function onPriceChange(book) {
        if (!grid.quantity || !book || !book.ask || !inputTotal.current) return;

        const qty = parseFloat(grid.quantity);
        const ask = parseFloat(book.ask);
        if (!ask) return;

        inputTotal.current.value = `${ask * qty}`.substring(0, 10);
    }

    const [gridView, setGridView] = useState(false)
    function onViewGridsClick(event) {
        setGridView(!gridView);
    }

    return (
        <div className="modal fade" id="modalGrid" tabIndex="-1" role="dialog" aria-labelledby="modalTitleNotify" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <p className="modal-title" id="modalTitleNotify">{props.data.id ? 'Edit ' : 'New '}Grid</p>
                        <button ref={btnClose} type="button" className="btn-close" data-bs-dismiss="modal" aria-label="close"></button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="symbol">Symbol:</label>
                                        <SelectSymbol onChange={onSymbolChange} symbol={automation.symbol} onlyFavorites={false} disabled={!!automation.id} />
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    {
                                        isVisible
                                            ? <SymbolPrice symbol={automation.symbol} onChange={onPriceChange} />
                                            : <React.Fragment></React.Fragment>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className={gridView ? "d-none" : "form-group"}>
                            <WalletSummary wallet={wallet} />
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="lowerLimit">Lower Limit:</label>
                                        <input className="form-control" id="lowerLimit" type="number" placeholder="0" defaultValue={grid.lowerLimit || ''} onChange={onGridChange} />
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="upperLimit">Upper Limit:</label>
                                        <input className="form-control" id="upperLimit" type="number" placeholder="0" defaultValue={grid.upperLimit || ''} onChange={onGridChange} />
                                    </div>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="levels">Levels:</label>
                                        <input className="form-control" id="levels" type="number" placeholder="3" defaultValue={grid.levels || ''} onChange={onGridChange} />
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="quantity">Quantity:</label>
                                        <input className="form-control" id="quantity" type="text" list="gridQtyList" placeholder={symbol.minLotSize} defaultValue={grid.quantity || ''} onChange={onGridChange} />
                                        <datalist id="gridQtyList">
                                            <option>Min. Notional</option>
                                        </datalist>
                                    </div>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <div className="form-group">
                                        <label htmlFor="total">Reference Price:</label>
                                        <input ref={inputTotal} className="form-control" id="total" type="number" placeholder="0" disabled />
                                    </div>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="form-group">
                                        <SwitchInput id="isActive" text="Is Active?" onChange={onAutomationChange} isChecked={automation.isActive} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="form-group">
                                        <SwitchInput id="logs" text="Enable Logs?" onChange={onAutomationChange} isChecked={automation.logs} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={gridView ? "form-group" : "d-none"}>
                            <GridTable data={automation.grids} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        {
                            error
                                ? <div className="alert alert-danger mt-1 py-1 col-9">{error}</div>
                                : <React.Fragment></React.Fragment>
                        }
                        {
                            automation.id
                                ?
                                <button type="button" className="btn btn-sm btn-secondary" onClick={onViewGridsClick}>
                                    {
                                        gridView
                                            ? (
                                                <svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                                </svg>
                                            )
                                            : (
                                                <svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                </svg>
                                            )
                                    }
                                </button>
                                : <React.Fragment></React.Fragment>
                        }
                        <button ref={btnSave} type="button" className="btn btn-sm btn-primary" onClick={onSubmit}>Save</button>
                    </div>
                </div>
            </div>
        </div >
    )
}

export default GridModal;
