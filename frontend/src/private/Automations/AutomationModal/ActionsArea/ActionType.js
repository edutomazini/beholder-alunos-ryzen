import React, { useEffect, useState } from 'react';

/**
 * props:
 * - type
 * - onChange
 */
function ActionType(props) {

    const [type, setType] = useState('');

    useEffect(() => {
        setType(props.type);
    }, [props.type])

    return (
        <select id="type" className="form-select" defaultValue={type} onChange={props.onChange}>
            <option value="ALERT_EMAIL">Alert via Email</option>
            <option value="ALERT_SMS">Alert via SMS</option>
            <option value="ORDER">Place Order</option>
        </select>
    )
}

export default ActionType;