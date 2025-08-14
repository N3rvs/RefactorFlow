
"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, FileText, Bot, Terminal, DatabaseZap, Info, ChevronRight, Eye } from "lucide-react";
import type { RefactorResponse, CodefixFile } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";
import { CodeDiffViewer } from "./CodeDiffViewer";

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
        <Skeleton className="h-32 w-full rounded-md" />
    </div>
);

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
            <Card className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                <p className="text-sm">Resultados de la operación</p>
            </Card>
        );
    }

    const { sql, codefix, dbLog, log } = result;
    const changedFile = codefix?.files.find(f => f.changed);

    return (
      <Card className="h-full">
      <Tabs defaultValue="sql" className="w-full h-full flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="sql">SQL</TabsTrigger>
            <TabsTrigger value="codefix">CodeFix</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
        <TabsContent value="sql" className="m-0">
          <div className="space-y-2">
            <CodeBlock code={sql?.renameSql} />
            <CodeBlock code={sql?.compatSql} />
          </div>
        </TabsContent>
        <TabsContent value="codefix" className="m-0">
            {codefix ? (
              <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground px-2">
                    <span>{codefix.changed} de {codefix.scanned} archivos modificados.</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                      {codefix.files?.length > 0 ? codefix.files.map(file => (
                          <div key={file.path} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                            <span className="font-mono text-xs">{file.path}</span>
                             {file.changed ? 
                                <Badge variant="outline" className="text-green-400 border-green-500/30">{file.changes} cambios</Badge> : 
                                <span className="text-muted-foreground">-</span>}
                          </div>
                      )) : (
                          <div className="text-center text-muted-foreground py-8">
                            <p>No se afectaron archivos.</p>
                          </div>
                      )}
                  </div>
              </div>
            ) : (
                <div className="text-center text-muted-foreground py-8">
                    <Info className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">No hay datos de CodeFix.</p>
                </div>
            )}
        </TabsContent>
        <TabsContent value="logs" className="m-0">
            <CodeBlock code={dbLog || log || "No hay logs disponibles."} />
        </TabsContent>
        </div>
      </Tabs>
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
