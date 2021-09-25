import React, { useRef, useState, useEffect } from 'react';

export const DEFAULT_WITHDRAW_TEMPLATE = {
    name: ''
}

/**
 * props:
 * - data
 * - onSubmit
 */
function WithdrawTemplateModal(props) {

    const [error, setError] = useState('');

    const [withdrawTemplate, setWithdrawTemplate] = useState(DEFAULT_WITHDRAW_TEMPLATE);

    const btnClose = useRef('');
    const btnSave = useRef('');

    useEffect(() => {
        
    }, [])

    function onSubmit(event) {
        const token = localStorage.getItem('token');
        
    }

    function onInputChange(event) {
        setWithdrawTemplate(prevState => ({ ...prevState, [event.target.id]: event.target.value }));
    }

    useEffect(() => {
        setError('');
        setWithdrawTemplate(props.data);
    }, [props.data])

    return (
        <div className="modal fade" id="modalWithdrawTemplate" tabIndex="-1" role="dialog" aria-labelledby="modalTitleNotify" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <p className="modal-title" id="modalTitleNotify">{withdrawTemplate.id ? "Edit" : "New"} Withdraw Template</p>
                        <button ref={btnClose} type="button" className="btn-close" data-bs-dismiss="modal" aria-label="close"></button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            
                        </div>
                    </div>
                    <div className="modal-footer">
                        {
                            error
                                ? <div className="alert alert-danger mt-1 col-9 py-1">{error}</div>
                                : <React.Fragment></React.Fragment>
                        }
                        <button ref={btnSave} type="button" className="btn btn-sm btn-primary" onClick={onSubmit}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WithdrawTemplateModal;
