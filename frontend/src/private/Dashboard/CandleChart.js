import React, { useState, useMemo, useEffect } from 'react';
import './Dashboard.css';

/**
 * props:
 * - symbol
 */
function CandleChart(props) {

    // eslint-disable-next-line
    const [widget, setWidget] = useState({});
//https://br.tradingview.com/widget/advanced-chart/
    useEffect(() => {
        const w = new window.TradingView.widget({
            symbol: "BINANCE:" + props.symbol,
            autosize: true,
            interval: "5",
            timezone: "America/Sao_Paulo",
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#f1f3f6",
            enable_publishing: false,
            allow_symbol_change: true,
            details: true,
            withdateranges: true,
            hide_side_toolbar: false,
            studies: [{ id: "BB@tv-basicstudies", inputs: { length: 20, stddev: 2 } },
              {
                id: "RSI@tv-basicstudies",
                inputs: {
                 length: 14
                }
              }
            ],
            container_id: "tradingview_d34df"
        });
        setWidget(w);
    }, [props.symbol])

    const widgetHtml = useMemo(() => {
        return (
            <div className="row">
                <div className="col-12 mb-4">
                    <div className="card cardDark border-0 shadow" style={{height: 520}}>
                        <div className="card-body p-2" >
                            <div className="tradingview-widget-container">
                                <div id="tradingview_d34df" className="divTradingView"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }, [props.symbol])

    return widgetHtml;
}

export default CandleChart;