
"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, FileCode } from "lucide-react";
import type { RefactorResponse, CodefixFile, CodefixResult, SqlScripts } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";
import { CodeDiffViewer } from "./CodeDiffViewer";
import { ScrollArea } from "../ui/scroll-area";

interface ResultsPanelProps {
  result: RefactorResponse | null;
  loading: boolean;
  error: string | null;
}

const LoadingSkeleton = () => (
    <div className="space-y-4 p-4">
        <div className="flex space-x-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <Skeleton className="h-40 w-full rounded-md" />
    </div>
);

const EmptyState = () => (
     <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileCode className="h-12 w-12 mb-4" />
        <h3 className="font-semibold">Listo para refactorizar</h3>
        <p className="text-sm text-center">Ejecuta una vista previa o aplica un plan para ver los resultados aquí.</p>
    </div>
)

const SqlContent = ({ sql }: { sql: SqlScripts | undefined | null }) => {
  if (!sql || (!sql.renameSql && !sql.compatSql && !sql.cleanupSql)) {
    return <p className="text-sm text-muted-foreground p-4">No hay scripts SQL para mostrar.</p>
  }
  return (
    <ScrollArea className="h-full">
        <div className="space-y-4 p-1">
            {sql.renameSql && <CodeBlock code={sql.renameSql} />}
            {sql.compatSql && <CodeBlock code={sql.compatSql} />}
            {sql.cleanupSql && <CodeBlock code={sql.cleanupSql} />}
        </div>
    </ScrollArea>
  )
};

const CodeFixContent = ({ codefix, onFileSelect }: { codefix: CodefixResult | undefined | null, onFileSelect: (file: CodefixFile) => void }) => {
    if (!codefix) {
        return (
            <div className="text-center text-muted-foreground py-8">
                <Info className="mx-auto h-8 w-8" />
                <p className="mt-2 text-sm">Ejecuta una vista previa para ver los cambios de código.</p>
            </div>
        )
    }

    const changedFiles = codefix.files.filter(f => f.changed);

    return (
         <div className="space-y-2 h-full flex flex-col">
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{codefix.changed > 0 ? `${codefix.changed} de ${codefix.scanned} archivos modificados` : `${codefix.scanned} archivos escaneados.`}</span>
            </div>
            {changedFiles.length > 0 ? (
                 <ScrollArea className="flex-1">
                    <div className="space-y-1 pr-4">
                    {changedFiles.map(file => (
                        <Button variant="ghost" className="w-full justify-start font-mono text-xs h-8" key={file.path} onClick={() => onFileSelect(file)}>
                          <span className="flex-1 text-left truncate">{file.path}</span>
                          <Badge variant="outline" className="ml-2 text-sky-400 border-sky-400/30">{file.changes} cambios</Badge>
                        </Button>
                    ))}
                    </div>
                 </ScrollArea>
            ) : (
                 <div className="text-center text-muted-foreground py-8">
                    <Info className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">No se modificaron archivos.</p>
                </div>
            )}
        </div>
    )
};


export default function ResultsPanel({ result, loading, error }: ResultsPanelProps) {
  const [selectedFile, setSelectedFile] = useState<CodefixFile | null>(null);

  const renderContent = () => {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return (
        <Alert variant="destructive" className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription><pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre></AlertDescription>
        </Alert>
      );
    }
    
    if (!result) {
        return (
             <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="text-base font-medium">Resultado</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                    <EmptyState />
                </CardContent>
             </Card>
        );
    }

    return (
      <Card className="h-full flex flex-col">
          <CardHeader>
              <CardTitle className="text-base font-medium">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
              <Tabs defaultValue="sql" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                    <TabsTrigger value="sql">SQL</TabsTrigger>
                    <TabsTrigger value="codefix">CodeFix</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>
                <div className="flex-1 mt-2 min-h-0">
                    <TabsContent value="sql" className="m-0 h-full">
                        <SqlContent sql={result?.sql} />
                    </TabsContent>
                    <TabsContent value="codefix" className="m-0 h-full">
                        <CodeFixContent codefix={result?.codefix} onFileSelect={setSelectedFile} />
                    </TabsContent>
                    <TabsContent value="logs" className="m-0 h-full">
                         <ScrollArea className="h-full">
                            <CodeBlock code={result?.dbLog || result?.log || "No hay logs disponibles."} />
                         </ScrollArea>
                    </TabsContent>
                </div>
              </Tabs>
          </CardContent>
          {selectedFile && (
            <CodeDiffViewer 
              file={selectedFile}
              onClose={() => setSelectedFile(null)}
            />
          )}
      </Card>
    );
  };

  return renderContent();
}

    