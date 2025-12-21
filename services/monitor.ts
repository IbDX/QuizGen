
export type MetricType = 'API_LATENCY' | 'STORAGE_USAGE' | 'INTERACTION' | 'RENDER_TIME';

export interface PerformanceLog {
    timestamp: number;
    type: MetricType;
    label: string;
    value?: number; // ms for time, bytes for storage
    details?: any;
}

class PerformanceMonitor {
    private logs: PerformanceLog[] = [];
    private readonly MAX_LOGS = 1000;
    private readonly STORAGE_LIMIT = 5 * 1024 * 1024; // Approx 5MB for LocalStorage

    public log(type: MetricType, label: string, value?: number, details?: any) {
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

    public getReport() {
        return {
            generatedAt: new Date().toISOString(),
            storage: this.getStorageUsage(),
            summary: {
                avgLatency: this.getAverageApiLatency(),
                interactionCount: this.getInteractionCount(),
                totalLogs: this.logs.length
            },
            logs: this.logs
        };
    }

    public clear() {
        this.logs = [];
    }
}

export const monitor = new PerformanceMonitor();
