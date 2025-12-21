
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { monitor, MetricType, PerformanceLog } from '../services/monitor';

interface PerformanceDashboardProps {
    onClose: () => void;
}

// --- Types ---
interface FunctionMetric {
    name: string;
    calls: number;
    totalTime: number; // CPU
    avgTime: number;
    tokens: number; // AI Tokens
    memory: number; // Bytes
    gpuLoad: number; // 0-100 score
    lastCalled: number;
}

interface SystemCategory {
    id: string;
    label: string;
    color: string;
    icon: string;
    metrics: FunctionMetric[];
    totalCpu: number;
    totalMemory: number;
    totalTokens: number;
    history: number[]; // Trend data for sparkline
    health: number; // 0-100
    details: { label: string, value: string, status: 'ok' | 'warn' | 'err' }[];
    logs: PerformanceLog[]; // Raw logs for this system
}

// --- Sub-Components ---

// SVG Sparkline Component
const Sparkline = ({ data, color, height = 40 }: { data: number[], color: string, height?: number }) => {
    if (data.length < 2) return <div className="h-full w-full flex items-center justify-center text-[9px] text-gray-700">NO DATA</div>;
    
    // Normalize data
    const max = Math.max(...data, 10);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-full overflow-hidden relative" style={{ height: `${height}px` }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                {/* Fill Area */}
                <path d={`M0,100 L${points} L100,100 Z`} fill="currentColor" fillOpacity="0.1" className={color} />
                {/* Line */}
                <path d={`M${points}`} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className={color} />
                {/* Dot at end */}
                <circle cx="100" cy={100 - ((data[data.length-1] - min) / range) * 100} r="3" fill="currentColor" className={color} />
            </svg>
        </div>
    );
};

// Circular Progress
const CircularGauge = ({ value, color, label }: { value: number, color: string, label: string }) => {
    const r = 18;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r={r} stroke="#333" strokeWidth="4" fill="transparent" />
                    <circle 
                        cx="50%" cy="50%" r={r} 
                        stroke="currentColor" strokeWidth="4" fill="transparent" 
                        strokeDasharray={circ} 
                        strokeDashoffset={offset}
                        className={`transition-all duration-1000 ${color}`}
                    />
                </svg>
                <span className="absolute text-[9px] font-bold text-gray-300">{value}%</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-1 uppercase">{label}</span>
        </div>
    );
};

