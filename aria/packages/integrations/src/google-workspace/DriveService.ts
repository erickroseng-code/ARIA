import { google } from 'googleapis';
import { createWorkspaceClient, withRetry } from './WorkspaceClient';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
    parents?: string[];
}

/**
 * DriveService
 * Provides read AND write operations for Google Drive.
 */
export class DriveService {

    // ---- READ ---------------------------------------------------------------

    async listFilesInFolder(folderId: string, limit = 50): Promise<DriveFile[]> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const res = await withRetry(
            () => drive.files.list({
                pageSize: limit,
                orderBy: 'modifiedTime desc',
                fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
                q: `'${folderId}' in parents and trashed = false`,
            }),
            'DriveService.listFilesInFolder',
        );
        return (res.data.files ?? []) as DriveFile[];
    }

    async listRecentFiles(limit = 10): Promise<DriveFile[]> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const res = await withRetry(
            () => drive.files.list({
                pageSize: limit,
                orderBy: 'modifiedTime desc',
                fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
                q: 'trashed = false',
            }),
            'DriveService.listRecentFiles',
        );
        return (res.data.files ?? []) as DriveFile[];
    }

    async searchFiles(query: string, limit = 10): Promise<DriveFile[]> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const safeQuery = query.replace(/'/g, "\\'");
        const res = await withRetry(
            () => drive.files.list({
                pageSize: limit,
                orderBy: 'modifiedTime desc',
                fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
                q: `fullText contains '${safeQuery}' and trashed = false`,
            }),
            'DriveService.searchFiles',
        );
        return (res.data.files ?? []) as DriveFile[];
    }

    async getFileById(fileId: string): Promise<DriveFile | null> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        try {
            const res = await drive.files.get({
                fileId,
                fields: 'id,name,mimeType,modifiedTime,webViewLink,parents',
            });
            return res.data as DriveFile;
        } catch {
            return null;
        }
    }

    // ---- WRITE --------------------------------------------------------------

    /** Rename a file */
    async renameFile(fileId: string, newName: string): Promise<DriveFile> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.update({
            fileId,
            requestBody: { name: newName },
            fields: 'id,name,mimeType,webViewLink',
        });
        return res.data as DriveFile;
    }

    /** Move a file to a different folder */
    async moveFile(fileId: string, newFolderId: string): Promise<DriveFile> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        // First get the current parents to remove them
        const file = await this.getFileById(fileId);
        const previousParents = (file?.parents ?? []).join(',');
        const res = await drive.files.update({
            fileId,
            addParents: newFolderId,
            removeParents: previousParents,
            fields: 'id,name,mimeType,webViewLink,parents',
        });
        return res.data as DriveFile;
    }

    /** Copy a file */
    async copyFile(fileId: string, newName?: string): Promise<DriveFile> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.copy({
            fileId,
            requestBody: newName ? { name: newName } : {},
            fields: 'id,name,mimeType,webViewLink',
        });
        return res.data as DriveFile;
    }

    /** Send a file or folder to trash */
    async trashFile(fileId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.update({
            fileId,
            requestBody: { trashed: true },
        });
    }

    /** Restore a file from trash */
    async restoreFile(fileId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.update({
            fileId,
            requestBody: { trashed: false },
        });
    }

    /** Permanently delete a file (cannot be undone) */
    async deleteFile(fileId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({ fileId });
    }

    /** Create a new folder */
    async createFolder(name: string, parentId?: string): Promise<DriveFile> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : undefined,
            },
            fields: 'id,name,mimeType,webViewLink',
        });
        return res.data as DriveFile;
    }

    /** Update file description/metadata */
    async updateDescription(fileId: string, description: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.update({
            fileId,
            requestBody: { description },
        });
    }

    // ---- FORMAT ---------------------------------------------------------------

    formatForAI(files: DriveFile[], context: string): string {
        if (files.length === 0) return `⚠️ Nenhum arquivo encontrado no Drive (${context}).`;
        const lines = files.map(
            (f) => `• [${f.name}](${f.webViewLink ?? '#'}) — ID: ${f.id} | ${f.mimeType.split('.').pop()} | Modificado: ${f.modifiedTime?.split('T')[0] ?? '?'}`
        );
        return `📁 GOOGLE DRIVE — ${context}:\n${lines.join('\n')}`;
    }
}
