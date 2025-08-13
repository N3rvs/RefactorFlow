
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CodeBlock } from "./CodeBlock";
import type { CodefixFile } from "@/lib/types";

interface CodeDiffViewerProps {
    file: CodefixFile | null;
    onClose: () => void;
}

export function CodeDiffViewer({ file, onClose }: CodeDiffViewerProps) {
    if (!file) return null;

    return (
        <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Vista Previa de Cambios</DialogTitle>
                    <DialogDescription>{file.path}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                    <div className="flex flex-col gap-2 h-full">
                        <h3 className="text-sm font-medium text-muted-foreground">Original</h3>
                        <div className="flex-1 overflow-auto border rounded-md">
                           <CodeBlock code={file.originalContent || "No hay contenido original disponible."} />
                        </div>
                    </div>
                     <div className="flex flex-col gap-2 h-full">
                        <h3 className="text-sm font-medium text-green-400">Modificado</h3>
                         <div className="flex-1 overflow-auto border rounded-md border-green-500/30">
                           <CodeBlock code={file.modifiedContent || "No hay contenido modificado disponible."} />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
