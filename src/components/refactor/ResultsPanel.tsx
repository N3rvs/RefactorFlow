"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, FileText, Bot, Terminal, DatabaseZap, Info, ChevronRight, Eye } from "lucide-react";
import type { RefactorResponse } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";

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
  const renderContent = () => {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error && !result) {
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
            <div className="text-center text-muted-foreground py-16">
                <DatabaseZap className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-medium">Listo para Refactorizar</h3>
                <p className="mt-1 text-sm">Los resultados de tus acciones aparecerán aquí.</p>
            </div>
        );
    }

    const { sql, codefix, dbLog, log } = result;

    return (
      <Tabs defaultValue="summary" className="w-full">
        <div className="px-6 pt-6">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="sql">SQL</TabsTrigger>
            <TabsTrigger value="codefix">CodeFix</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="p-6">
            <div className="border rounded-md">
                <div className="p-4 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         <span className={`w-2 h-2 mr-2 rounded-full ${result.ok ? 'bg-green-500' : 'bg-destructive'}`}></span>
                         <p className="font-medium text-sm">Resumen</p> 
                         <Badge variant={result.ok ? "default" : "destructive"} className={`text-xs ${result.ok ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''}`}>
                            {result.ok ? "ok" : "failed"}
                         </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{result.apply ? "Apply" : "Preview"}</span>
                        <ChevronRight className="h-4 w-4" />
                    </div>
                </div>
                <div className="p-4">
                   {codefix && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File</span>
                        <span className="font-mono">{codefix.files.find(f => f.changed)?.path.split('/').pop() || 'N/A'}</span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-muted-foreground">Changed</span>
                        <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                          <CheckCircle className="h-3 w-3 mr-1"/>
                          <span>Sí</span>
                        </Badge>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-muted-foreground">Preview</span>
                         <button className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1">
                           <Eye className="h-3 w-3"/> Ver
                         </button>
                      </div>
                    </div>
                   )}
                   {error && (
                     <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error de Operación</AlertTitle>
                        <AlertDescription><pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre></AlertDescription>
                    </Alert>
                   )}
                   {!codefix && !error && (
                     <p className="text-sm text-muted-foreground text-center py-4">No hay resumen disponible.</p>
                   )}
                </div>
            </div>
        </TabsContent>
        <TabsContent value="sql" className="p-6">
            <Tabs defaultValue="rename" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="rename">Rename</TabsTrigger>
                    <TabsTrigger value="compat">Compatibility</TabsTrigger>
                    <TabsTrigger value="cleanup">Cleanup</TabsTrigger>
                </TabsList>
                <div className="mt-4 border rounded-md">
                  <TabsContent value="rename" className="m-0"><CodeBlock code={sql?.renameSql} /></TabsContent>
                  <TabsContent value="compat" className="m-0"><CodeBlock code={sql?.compatSql} /></TabsContent>
                  <TabsContent value="cleanup" className="m-0"><CodeBlock code={sql?.cleanupSql} /></TabsContent>
                </div>
            </Tabs>
        </TabsContent>
        <TabsContent value="codefix" className="p-6">
            {codefix ? (
              <div className="border rounded-md">
                  <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><Bot /> Reporte CodeFix</CardTitle>
                      <p className="text-xs text-muted-foreground">{codefix.changed} de {codefix.scanned} archivos cambiaron.</p>
                  </CardHeader>
                  <CardContent>
                      <div className="max-h-80 overflow-y-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Archivo</TableHead>
                                      <TableHead className="w-24 text-center">Cambiado</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {codefix.files?.length > 0 ? codefix.files.map(file => (
                                      <TableRow key={file.path}>
                                          <TableCell className="font-mono text-xs">{file.path}</TableCell>
                                          <TableCell className="text-center">
                                              {file.changed ? 
                                                  <CheckCircle className="h-5 w-5 text-green-500 inline-block"/> : 
                                                  <span className="text-muted-foreground">-</span>}
                                          </TableCell>
                                      </TableRow>
                                  )) : (
                                      <TableRow>
                                          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">No se afectaron archivos.</TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
              </div>
            ) : (
                <div className="text-center text-muted-foreground py-16 border rounded-md">
                    <Info className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">Sin datos de CodeFix</h3>
                    <p className="mt-1 text-sm">Ejecuta un preview o aplica cambios para generar un reporte.</p>
                </div>
            )}
        </TabsContent>
        <TabsContent value="logs" className="p-6">
            <div className="border rounded-md">
                <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2"><Terminal /> Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <CodeBlock code={dbLog || log || "No hay logs disponibles para esta operación."} />
                </CardContent>
            </div>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Resultado
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{renderContent()}</CardContent>
    </Card>
  );
}
