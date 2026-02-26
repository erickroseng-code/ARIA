import fs from 'fs';
import path from 'path';

// Path to the snapshots folder at data/snapshots/
const SNAPSHOTS_DIR = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'snapshots');

export interface AnalysisSnapshot {
    id: string;
    handle: string;
    createdAt: string;
    analysis: any;
    strategies: any[];
    source: string;
}

export class StorageService {
    constructor() {
        // Ensure the snapshots directory exists
        if (!fs.existsSync(SNAPSHOTS_DIR)) {
            fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
            console.log(`[Maverick Storage] Created snapshots directory at ${SNAPSHOTS_DIR}`);
        }
    }

    /**
     * Saves an analysis snapshot as a JSON file to disk.
     * Returns the saved snapshot object with its generated ID.
     */
    saveSnapshot(handle: string, analysis: any, strategies: any[], source: string): AnalysisSnapshot {
        const id = `${handle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const createdAt = new Date().toISOString();

        const snapshot: AnalysisSnapshot = {
            id,
            handle,
            createdAt,
            analysis,
            strategies,
            source,
        };

        const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
        console.log(`[Maverick Storage] Saved snapshot: ${filePath}`);

        return snapshot;
    }

    /**
     * Returns all analysis snapshots sorted by most recent first.
     */
    listSnapshots(): AnalysisSnapshot[] {
        if (!fs.existsSync(SNAPSHOTS_DIR)) return [];

        const files = fs.readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.json'));

        const snapshots: AnalysisSnapshot[] = files
            .map(file => {
                try {
                    const raw = fs.readFileSync(path.join(SNAPSHOTS_DIR, file), 'utf-8');
                    return JSON.parse(raw) as AnalysisSnapshot;
                } catch {
                    return null;
                }
            })
            .filter(Boolean) as AnalysisSnapshot[];

        // Sort by most recent first
        return snapshots.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * Returns a single snapshot by ID.
     */
    getSnapshot(id: string): AnalysisSnapshot | null {
        const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return null;

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw) as AnalysisSnapshot;
        } catch {
            return null;
        }
    }

    /**
     * Deletes a snapshot by ID.
     */
    deleteSnapshot(id: string): boolean {
        const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return false;
        fs.unlinkSync(filePath);
        console.log(`[Maverick Storage] Deleted snapshot: ${id}`);
        return true;
    }
}