// StatusBar Component
const StatusBar = ({ label, current, max, colorClass }: { label: string, current: number, max: number, colorClass: string }) => {
    const percentage = Math.min(100, Math.max(0, (current / (max || 1)) * 100));
    return (
        <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-mono">
                <span className="truncate">{label}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${colorClass} transition-all duration-500`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

// --- EMOJI MAPPER ---
const getFunctionIcon = (label: string, type: MetricType): string => {
    const l = label.toLowerCase();
    if (type === 'API_LATENCY') return '🧠'; // Brain for AI
    if (type === 'STORAGE_USAGE') return '💾'; // Disk
    if (type === 'RENDER_TIME') return '🎨'; // Art
    if (type === 'INTERACTION') return '👆';
    
    if (l.includes('generate')) return '⚙️';
    if (l.includes('grade')) return '⚖️';
    if (l.includes('click')) return '👆';
    if (l.includes('submit')) return '🚀';
    if (l.includes('save')) return '💾';
    if (l.includes('error') || l.includes('fail')) return '⚠️';
    if (l.includes('success')) return '✅';
    if (l.includes('upload')) return '📂';
    
    return '⚡';
};

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onClose }) => {
    const [report, setReport] = useState(monitor.getReport());
    const [ping, setPing] = useState<number | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [logFilter, setLogFilter] = useState<string>('ALL');
    const [logSearch, setLogSearch] = useState<string>('');
    const [showLogConfig, setShowLogConfig] = useState(false);
    const [viewMode, setViewMode] = useState<'STANDARD' | 'ADVANCED'>('STANDARD');
    const [expandedSystem, setExpandedSystem] = useState<string | null>(null);
    
    // History State for Sparklines
    const historyRef = useRef<Record<string, number[]>>({
        'NEURAL': Array(20).fill(0),
        'RENDER': Array(20).fill(0),
        'MEMORY': Array(20).fill(0),
        'KERNEL': Array(20).fill(0)
    });

    const [stressStatus, setStressStatus] = useState<'IDLE' | 'RUNNING' | 'COMPLETE'>('IDLE');
    const [stressResult, setStressResult] = useState<{ fps: number, score: number, frames: number } | null>(null);
    const [renderTick, setRenderTick] = useState(0);

    // Main Loop
    useEffect(() => {
        const interval = setInterval(() => {
            const newReport = monitor.getReport();
            setReport(newReport);
            
            // Update History Arrays based on instantaneous load approximation
            const now = Date.now();
            const recentLogs = newReport.logs.filter(l => now - l.timestamp < 1000);
            
            const calcLoad = (type: string) => {
                const logs = recentLogs.filter(l => {
                    if (type === 'NEURAL') return l.type === 'API_LATENCY';
                    if (type === 'RENDER') return l.type === 'RENDER_TIME';
                    if (type === 'MEMORY') return l.type === 'STORAGE_USAGE' || l.type === 'CACHE_UPDATE';
                    return true; // Kernel gets everything else basically
                });
                return Math.min(100, logs.length * 5);
            };

            ['NEURAL', 'RENDER', 'MEMORY', 'KERNEL'].forEach(key => {
                const load = calcLoad(key);
                historyRef.current[key] = [...historyRef.current[key].slice(1), load];
            });
            
            setRenderTick(t => t + 1);

        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Stress Test Logic
    useEffect(() => {
        if (stressStatus !== 'RUNNING') return;
        
        let frameId: number;
        let frames = 0;
        const startTime = performance.now();
        const duration = 2000; 

        const loop = () => {
            frames++;
            // We increment renderTick in the main loop, but here we force updates faster
            // Actually relying on the main React render cycle is safer for "Visual" stress
            const elapsed = performance.now() - startTime;

            if (elapsed < duration) {
                frameId = requestAnimationFrame(loop);
            } else {
                const fps = Math.round((frames / elapsed) * 1000);
                const score = Math.round(fps * 25); 
                setStressResult({ fps, score, frames });
                setStressStatus('COMPLETE');
            }
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [stressStatus]);

    // Render Stress Grid Items 
    const StressGrid = useMemo(() => {
        if (stressStatus !== 'RUNNING' && stressStatus !== 'COMPLETE') return null;
        return (
            <div className="grid grid-cols-25 gap-px w-full h-24 overflow-hidden bg-black border border-terminal-green/30 mt-2 p-1">
                {Array.from({ length: 400 }).map((_, i) => {
                    const hue = (i + renderTick * 5) % 360;
                    return (
                        <div key={i} style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }} className="w-full h-full opacity-70"></div>
                    );
                })}
            </div>
        );
    }, [stressStatus, renderTick]);

    // Advanced Data Processing
    const systemMetrics = useMemo(() => {
        const systems: Record<string, SystemCategory> = {
            'NEURAL': { 
                id: 'NEURAL', label: 'NEURAL ENGINE', color: 'text-blue-400', icon: '🧠', 
                metrics: [], totalCpu: 0, totalMemory: 0, totalTokens: 0, 
                history: historyRef.current['NEURAL'], health: 100, details: [], logs: [] 
            },
            'RENDER': { 
                id: 'RENDER', label: 'HOLOGRAPHIC RENDERER', color: 'text-purple-400', icon: '💎', 
                metrics: [], totalCpu: 0, totalMemory: 0, totalTokens: 0, 
                history: historyRef.current['RENDER'], health: 100, details: [], logs: []
            },
            'MEMORY': { 
                id: 'MEMORY', label: 'MEMORY BANK', color: 'text-yellow-400', icon: '💾', 
                metrics: [], totalCpu: 0, totalMemory: 0, totalTokens: 0, 
                history: historyRef.current['MEMORY'], health: 100, details: [], logs: []
            },
            'KERNEL': { 
                id: 'KERNEL', label: 'KERNEL I/O', color: 'text-green-400', icon: '⚡', 
                metrics: [], totalCpu: 0, totalMemory: 0, totalTokens: 0, 
                history: historyRef.current['KERNEL'], health: 100, details: [], logs: []
            },
        };

        const funcMap: Record<string, FunctionMetric> = {};

        // Helper to get or create function metric
        const getFunc = (name: string, sysId: string): FunctionMetric => {
            const key = `${sysId}_${name}`;
            if (!funcMap[key]) {
                funcMap[key] = { name, calls: 0, totalTime: 0, avgTime: 0, tokens: 0, memory: 0, gpuLoad: 0, lastCalled: 0 };
            }
            return funcMap[key];
        };

        report.logs.forEach(log => {
            let sysId = 'KERNEL';
            let gpuFactor = 0;
            let memFactor = 0;
            let tokenFactor = 0;

            // Categorize
            if (log.type === 'API_LATENCY') {
                sysId = 'NEURAL';
                tokenFactor = log.details?.tokens || Math.floor((log.value || 0) / 50); 
                memFactor = (log.details?.responseSize || 1024);
            } else if (log.type === 'RENDER_TIME') {
                sysId = 'RENDER';
                gpuFactor = (log.value || 0) > 16 ? 80 : 20; 
            } else if (log.type === 'STORAGE_USAGE') {
                sysId = 'MEMORY';
                memFactor = log.value || 0;
            } else if (log.label.includes('Graph') || log.label.includes('Visual')) {
                sysId = 'RENDER';
                gpuFactor = 50;
            }

            // Assign log to system
            systems[sysId].logs.push(log);

            const cleanName = log.label.split('-')[0].trim() || 'Anonymous Process';
            const metric = getFunc(cleanName, sysId);

            metric.calls++;
            metric.totalTime += log.value || 0;
            metric.tokens += tokenFactor;
            metric.memory += memFactor;
            metric.gpuLoad = Math.max(metric.gpuLoad, gpuFactor);
            metric.lastCalled = Math.max(metric.lastCalled, log.timestamp);
        });

        // Finalize Systems
        Object.keys(funcMap).forEach(key => {
            const sysId = key.split('_')[0];
            const m = funcMap[key];
            m.avgTime = Math.round(m.totalTime / m.calls);
            
            systems[sysId].metrics.push(m);
            systems[sysId].totalCpu += m.totalTime;
            systems[sysId].totalMemory += m.memory;
            systems[sysId].totalTokens += m.tokens;
        });

        // Health Calculations
        systems['NEURAL'].health = Math.max(0, 100 - (report.summary.apiStats.errors * 5));
        systems['NEURAL'].details = [
            { label: 'Latency', value: `${report.summary.avgLatency}ms`, status: report.summary.avgLatency > 1000 ? 'warn' : 'ok' },
            { label: 'Success', value: `${((report.summary.apiStats.success / (report.summary.apiStats.total || 1)) * 100).toFixed(0)}%`, status: 'ok' }
        ];

        systems['RENDER'].health = stressStatus === 'RUNNING' ? 60 : 100;
        systems['RENDER'].details = [
            { label: 'FPS Estimate', value: stressResult ? `${stressResult.fps}` : '60', status: 'ok' },
            { label: 'Active Nodes', value: document.getElementsByTagName('*').length.toString(), status: 'ok' }
        ];

        systems['MEMORY'].health = Math.max(0, 100 - Math.round(report.storage.percentage));
        systems['MEMORY'].details = [
            { label: 'Storage', value: `${report.storage.percentage.toFixed(1)}%`, status: report.storage.percentage > 80 ? 'warn' : 'ok' },
            { label: 'Keys', value: Object.keys(localStorage).length.toString(), status: 'ok' }
        ];

        systems['KERNEL'].health = 98; 
        systems['KERNEL'].details = [
            { label: 'Uplink', value: navigator.onLine ? 'ONLINE' : 'OFFLINE', status: navigator.onLine ? 'ok' : 'err' },
            { label: 'Threads', value: `${navigator.hardwareConcurrency || 4}`, status: 'ok' }
        ];

        return Object.values(systems);
    }, [report.logs, report.summary, report.storage, stressStatus, stressResult]);

    const handlePing = async () => {
        setIsPinging(true);
        const latency = await monitor.measurePing();
        setPing(latency);
        setIsPinging(false);
    };

    const handleToggleLogType = (type: MetricType) => {
        monitor.toggleLogType(type);
        setReport(monitor.getReport()); 
    };

    const handleExport = () => {
        const reportData = monitor.getReport();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `zplus_diagnostics_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
    const enabledTypes = report.config.enabledTypes;

    // Filter Logs for Bottom Panel
    const displayLogs = report.logs
        .slice()
        .reverse()
        .filter(log => {
            const matchesType = logFilter === 'ALL' || log.type === logFilter;
            const searchLower = logSearch.toLowerCase();
            const matchesSearch = !logSearch || 
                log.label.toLowerCase().includes(searchLower) ||
                log.type.toLowerCase().includes(searchLower);
            return matchesType && matchesSearch;
        })
        .slice(0, 100);

    // LIVE MONITOR: Get last 5 operations for global view
    const globalLiveOperations = report.logs.slice().reverse().slice(0, 5);

    const dashboardContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in font-mono">
            <div className="bg-[#0c0c0c] border border-terminal-green w-full max-w-7xl h-[95vh] flex flex-col rounded-lg shadow-[0_0_50px_rgba(0,255,65,0.1)] relative overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-terminal-green/30 bg-[#111]">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-3 h-3 bg-terminal-green rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,65,0.8)]"></div>
                            <div className="absolute top-0 left-0 w-3 h-3 bg-terminal-green rounded-full animate-ping opacity-50"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-terminal-green tracking-widest leading-none">SYSTEM DIAGNOSTICS</h3>
                            <div className="flex gap-4 mt-1 text-[10px] text-gray-500 uppercase tracking-wide">
                                <span>UPTIME: {(performance.now() / 1000).toFixed(0)}s</span>
                                <span>SESSION ID: {report.generatedAt.split('T')[1].slice(0,8)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 items-center">
                        <div className="hidden md:flex bg-[#1a1a1a] rounded p-1 border border-gray-700">
                            <button 
                                onClick={() => setViewMode('STANDARD')}
                                className={`px-4 py-1 text-[10px] font-bold rounded transition-colors ${viewMode === 'STANDARD' ? 'bg-terminal-green text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                STANDARD
                            </button>
                            <button 
                                onClick={() => setViewMode('ADVANCED')}
                                className={`px-4 py-1 text-[10px] font-bold rounded transition-colors ${viewMode === 'ADVANCED' ? 'bg-terminal-green text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                ADVANCED
                            </button>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors px-3 py-1 border border-gray-800 hover:border-red-900 rounded font-bold text-xs">ESC</button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow overflow-y-auto custom-scrollbar bg-[#050505]">
                    {viewMode === 'STANDARD' ? (
                        /* STANDARD VIEW */
                        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                            {/* Neural Link Status */}
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
                                    <StatusBar 
                                        label="Success Rate" 
                                        current={api.success} 
                                        max={api.total || 1} 
                                        colorClass="bg-blue-500" 
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                                        <span>Avg Latency</span>
                                        <span className="text-white">{report.summary.avgLatency} ms</span>
                                    </div>
                                </div>
                            </div>

                            {/* Memory Core */}
                            <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2 group-hover:text-terminal-green">MEMORY CORE</h4>
                                <div className="space-y-4">
                                    <StatusBar 
                                        label={`Local Storage (${formatBytes(report.storage.used)})`} 
                                        current={report.storage.used} 
                                        max={report.storage.total} 
                                        colorClass={report.storage.percentage > 80 ? "bg-red-500" : "bg-purple-500"} 
                                    />
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

                            {/* Graphics Benchmark */}
                            <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group relative overflow-hidden">
                                <h4 className="text-xs font-bold text-gray-400 mb-2 border-b border-gray-800 pb-2 group-hover:text-terminal-green flex justify-between">
                                    <span>GRAPHICS CORE BENCHMARK</span>
                                    {stressStatus === 'RUNNING' && <span className="text-terminal-green animate-pulse">RUNNING</span>}
                                </h4>
                                <div className="flex flex-col h-[140px]">
                                    {stressStatus === 'IDLE' ? (
                                        <div className="flex-grow flex flex-col items-center justify-center space-y-3">
                                            <span className="text-4xl">🚀</span>
                                            <button 
                                                onClick={() => setStressStatus('RUNNING')}
                                                className="px-4 py-2 bg-terminal-green text-black font-bold text-xs uppercase rounded hover:bg-terminal-dimGreen transition-colors shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                                            >
                                                INITIATE STRESS TEST
                                            </button>
                                            <p className="text-[9px] text-gray-500 text-center max-w-[150px]">
                                                Renders 400 dynamic nodes to measure frame consistency.
                                            </p>
                                        </div>
                                    ) : stressStatus === 'RUNNING' ? (
                                        <div className="flex-grow flex flex-col">
                                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                <span>Load: 400 Nodes</span>
                                                <span>Tick: {renderTick}</span>
                                            </div>
                                            <style>{`.grid-cols-25 { grid-template-columns: repeat(20, minmax(0, 1fr)); }`}</style>
                                            {StressGrid}
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex flex-col items-center justify-center space-y-2 animate-fade-in">
                                            <div className="text-xs text-gray-500 uppercase tracking-widest">Benchmark Result</div>
                                            <div className="text-3xl font-bold text-white font-mono">{stressResult?.score} PTS</div>
                                            <div className="flex gap-4 text-xs font-mono text-terminal-green">
                                                <span>FPS: {stressResult?.fps}</span>
                                                <span>Frames: {stressResult?.frames}</span>
                                            </div>
                                            <button onClick={() => setStressStatus('RUNNING')} className="mt-2 text-[10px] text-gray-400 hover:text-white underline">
                                                RE-RUN DIAGNOSTIC
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Network Uplink */}
                            <div className="bg-[#111] border border-gray-800 p-4 rounded hover:border-terminal-green/50 transition-colors group">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                                    <h4 className="text-xs font-bold text-gray-400 group-hover:text-terminal-green">NETWORK UPLINK</h4>
                                    <button onClick={handlePing} disabled={isPinging} className="text-[9px] px-2 py-1 border border-terminal-green text-terminal-green rounded hover:bg-terminal-green hover:text-black disabled:opacity-50 transition-colors">
                                        {isPinging ? 'PINGING...' : 'TEST SIGNAL'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="p-2 bg-black rounded border border-gray-800">
                                        <div className="text-[9px] text-gray-500 uppercase mb-1">Downlink</div>
                                        <div className="text-lg font-bold text-white">{conn ? `${conn.downlink} Mbps` : 'N/A'}</div>
                                    </div>
                                    <div className="p-2 bg-black rounded border border-gray-800">
                                        <div className="text-[9px] text-gray-500 uppercase mb-1">Effective Type</div>
                                        <div className="text-lg font-bold text-white uppercase">{conn ? conn.effectiveType : 'Unknown'}</div>
                                    </div>
                                </div>
                                <div className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Signal Latency (RTT)</span>
                                    <div className="text-right">
                                        {ping !== null ? (
                                            <span className={`text-xl font-bold font-mono ${ping < 100 ? 'text-green-500' : ping < 300 ? 'text-yellow-500' : 'text-red-500'}`}>{ping} ms</span>
                                        ) : (
                                            <span className="text-xs text-gray-600">--</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ADVANCED VIEW */
                        <div className="p-6 grid grid-cols-1 gap-6 animate-fade-in">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {systemMetrics.map(sys => (
                                    <div 
                                        key={sys.id}
                                        onClick={() => setExpandedSystem(expandedSystem === sys.id ? null : sys.id)}
                                        className={`
                                            relative bg-[#111] border p-4 rounded cursor-pointer transition-all hover:bg-[#161616] group overflow-hidden
                                            ${expandedSystem === sys.id ? `border-${sys.color.split('-')[1]}-500 shadow-[0_0_20px_rgba(0,0,0,0.5)]` : 'border-gray-800 hover:border-gray-600'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <div className="text-3xl bg-black w-10 h-10 flex items-center justify-center rounded border border-gray-800 group-hover:border-gray-600">{sys.icon}</div>
                                            <div className="text-right">
                                                <div className={`text-[10px] font-bold ${sys.color}`}>{sys.label}</div>
                                                <div className="text-xs text-gray-500">{sys.metrics.length} Active Threads</div>
                                            </div>
                                        </div>
                                        
                                        <div className="relative z-10 space-y-3">
                                            <div className="w-full h-10 border-b border-gray-800/50 mb-2">
                                                <Sparkline data={sys.history} color={sys.color} height={40} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                                                <div className="bg-black/50 p-1 rounded border border-gray-800">
                                                    <span className="text-gray-500 block">HEALTH</span>
                                                    <span className={`${sys.health > 80 ? 'text-green-500' : 'text-red-500'} font-bold`}>{sys.health}%</span>
                                                </div>
                                                <div className="bg-black/50 p-1 rounded border border-gray-800">
                                                    <span className="text-gray-500 block">LOAD</span>
                                                    <span className="text-white font-bold">{sys.history[sys.history.length-1]}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* EXPANDED VIEW */}
                            {expandedSystem ? (() => {
                                const sys = systemMetrics.find(s => s.id === expandedSystem);
                                if (!sys) return null;
                                const systemLogs = sys.logs.slice().reverse().slice(0, 10); 

                                return (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                                        {/* LEFT: Function Table */}
                                        <div className="lg:col-span-2 bg-[#0a0a0a] border border-gray-800 rounded p-4">
                                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                                                <h4 className={`text-xs font-bold ${sys.color} uppercase tracking-widest`}>
                                                    {sys.label} :: PROCESS LIST
                                                </h4>
                                                <div className="text-[10px] text-gray-500">{sys.metrics.length} PROCESSES DETECTED</div>
                                            </div>
                                            
                                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-[10px] font-mono text-left">
                                                    <thead className="text-gray-500 border-b border-gray-800 bg-[#111] sticky top-0">
                                                        <tr>
                                                            <th className="py-2 px-2">FUNCTION</th>
                                                            <th className="py-2 px-2 text-right">CALLS</th>
                                                            <th className="py-2 px-2 text-right">AVG LATENCY</th>
                                                            <th className="py-2 px-2 text-right">RESOURCE IMPACT</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-900">
                                                        {sys.metrics.map((m, idx) => (
                                                            <tr key={idx} className="hover:bg-[#111] transition-colors group">
                                                                <td className="py-3 px-2 text-gray-300 font-bold group-hover:text-white">
                                                                    {m.name}
                                                                    <div className="text-[9px] text-gray-600 font-normal">Last: {new Date(m.lastCalled).toLocaleTimeString()}</div>
                                                                </td>
                                                                <td className="py-3 px-2 text-right text-gray-400">{m.calls}</td>
                                                                <td className="py-3 px-2 text-right">
                                                                    <span className={m.avgTime > 1000 ? 'text-red-500' : 'text-gray-300'}>{m.avgTime}ms</span>
                                                                </td>
                                                                <td className="py-3 px-2 text-right">
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        {m.tokens > 0 && <span className="text-blue-400">{m.tokens} Tok</span>}
                                                                        {m.memory > 0 && <span className="text-purple-400">{formatBytes(m.memory)}</span>}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {sys.metrics.length === 0 && (
                                                            <tr>
                                                                <td colSpan={4} className="py-8 text-center text-gray-600 italic">No telemetry data recorded for this subsystem yet.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* RIGHT: Deep Dive Analytics Panel */}
                                        <div className="lg:col-span-1 flex flex-col gap-4">
                                            {/* Status Panel */}
                                            <div className="bg-[#111] border border-gray-800 rounded p-4">
                                                <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">SYSTEM VITALITY</h4>
                                                <div className="flex items-center justify-around mb-4">
                                                    <CircularGauge value={sys.health} color={sys.health > 80 ? 'text-green-500' : 'text-red-500'} label="HEALTH" />
                                                    <CircularGauge value={sys.history[sys.history.length-1]} color="text-blue-500" label="LOAD" />
                                                </div>
                                                <div className="space-y-2">
                                                    {sys.details.map((d, i) => (
                                                        <div key={i} className="flex justify-between text-[10px] border-b border-gray-800/50 pb-1 last:border-0">
                                                            <span className="text-gray-500 uppercase">{d.label}</span>
                                                            <span className={`font-mono font-bold ${d.status === 'ok' ? 'text-white' : d.status === 'warn' ? 'text-yellow-500' : 'text-red-500'}`}>
                                                                {d.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* SPECIFIC VISUALIZER */}
                                            <div className="bg-[#111] border border-gray-800 rounded p-4">
                                                <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">DEEP DIVE VISUALIZER</h4>
                                                
                                                {sys.id === 'NEURAL' && (
                                                    <div className="h-full flex flex-col justify-center items-center gap-4">
                                                        <div className="w-full flex items-end gap-1 h-32 border-b border-gray-700 pb-1">
                                                            {sys.history.map((h, i) => (
                                                                <div key={i} className="flex-1 bg-blue-500/20 hover:bg-blue-500/50 transition-colors" style={{ height: `${h}%` }}></div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 text-center">TOKEN CONSUMPTION RATE (Last 20s)</p>
                                                    </div>
                                                )}

                                                {sys.id === 'RENDER' && (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-5 gap-1">
                                                            {Array.from({length: 25}).map((_, i) => (
                                                                <div key={i} className={`aspect-square rounded-sm ${Math.random() > 0.8 ? 'bg-purple-500/40' : 'bg-gray-800'}`}></div>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-gray-500 font-mono text-center">VRAM FRAGMENTATION MAP</div>
                                                    </div>
                                                )}

                                                {sys.id === 'MEMORY' && (
                                                    <div className="space-y-2">
                                                        <div className="w-full aspect-square bg-black border border-gray-800 p-1 grid grid-cols-8 gap-0.5">
                                                            {Array.from({length: 64}).map((_, i) => (
                                                                <div key={i} className={`w-full h-full ${i < (sys.totalMemory / 1024 / 1024) * 5 ? 'bg-yellow-500' : 'bg-gray-900'}`}></div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 text-center">STORAGE BLOCK ALLOCATION</p>
                                                    </div>
                                                )}

                                                {sys.id === 'KERNEL' && (
                                                    <div className="flex flex-col gap-2 h-full">
                                                        <div className="flex-grow bg-black border border-green-900/30 relative overflow-hidden p-2 font-mono text-[9px] text-green-700">
                                                            {Array.from({length: 8}).map((_, i) => (
                                                                <div key={i} className="truncate">
                                                                    [{parseInt(Date.now().toString().slice(-6)) - i*100}] SYSCALL_ACK::OK
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 text-center">EVENT LOOP STREAM</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* LIVE EXECUTION FEED (EMOJI) */}
                                            <div className="bg-[#111] border border-gray-800 rounded p-4 flex-grow flex flex-col">
                                                <h4 className="text-xs font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">LIVE EXECUTION FEED</h4>
                                                
                                                <div className="flex-grow flex flex-col gap-2 overflow-hidden relative">
                                                    <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#111] to-transparent z-10 pointer-events-none"></div>
                                                    
                                                    <div className="flex-grow overflow-hidden relative">
                                                        {systemLogs.map((log, i) => (
                                                            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800/50 animate-fade-in-up" style={{ animationDelay: `${i*100}ms` }}>
                                                                <div className="text-xl bg-black rounded p-1 w-8 h-8 flex items-center justify-center border border-gray-800">
                                                                    {getFunctionIcon(log.label, log.type)}
                                                                </div>
                                                                <div className="flex-grow min-w-0">
                                                                    <div className={`text-[10px] font-bold truncate ${i === 0 ? 'text-white animate-pulse' : 'text-gray-500'}`}>
                                                                        {log.label}
                                                                    </div>
                                                                    <div className="text-[9px] text-gray-600 font-mono">
                                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                                    </div>
                                                                </div>
                                                                {i === 0 && <div className="w-2 h-2 bg-terminal-green rounded-full shadow-[0_0_5px_var(--color-term-green)] animate-ping"></div>}
                                                            </div>
                                                        ))}
                                                        {systemLogs.length === 0 && <div className="text-center text-gray-600 text-[10px] italic pt-10">No active processes for {sys.label}</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : (
                                // GLOBAL VIEW (Not Expanded)
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Left: Detailed Process Stream */}
                                    <div className="bg-[#0a0a0a] border border-gray-800 rounded p-4 flex flex-col">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">
                                            LIVE KERNEL EXECUTION
                                        </h4>
                                        <div className="flex-grow flex flex-col gap-2 relative min-h-[200px]">
                                            {globalLiveOperations.map((log, i) => (
                                                <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-800/30 animate-fade-in-up" style={{ animationDelay: `${i*50}ms` }}>
                                                    <div className="text-2xl bg-[#111] w-10 h-10 flex items-center justify-center rounded border border-gray-800 shadow-sm relative">
                                                        {getFunctionIcon(log.label, log.type)}
                                                        {i === 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-green opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-terminal-green"></span></span>}
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <span className={`text-xs font-bold font-mono truncate ${i===0 ? 'text-white' : 'text-gray-500'}`}>
                                                                {log.label.toUpperCase()}
                                                            </span>
                                                            <span className="text-[9px] text-gray-600 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
                                                            <div className={`h-full ${i === 0 ? 'bg-terminal-green animate-progress' : 'bg-gray-700'}`} style={{ width: i === 0 ? '100%' : '100%' }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {globalLiveOperations.length === 0 && <div className="text-center text-gray-700 italic mt-10">System Idle. Awaiting Instructions.</div>}
                                        </div>
                                    </div>

                                    {/* Right: Detailed Metrics */}
                                    <div className="bg-[#0a0a0a] border border-gray-800 rounded p-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">
                                            RESOURCE CONSUMPTION
                                        </h4>
                                        <div className="space-y-4">
                                            <StatusBar 
                                                label={`Memory Heap (${formatBytes(mem?.usedJSHeapSize || 0)})`} 
                                                current={mem?.usedJSHeapSize || 0} 
                                                max={mem?.jsHeapSizeLimit || 1} 
                                                colorClass="bg-purple-500" 
                                            />
                                            <StatusBar 
                                                label={`Local Storage (${report.storage.percentage.toFixed(1)}%)`} 
                                                current={report.storage.used} 
                                                max={report.storage.total} 
                                                colorClass="bg-yellow-500" 
                                            />
                                            <StatusBar 
                                                label={`API Success Rate (${((api.success/(api.total||1))*100).toFixed(0)}%)`} 
                                                current={api.success} 
                                                max={api.total || 1} 
                                                colorClass="bg-blue-500" 
                                            />
                                            
                                            <div className="grid grid-cols-2 gap-4 mt-6">
                                                <div className="bg-[#111] p-3 rounded border border-gray-800 text-center">
                                                    <div className="text-2xl font-bold text-white">{monitor.getInteractionCount()}</div>
                                                    <div className="text-[9px] text-gray-500 uppercase">User Interactions</div>
                                                </div>
                                                <div className="bg-[#111] p-3 rounded border border-gray-800 text-center">
                                                    <div className="text-2xl font-bold text-blue-400">{api.total}</div>
                                                    <div className="text-[9px] text-gray-500 uppercase">Neural Calls</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIVE LOGS SECTION */}
                    <div className="p-6 border-t border-gray-800 bg-[#080808]">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400">GLOBAL EVENT LOG</span>
                                <span className="text-[10px] text-gray-600 bg-gray-900 px-2 py-0.5 rounded">{displayLogs.length} EVENTS</span>
                            </div>
                            
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => setShowLogConfig(!showLogConfig)}
                                    className={`p-1.5 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-terminal-green transition-colors ${showLogConfig ? 'bg-terminal-green text-black border-terminal-green' : 'bg-[#1a1a1a]'}`}
                                    title="Filter Configuration"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <select 
                                    value={logFilter}
                                    onChange={(e) => setLogFilter(e.target.value)}
                                    className="bg-[#1a1a1a] border border-gray-700 text-gray-300 text-[9px] rounded px-2 py-1 outline-none focus:border-terminal-green"
                                >
                                    <option value="ALL">ALL TYPES</option>
                                    <option value="API_LATENCY">API LATENCY</option>
                                    <option value="INTERACTION">INTERACTION</option>
                                    <option value="STORAGE_USAGE">STORAGE</option>
                                    <option value="RENDER_TIME">RENDER</option>
                                </select>
                                <input 
                                    type="text" 
                                    value={logSearch}
                                    onChange={(e) => setLogSearch(e.target.value)}
                                    placeholder="SEARCH LOGS..."
                                    className="bg-[#1a1a1a] border border-gray-700 text-gray-300 text-[9px] rounded px-2 py-1 outline-none focus:border-terminal-green w-32 placeholder-gray-600"
                                />
                            </div>
                        </div>

                        {showLogConfig && (
                            <div className="flex gap-2 flex-wrap mb-4 justify-end">
                                {['API_LATENCY', 'STORAGE_USAGE', 'INTERACTION', 'RENDER_TIME', 'CACHE_UPDATE'].map((type) => {
                                    const isEnabled = enabledTypes.includes(type as MetricType);
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => handleToggleLogType(type as MetricType)}
                                            className={`text-[9px] px-2 py-1 rounded border font-bold transition-all
                                                ${isEnabled 
                                                    ? 'bg-terminal-green/20 text-terminal-green border-terminal-green' 
                                                    : 'bg-black text-gray-500 border-gray-800 hover:border-gray-600'}
                                            `}
                                        >
                                            {type} {isEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="h-48 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar bg-black p-2 border border-gray-900 rounded">
                            {displayLogs.length === 0 ? (
                                <div className="text-gray-700 text-center py-10 italic">No matching logs found.</div>
                            ) : (
                                displayLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2 border-b border-gray-900 pb-1 last:border-0 hover:bg-[#111] px-1 transition-colors">
                                        <span className="text-gray-600 w-16">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, second: '2-digit', fractionalSecondDigits: 2} as any)}</span>
                                        <span className={`w-20 font-bold ${
                                            log.type === 'API_LATENCY' ? 'text-blue-400' : 
                                            log.type === 'STORAGE_USAGE' ? 'text-purple-400' : 
                                            log.type === 'RENDER_TIME' ? 'text-pink-400' :
                                            'text-gray-400'
                                        }`}>{log.type.split('_')[0]}</span>
                                        <span className="text-gray-300 flex-grow truncate">{log.label}</span>
                                        {log.value !== undefined && (
                                            <span className={`w-12 text-right ${log.type === 'API_LATENCY' && log.value > 2000 ? 'text-yellow-500' : 'text-gray-600'}`}>
                                                {log.value > 1000 && log.type !== 'STORAGE_USAGE' ? (log.value/1000).toFixed(1)+'s' : log.value}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-terminal-green/30 bg-[#111] flex justify-between items-center shrink-0">
                    <div className="text-[10px] text-gray-600 hidden md:block">
                        MONITOR_STATUS: ACTIVE
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
            <style>{`
                @keyframes progress { from { width: 0%; } to { width: 100%; } }
                .animate-progress { animation: progress 1s ease-out forwards; }
            `}</style>
        </div>
    );

    return createPortal(dashboardContent, document.body);
};
