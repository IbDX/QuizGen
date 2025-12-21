import React, { useEffect, useState } from 'react';
import { monitor, ApiStats } from '../services/monitor';

interface PerformanceDashboardProps {
    onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onClose }) => {
    const [report, setReport] = useState(monitor.getReport());
    const [ping, setPing] = useState<number | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setReport(monitor.getReport());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zplus_telemetry_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePing = async () => {
        setIsPinging(true);
        const latency = await monitor.measurePing();
        setPing(latency);
        setIsPinging(false);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const mem = report.system.memory;
    const conn = report.system.connection;
    const api = report.summary.apiStats;

    // Helper for Status Bars
    const StatusBar = ({ label, current, max, colorClass }: { label: string, current: number, max: number, colorClass: string }) => {
        const pct = Math.min(100, (current / max) * 100);
        return (
            <div className="w-full">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-mono uppercase">
                    <span>{label}</span>
                    <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    <div 
                        className={`h-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${pct}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in font-mono">
            <div className="bg-[#0c0c0c] border border-terminal-green w-full max-w-5xl h-[90vh] flex flex-col rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.15)] relative overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-terminal-green/30 bg-[#111]">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-terminal-green rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,65,0.8)]"></div>
                        <div>
                            <h3 className="font-bold text-sm md:text-base text-terminal-green tracking-widest leading-none">SYSTEM DIAGNOSTICS</h3>
                            <span className="text-[10px] text-gray-500 uppercase">Telemetry Stream: ACTIVE</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors px-2 font-bold">ESC</button>
                </div>

                {/* Main Grid */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* 1. NEURAL LINK (API STATS) */}
                    <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                        <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center group-hover:text-terminal-green">
                            <span>NEURAL LINK STATUS</span>
                            <span className={api.errors > 0 ? "text-red-500" : "text-green-500"}>{api.errors > 0 ? "UNSTABLE" : "STABLE"}</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center p-2 bg-black rounded border border-gray-800">
                                <div className="text-2xl font-bold text-white">{api.success}</div>
                                <div className="text-[9px] text-gray-500 uppercase">Successful Ops</div>
                            </div>
                            <div className="text-center p-2 bg-black rounded border border-gray-800">
                                <div className={`text-2xl font-bold ${api.errors > 0 ? 'text-red-500' : 'text-gray-400'}`}>{api.errors}</div>
                                <div className="text-[9px] text-gray-500 uppercase">Failures</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Success Rate</span>
                                <span>{api.total > 0 ? Math.round((api.success / api.total) * 100) : 100}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${api.total > 0 ? (api.success / api.total) * 100 : 100}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                                <span>Avg Latency</span>
                                <span className="text-white">{report.summary.avgLatency} ms</span>
                            </div>
                            {api.rateLimited > 0 && (
                                <div className="bg-red-900/20 border border-red-900/50 text-red-500 text-[10px] p-2 rounded text-center animate-pulse mt-2">
                                    ⚠️ QUOTA EXHAUSTED ({api.rateLimited} EVENTS)
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. MEMORY & STORAGE */}
                    <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                        <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2 group-hover:text-terminal-green">MEMORY CORE</h4>
                        <div className="space-y-4">
                            {/* Local Storage */}
                            <StatusBar 
                                label={`Local Storage (${formatBytes(report.storage.used)})`} 
                                current={report.storage.used} 
                                max={report.storage.total} 
                                colorClass={report.storage.percentage > 80 ? "bg-red-500" : "bg-purple-500"} 
                            />
                            
                            {/* JS Heap (Chrome Only) */}
                            {mem ? (
                                <StatusBar 
                                    label={`JS Heap (${formatBytes(mem.usedJSHeapSize)})`} 
                                    current={mem.usedJSHeapSize} 
                                    max={mem.jsHeapSizeLimit} 
                                    colorClass="bg-terminal-green" 
                                />
                            ) : (
                                <div className="text-[10px] text-gray-600 italic text-center p-2 border border-dashed border-gray-800 rounded">
                                    Advanced Memory Metrics Unavailable (Non-Chromium Browser)
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 mt-2">
                                <div>Logs Buffered: {report.summary.totalLogs}</div>
                                <div>Interactions: {report.summary.interactionCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* 3. NETWORK UPLINK */}
                    <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                            <h4 className="text-xs font-bold text-gray-400 group-hover:text-terminal-green">NETWORK UPLINK</h4>
                            <button 
                                onClick={handlePing}
                                disabled={isPinging}
                                className="text-[9px] px-2 py-1 border border-terminal-green text-terminal-green rounded hover:bg-terminal-green hover:text-black disabled:opacity-50 transition-colors"
                            >
                                {isPinging ? 'PINGING...' : 'TEST SIGNAL'}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-2 bg-black rounded border border-gray-800">
                                <div className="text-[9px] text-gray-500 uppercase mb-1">Downlink</div>
                                <div className="text-lg font-bold text-white">
                                    {conn ? `${conn.downlink} Mbps` : 'N/A'}
                                </div>
                            </div>
                            <div className="p-2 bg-black rounded border border-gray-800">
                                <div className="text-[9px] text-gray-500 uppercase mb-1">Effective Type</div>
                                <div className="text-lg font-bold text-white uppercase">
                                    {conn ? conn.effectiveType : 'Unknown'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Signal Latency (RTT)</span>
                            <div className="text-right">
                                {ping !== null ? (
                                    <span className={`text-xl font-bold font-mono ${ping < 100 ? 'text-green-500' : ping < 300 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {ping} ms
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-600">--</span>
                                )}
                                {conn && conn.rtt && ping === null && (
                                    <div className="text-[9px] text-gray-600">Est: ~{conn.rtt}ms</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 4. ENVIRONMENT INFO */}
                    <div className="lg:col-span-2 bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                        <h4 className="text-xs font-bold text-gray-400 mb-2 group-hover:text-terminal-green">CLIENT ENVIRONMENT</h4>
                        <div className="bg-black p-3 rounded border border-gray-800 font-mono text-[10px] text-gray-500 break-all leading-relaxed">
                            <div>User Agent: <span className="text-gray-300">{navigator.userAgent}</span></div>
                            <div className="mt-2 flex gap-4">
                                <span>Res: <span className="text-gray-300">{window.screen.width}x{window.screen.height}</span></span>
                                <span>Ratio: <span className="text-gray-300">{window.devicePixelRatio}x</span></span>
                                <span>Cores: <span className="text-gray-300">{navigator.hardwareConcurrency || '?'}</span></span>
                                <span>Touch: <span className="text-gray-300">{navigator.maxTouchPoints > 0 ? 'Yes' : 'No'}</span></span>
                            </div>
                        </div>
                    </div>

                    {/* 5. LIVE LOGS (Bottom Panel) */}
                    <div className="lg:col-span-3 bg-[#111] border border-gray-800 rounded flex flex-col h-64 hover:border-terminal-green/50 transition-colors group">
                         <div className="p-2 bg-black border-b border-gray-800 text-[10px] font-bold text-gray-400 flex justify-between items-center group-hover:text-terminal-green">
                             <span>LIVE TELEMETRY LOG</span>
                             <span className="text-gray-600">{report.logs.length} events</span>
                         </div>
                         <div className="flex-grow overflow-y-auto p-2 font-mono text-[10px] space-y-1 custom-scrollbar bg-black">
                            {report.logs.slice().reverse().slice(0, 50).map((log, i) => (
                                <div key={i} className="flex gap-2 border-b border-gray-900/50 pb-1 last:border-0 hover:bg-[#151515] px-1">
                                    <span className="text-gray-600 w-16">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, second: '2-digit', fractionalSecondDigits: 2} as any)}</span>
                                    <span className={`w-20 font-bold ${
                                        log.type === 'API_LATENCY' ? 'text-blue-400' : 
                                        log.type === 'STORAGE_USAGE' ? 'text-purple-400' : 
                                        'text-gray-400'
                                    }`}>{log.type.split('_')[0]}</span>
                                    <span className="text-gray-300 flex-grow truncate">{log.label}</span>
                                    {log.value !== undefined && (
                                        <span className={`w-12 text-right ${log.type === 'API_LATENCY' && log.value > 2000 ? 'text-yellow-500' : 'text-gray-500'}`}>
                                            {log.value > 1000 && log.type !== 'STORAGE_USAGE' ? (log.value/1000).toFixed(1)+'s' : log.value}
                                        </span>
                                    )}
                                </div>
                            ))}
                         </div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-terminal-green/30 bg-[#111] flex justify-between items-center shrink-0">
                    <div className="text-[10px] text-gray-600 hidden md:block">
                        SESSION ID: {report.generatedAt.split('T')[1].replace('Z', '')}
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => monitor.clear()} 
                            className="px-4 py-2 border border-red-900/50 text-red-500 hover:bg-red-900/20 text-xs font-bold rounded transition-colors"
                        >
                            CLEAR LOGS
                        </button>
                        <button 
                            onClick={handleExport}
                            className="px-6 py-2 bg-terminal-green text-black hover:bg-terminal-dimGreen text-xs font-bold rounded shadow-[0_0_10px_rgba(0,255,65,0.3)] transition-colors"
                        >
                            EXPORT REPORT
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};