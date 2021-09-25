import React, { useEffect, useState } from 'react';

/**
 * props:
 * - onChange
 * - date
 * - onClick
 */
function DateTime(props) {
    const [date, setDate] = useState();

    useEffect(() => {
        if (!props.date) return;
        setDate(new Date(props.date));
    }, [props.date])

    useEffect(() => {
        return new window.Datepicker(document.getElementById("date"), {
            buttonClass: 'btn',
            format: 'dd/mm/yyyy'
        });
    }, [])

    function getDate() {
        return new Intl.DateTimeFormat('en-GB').format(date);
    }

    function getHour() {
        if (!date) return '';
        const hours = date.getHours();
        return hours > 9 ? `${hours}` : `0${hours}`;
    }

    function getMinute() {
        if (!date) return '';
        const minutes = date.getMinutes();
        return minutes > 9 ? `${minutes}` : `0${minutes}`;
    }

    function parseDate(str) {
        const split = str.split('/');
        return new Date(`${split[1]}/${split[0]}/${split[2]}`);
    }

    function onDateChange(event) {
        const newDate = parseDate(event.target.value);
        newDate.setHours(date ? date.getHours() : 0);
        newDate.setMinutes(date ? date.getMinutes() : 0);
        newDate.setSeconds(0);
        props.onChange({ target: { id: 'date', value: newDate } });
    }

    function onHourChange(event) {
        let hours = parseInt(event.target.value);
        if (hours > 23) hours = 23;

        const newDate = new Date(date ? date.getTime() : Date.now());
        newDate.setHours(hours);
        props.onChange({ target: { id: 'date', value: newDate } });
    }

    function onMinuteChange(event) {
        let minutes = parseInt(event.target.value);
        if (minutes > 59) minutes = 59;

        const newDate = new Date(date.getTime());
        newDate.setMinutes(minutes);
        props.onChange({ target: { id: 'date', value: newDate } });
    }

    return (
        <div className="input-group input-group-merge">
            <button type="button" onClick={props.onClick} className="btn btn-secondary">
                <svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
            </button>
            <input data-datepicker="" className="form-control datepicker-input" id="date" defaultValue={getDate()} type="text" placeholder="dd/mm/yyyy" onChange={onDateChange} />
            <span className="input-group-text bg-secondary">at</span>
            <input className="form-control" id="hour" type="number" placeholder="00" defaultValue={getHour()} onChange={onHourChange} maxLength="2" max="23" step="1" />
            <span className="input-group-text bg-secondary">:</span>
            <input className="form-control" id="minute" type="number" placeholder="00" defaultValue={getMinute()} onChange={onMinuteChange} maxLength="2" max="59" step="1" />
        </div>
    )
}

export default DateTime;
