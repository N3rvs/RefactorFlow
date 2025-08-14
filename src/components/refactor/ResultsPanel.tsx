
"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";
import type { RefactorResponse, CodefixFile, SqlScripts } from "@/lib/types";
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

const SqlContent = ({ sql }: { sql: SqlScripts | undefined | null }) => {
  if (!sql || (!sql.renameSql && !sql.compatSql && !sql.cleanupSql)) {
    return <p className="text-sm text-muted-foreground p-4">No hay scripts SQL para mostrar.</p>
  }
  return (
    <div className="space-y-4">
      {sql.renameSql && <CodeBlock code={sql.renameSql} />}
      {sql.compatSql && <CodeBlock code={sql.compatSql} />}
      {sql.cleanupSql && <CodeBlock code={sql.cleanupSql} />}
    </div>
  )
};

const CodeFixContent = ({ codefix }: { codefix: CodefixResult | undefined | null }) => {
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
         <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{codefix.changed > 0 ? `${codefix.changed} de ${codefix.scanned} archivos modificados` : `${codefix.scanned} archivos escaneados.`}</span>
            </div>
            {changedFiles.length > 0 ? (
                 <ScrollArea className="h-48">
                    <div className="space-y-1 pr-4">
                    {changedFiles.map(file => (
                        <div key={file.path} className="grid grid-cols-[1fr_auto] items-center gap-2 font-mono text-xs">
                          <span>{file.path}</span>
                          <Badge variant="outline" className="text-sky-400 border-sky-400/30">{file.changes} cambios</Badge>
                        </div>
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

    return (
      <Card className="h-full flex flex-col">
          <CardHeader>
              <CardTitle className="text-base font-medium">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
              <Tabs defaultValue="sql" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                    <TabsTrigger value="sql">SQL</TabsTrigger>
                    <TabsTrigger value="codefix">CodeFix</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>
                <div className="flex-1 mt-2">
                    <TabsContent value="sql" className="m-0 h-full">
                        <SqlContent sql={result?.sql} />
                    </TabsContent>
                    <TabsContent value="codefix" className="m-0 h-full">
                        <CodeFixContent codefix={result?.codefix} />
                    </TabsContent>
                    <TabsContent value="logs" className="m-0 h-full">
                        <CodeBlock code={result?.dbLog || result?.log || "No hay logs disponibles."} />
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

    