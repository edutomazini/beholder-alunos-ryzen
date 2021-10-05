import React, { useEffect, useState } from 'react';

/**
 * props:
 * - onChange
 * - date
 * - onClick
 */
function DateTime(props) {
    const [dateTime, setDateTime] = useState({
        date: '',
        hours: '',
        minutes: ''
    });

    useEffect(() => {
        if (!props.date) return;
        const dt = new Date(props.date);
        setDateTime({
            date: new Intl.DateTimeFormat('en-GB').format(dt),
            hours: dt.getHours() > 9 ? `${dt.getHours()}` : `0${dt.getHours()}`,
            minutes: dt.getMinutes() > 9 ? `${dt.getMinutes()}` : `0${dt.getMinutes()}`
        });
    }, [props.date])

    function parseDate(dateTime){
        const split = dateTime.date.split('/');
        const newDate = new Date(`${split[1]}/${split[0]}/${split[2]}`);
        newDate.setHours(parseInt(dateTime.hours));
        newDate.setMinutes(parseInt(dateTime.minutes));
        newDate.setSeconds(0);
        return newDate;
    }

    function onInputChange(event) {
        dateTime[event.target.id] = event.target.value;
        setDateTime(prevState => ({ ...prevState, [event.target.id]: event.target.value }));
        props.onChange({target: {id: 'date', value: parseDate(dateTime)}});
    }

    return (
        <div className="input-group input-group-merge">
            <button type="button" onClick={props.onClick} className="btn btn-secondary">
                <svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
            </button>
            <input type="text" data-datepicker="" className="form-control datepicker-input" id="date" defaultValue={dateTime.date} placeholder="dd/mm/yyyy" onChange={onInputChange} />
            <span className="input-group-text bg-secondary">at</span>
            <input type="number" className="form-control" id="hours" defaultValue={dateTime.hours} placeholder="00" onChange={onInputChange} maxLength="2" />
            <span className="input-group-text bg-secondary">:</span>
            <input type="number" className="form-control" id="minutes" defaultValue={dateTime.minutes} placeholder="00" onChange={onInputChange} maxLength="2" />
        </div>
    )
}

export default DateTime;
