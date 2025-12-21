
export type MetricType = 'API_LATENCY' | 'STORAGE_USAGE' | 'INTERACTION' | 'RENDER_TIME' | 'CACHE_UPDATE';

export interface PerformanceLog {
    timestamp: number;
    type: MetricType;
    label: string;
    value?: number; // ms for time, bytes for storage
    details?: any;
}

export interface ApiStats {
    total: number;
    success: number;
    errors: number;
    rateLimited: number;
}

class PerformanceMonitor {
    private logs: PerformanceLog[] = [];
    private readonly MAX_LOGS = 1000;
    private readonly STORAGE_LIMIT = 5 * 1024 * 1024; // Approx 5MB for LocalStorage
    private apiStats: ApiStats = { total: 0, success: 0, errors: 0, rateLimited: 0 };
    
    // Default: INTERACTION is OFF
    private enabledTypes: Set<MetricType> = new Set(['API_LATENCY', 'STORAGE_USAGE', 'RENDER_TIME', 'CACHE_UPDATE']);

    public log(type: MetricType, label: string, value?: number, details?: any) {
        if (!this.enabledTypes.has(type)) return;

        this.logs.push({
            timestamp: Date.now(),
            type,
            label,
            value,
            details
        });

        // Rotate logs if full
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }

        // Live Stat Updates
        if (type === 'API_LATENCY') {
            this.apiStats.total++;
            if (label.includes('Fail') || label.includes('Failure')) {
                this.apiStats.errors++;
                // Check details for 429
                if (details?.error?.includes('429') || details?.error?.includes('Quota')) {
                    this.apiStats.rateLimited++;
                }
            } else {
                this.apiStats.success++;
            }
        }
    }

    public toggleLogType(type: MetricType) {
        if (this.enabledTypes.has(type)) {
            this.enabledTypes.delete(type);
        } else {
            this.enabledTypes.add(type);
        }
    }

    public getAverageApiLatency(model?: string): number {
        const apiLogs = this.logs.filter(l => l.type === 'API_LATENCY' && (!model || l.label.includes(model)));
        if (apiLogs.length === 0) return 0;
        const total = apiLogs.reduce((acc, curr) => acc + (curr.value || 0), 0);
        return Math.round(total / apiLogs.length);
    }

    public getStorageUsage(): { used: number, total: number, percentage: number } {
        let used = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                used += (localStorage[key].length + key.length) * 2; // UTF-16
            }
        }
        return {
            used,
            total: this.STORAGE_LIMIT,
            percentage: Math.min(100, (used / this.STORAGE_LIMIT) * 100)
        };
    }

    public getInteractionCount(): number {
        return this.logs.filter(l => l.type === 'INTERACTION').length;
    }

    public getApiStats(): ApiStats {
        return { ...this.apiStats };
    }

    public getMemoryInfo(): any {
        // Chrome/Edge specific API
        return (performance as any).memory || null;
    }

    public getConnectionInfo(): any {
        return (navigator as any).connection || null;
    }

    public async measurePing(): Promise<number> {
        const start = performance.now();
        try {
            // Ping a reliable CDN small file (favicon or generic endpoint)
            // Using a no-cache header to ensure network traversal
            await fetch('https://www.google.com/favicon.ico', { 
                mode: 'no-cors', 
                cache: 'no-store' 
            });
            return Math.round(performance.now() - start);
        } catch (e) {
            return -1;
        }
    }

    public getReport() {
        return {
            generatedAt: new Date().toISOString(),
            storage: this.getStorageUsage(),
            summary: {
                avgLatency: this.getAverageApiLatency(),
                interactionCount: this.getInteractionCount(),
                totalLogs: this.logs.length,
                apiStats: this.apiStats
            },
            system: {
                memory: this.getMemoryInfo(),
                connection: this.getConnectionInfo(),
                userAgent: navigator.userAgent
            },
            logs: this.logs,
            config: {
                enabledTypes: Array.from(this.enabledTypes)
            }
        };
    }

    public clear() {
        this.logs = [];
        this.apiStats = { total: 0, success: 0, errors: 0, rateLimited: 0 };
    }
}

export const monitor = new PerformanceMonitor();
