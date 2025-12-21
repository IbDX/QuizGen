
import React, { useEffect, useState } from 'react';
import { monitor } from '../services/monitor';

interface PerformanceDashboardProps {
    onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onClose }) => {
    const [report, setReport] = useState(monitor.getReport());
    
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
        a.download = `zplus_debug_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0c0c0c] border-2 border-terminal-green w-full max-w-2xl h-[80vh] flex flex-col rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.2)]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-terminal-green/30 bg-[#111]">
                    <div className="flex items-center gap-2 text-terminal-green">
                        <span className="animate-pulse">⚡</span>
                        <h3 className="font-bold font-mono tracking-widest">SYSTEM DIAGNOSTICS</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6 font-mono text-xs md:text-sm">
                    
                    {/* Storage Metric */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-gray-400">
                            <span>LOCAL STORAGE QUOTA</span>
                            <span>{report.storage.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div 
                                className={`h-full transition-all duration-500 ${report.storage.percentage > 80 ? 'bg-red-500' : 'bg-terminal-green'}`}
                                style={{ width: `${report.storage.percentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>USED: {(report.storage.used / 1024).toFixed(1)} KB</span>
                            <span>MAX: {(report.storage.total / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>

                    {/* Latency Metric */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#151515] p-4 border border-gray-800 rounded">
                            <div className="text-gray-500 mb-1">AVG LATENCY (GEMINI)</div>
                            <div className="text-2xl font-bold text-white">
                                {report.summary.avgLatency} <span className="text-sm text-gray-500">ms</span>
                            </div>
                        </div>
                        <div className="bg-[#151515] p-4 border border-gray-800 rounded">
                            <div className="text-gray-500 mb-1">USER INTERACTIONS</div>
                            <div className="text-2xl font-bold text-white">
                                {report.summary.interactionCount} <span className="text-sm text-gray-500">clicks</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Logs Table */}
                    <div className="border border-gray-800 rounded bg-[#0a0a0a] overflow-hidden">
                         <div className="p-2 bg-[#151515] border-b border-gray-800 text-gray-400 font-bold">RECENT TELEMETRY</div>
                         <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-600 border-b border-gray-800">
                                        <th className="p-2">TIME</th>
                                        <th className="p-2">TYPE</th>
                                        <th className="p-2">LABEL</th>
                                        <th className="p-2 text-right">VAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.logs.slice().reverse().slice(0, 20).map((log, i) => (
                                        <tr key={i} className="border-b border-gray-900 hover:bg-[#1a1a1a] transition-colors text-gray-400">
                                            <td className="p-2 whitespace-nowrap opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                            <td className="p-2">
                                                <span className={`px-1 rounded text-[10px] ${log.type === 'API_LATENCY' ? 'bg-blue-900 text-blue-300' : log.type === 'STORAGE_USAGE' ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-300'}`}>
                                                    {log.type.split('_')[0]}
                                                </span>
                                            </td>
                                            <td className="p-2 truncate max-w-[150px]">{log.label}</td>
                                            <td className="p-2 text-right text-white font-bold">{log.value || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-terminal-green/30 bg-[#111] flex justify-end gap-3">
                    <button 
                        onClick={() => monitor.clear()} 
                        className="px-4 py-2 border border-red-900 text-red-500 hover:bg-red-900/20 text-xs font-bold rounded"
                    >
                        CLEAR LOGS
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 bg-terminal-green text-black hover:bg-terminal-dimGreen text-xs font-bold rounded"
                    >
                        EXPORT JSON
                    </button>
                </div>
            </div>
        </div>
    );
};
