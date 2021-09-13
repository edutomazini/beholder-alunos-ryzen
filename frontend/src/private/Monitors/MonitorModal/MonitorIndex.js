import React, { useState, useRef, useEffect } from 'react';
import SmartBadge from '../../../components/SmartBadge/SmartBadge';

/**
 * props:
 * - indexes
 * - onChange
 */
function MonitorIndex(props) {

    const btnAddIndex = useRef('');

    const [indexes, setIndexes] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState('');

    useEffect(() => {
        setIndexes(props.indexes ? props.indexes.split(',') : []);
    }, [props.indexes])

    function onAddIndexClick(event) {
        if (selectedIndex !== 'NONE' && indexes.indexOf(selectedIndex) === -1) {
            indexes.push(selectedIndex);

            setSelectedIndex('NONE');
            setIndexes(indexes);
            if (props.onChange) props.onChange({ target: { id: 'indexes', value: indexes.join(',') } });
        }
    }

    function btnRemoveIndex(event) {
        const id = event.target.id.replace('ix', '');
        const pos = indexes.findIndex(ix => ix === id);
        indexes.splice(pos, 1);
        setIndexes(indexes);
        if (props.onChange) props.onChange({ target: { id: 'indexes', value: indexes.join(',') } });
    }

    function onIndexChange(event) {
        setSelectedIndex(event.target.value);
        if (event.target.value === 'NONE') return;
    }

    return (
        <React.Fragment>
            <div className="row">
                <div className="col-12 mb-3">
                    <div className="form-group">
                        <label htmlFor="side">Indexes:</label>
                        <div className="input-group input-group-merge">
                            <select id="type" className="form-select" defaultValue="NONE" onChange={onIndexChange}>
                                <option value="NONE">None</option>
                                <option value="MACD">MACD</option>
                                <option value="RSI">RSI</option>
                            </select>
                            <button type="button" className="btn btn-secondary" ref={btnAddIndex} onClick={onAddIndexClick}>
                                <svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="divScrollBadges">
                <div className="d-inline-flex align-content-start">
                    {
                        indexes.map(ix => (
                            <SmartBadge key={ix} id={"ix" + ix} text={ix} onClick={btnRemoveIndex} />
                        ))
                    }
                </div>
            </div>
        </React.Fragment>
    );
}

export default MonitorIndex;
