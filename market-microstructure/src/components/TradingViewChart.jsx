import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, AreaSeries, LineSeries } from 'lightweight-charts';

export const TradingViewChart = forwardRef(({
    colors: {
        backgroundColor = '#0a0f0a',
        lineColor = '#00ff7f',
        textColor = '#00ff7f',
        areaTopColor = 'rgba(0, 255, 127, 0.4)',
        areaBottomColor = 'rgba(0, 255, 127, 0.0)',
    } = {}, // Keep default empty object
    data = [] // Accept data prop
}, ref) => {
    const chartContainerRef = useRef();
    const chartRef = useRef();
    const seriesRef = useRef();
    const micropriceSeriesRef = useRef();
    const indexRef = useRef(0);
    const timesMapRef = useRef(new Map());

    // Helper for internal use (and useImperativeHandle)
    // Defined before usage
    const handleSetData = (dataPoints) => {
        if (seriesRef.current) {
            indexRef.current = 0;
            timesMapRef.current.clear();

            const formatted = dataPoints.map((d, i) => {
                const index = i + 1;
                timesMapRef.current.set(index, d.timestamp);
                return {
                    time: index,
                    value: d.mid_price
                };
            });

            seriesRef.current.setData(formatted);
            indexRef.current = formatted.length;

            if (micropriceSeriesRef.current) {
                const mpFormatted = dataPoints.map((d, i) => ({
                    time: i + 1,
                    value: d.microprice
                })).filter(d => d.value);
                micropriceSeriesRef.current.setData(mpFormatted);
            }
        }
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        update: (dataPoint) => {
            if (seriesRef.current) {
                const index = ++indexRef.current;

                // Store timestamp for tooltip/axis
                timesMapRef.current.set(index, dataPoint.timestamp);

                const point = {
                    time: index,
                    value: dataPoint.mid_price
                };
                seriesRef.current.update(point);

                if (micropriceSeriesRef.current && dataPoint.microprice) {
                    micropriceSeriesRef.current.update({
                        time: index,
                        value: dataPoint.microprice
                    });
                }
            }
        },
        setData: handleSetData,
        reset: () => {
            if (seriesRef.current) seriesRef.current.setData([]);
            if (micropriceSeriesRef.current) micropriceSeriesRef.current.setData([]);
            indexRef.current = 0;
            timesMapRef.current.clear();
        }
    }));

    // Effect for data prop changes (Reactive)
    useEffect(() => {
        if (data && data.length > 0 && seriesRef.current) {
            handleSetData(data);
        }
    }, [data]);

    // Initialize Chart
    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
                fontFamily: "'Orbitron', monospace",
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
                borderColor: 'rgba(0, 255, 127, 0.1)',
                tickMarkFormatter: (time) => {
                    const ts = timesMapRef.current.get(time);
                    if (!ts) return '';
                    const date = new Date(ts);
                    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                },
            },
            localization: {
                timeFormatter: (time) => {
                    const ts = timesMapRef.current.get(time);
                    if (!ts) return '';
                    const date = new Date(ts);
                    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
                }
            },
            rightPriceScale: {
                borderColor: 'rgba(0, 255, 127, 0.1)',
            },
            grid: {
                vertLines: { color: 'rgba(0, 255, 127, 0.05)' },
                horzLines: { color: 'rgba(0, 255, 127, 0.05)' },
            },
            crosshair: {
                mode: 1, // Magnet
                vertLine: {
                    color: 'rgba(0, 255, 127, 0.4)',
                    labelBackgroundColor: '#00ff7f',
                },
                horzLine: {
                    color: 'rgba(0, 255, 127, 0.4)',
                    labelBackgroundColor: '#00ff7f',
                },
            },
        });

        const newSeries = chart.addSeries(AreaSeries, {
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 2,
        });

        const newMicropriceSeries = chart.addSeries(LineSeries, {
            color: '#ff3232',
            lineWidth: 1,
            lineStyle: 1, // Dotted
        });

        seriesRef.current = newSeries;
        micropriceSeriesRef.current = newMicropriceSeries;
        chartRef.current = chart;

        // Apply initial data if available via prop
        if (data && data.length > 0) {
            handleSetData(data);
        }

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [backgroundColor, lineColor, textColor, areaTopColor, areaBottomColor]); // Keep data out of dep array here, handled by separate effect

    return (
        <div style={{
        transform: "scale(0.8)",
        transformOrigin: "top left",
        width: "124%",
        height: "125%",
      }}>
            {/* <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 700, color: '#00ff7f', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'Orbitron', monospace", textShadow: '0 0 10px rgba(0, 255, 127, 0.3)' }}>Live Price Action</h4> */}
            <div ref={chartContainerRef} style={{ width: '100%', height: 'calc(100% - 30px)' }} />
        </div>
    );
});
