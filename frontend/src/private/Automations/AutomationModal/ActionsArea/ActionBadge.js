import React from 'react';
import SmartBadge from '../../../../components/SmartBadge/SmartBadge';

/**
 * props:
 * - action
 * - onClick
 */
function ActionBadge(props) {

    function renderBadge(actionType) {
        let image, text = '';
        if (actionType === 'ALERT_EMAIL') {
            image = (<svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>)
        }
        else if (actionType === 'ALERT_SMS')
            image = (<svg className="icon icon-xs" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>);
        else if (actionType === 'ORDER') {
            text = props.action.orderTemplateName || props.action.orderTemplate.name;
            image = (<svg className="icon icon-xs me-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"></path>
                <path fillRule="evenodd"
                    d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                    clipRule="evenodd"></path>
            </svg>)
        }

        return (
            <SmartBadge id={props.action.id} text={text} onClick={props.onClick}>
                {image}
            </SmartBadge>
        )
    }

    return renderBadge(props.action.type);
}

export default ActionBadge;