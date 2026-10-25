/**
 * The File System Access API's file pickers, which TypeScript's DOM library leaves out (only Chrome and Edge have
 * them). The handles and writable streams they give are in the DOM library already.
 */

type FilePickerAcceptType = { description?: string; accept: Record<string, string[]> };

type FilePickerOptions = {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    id?: string;
    startIn?:
        | FileSystemHandle
        | "desktop"
        | "documents"
        | "downloads"
        | "music"
        | "pictures"
        | "videos";
};

interface Window {
    showOpenFilePicker?(
        options?: FilePickerOptions & { multiple?: boolean },
    ): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(
        options?: FilePickerOptions & { suggestedName?: string },
    ): Promise<FileSystemFileHandle>;
}
