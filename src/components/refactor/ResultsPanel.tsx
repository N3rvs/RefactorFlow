
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
                <h3 className="mt-4 text-lg font-medium">Ready to Refactor</h3>
                <p className="mt-1 text-sm">The results of your actions will appear here.</p>
            </div>
        );
    }

    const { sql, codefix, dbLog, log } = result;
    const changedFile = codefix?.files.find(f => f.changed);

    return (
      <>
      <Tabs defaultValue="summary" className="w-full">
        <div className="px-6 pt-0">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="summary">Summary</TabsTrigger>
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
                         <p className="font-medium text-sm">Summary</p> 
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
                        <span className="font-mono">{changedFile?.path.split('/').pop() || 'N/A'}</span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-muted-foreground">Changed</span>
                        <Badge variant="outline" className={changedFile ? "text-green-400 border-green-500/30 bg-green-500/10" : ""}>
                          {changedFile ? <CheckCircle className="h-3 w-3 mr-1"/> : null}
                          <span>{changedFile ? 'Yes' : 'No'}</span>
                        </Badge>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-muted-foreground">Preview</span>
                         <button 
                            className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!changedFile}
                            onClick={() => changedFile && setSelectedFile(changedFile)}
                         >
                           <Eye className="h-3 w-3"/> View
                         </button>
                      </div>
                    </div>
                   )}
                   {error && (
                     <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Operation Error</AlertTitle>
                        <AlertDescription><pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre></AlertDescription>
                    </Alert>
                   )}
                   {!codefix && !error && (
                     <p className="text-sm text-muted-foreground text-center py-4">No summary available.</p>
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
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><Bot /> CodeFix Report</CardTitle>
                      <p className="text-xs text-muted-foreground">{codefix.changed} of {codefix.scanned} files changed.</p>
                  </CardHeader>
                  <CardContent>
                      <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="border-b">
                                      <th className="p-2 text-left font-medium text-muted-foreground">File</th>
                                      <th className="p-2 w-24 text-center font-medium text-muted-foreground">Changed</th>
                                      <th className="p-2 w-24 text-center font-medium text-muted-foreground">Preview</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {codefix.files?.length > 0 ? codefix.files.map(file => (
                                      <tr key={file.path} className="border-b">
                                          <td className="p-2 font-mono text-xs">{file.path}</td>
                                          <td className="text-center">
                                              {file.changed ? 
                                                  <CheckCircle className="h-5 w-5 text-green-500 inline-block"/> : 
                                                  <span className="text-muted-foreground">-</span>}
                                          </td>
                                           <td className="text-center">
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                disabled={!file.changed}
                                                onClick={() => setSelectedFile(file)}
                                              >
                                                <Eye className="h-4 w-4" />
                                              </Button>
                                          </td>
                                      </tr>
                                  )) : (
                                      <tr>
                                          <td colSpan={3} className="text-center text-muted-foreground py-8">No files were affected.</td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </CardContent>
              </div>
            ) : (
                <div className="text-center text-muted-foreground py-16 border rounded-md">
                    <Info className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">No CodeFix data</h3>
                    <p className="mt-1 text-sm">Run a preview or apply changes to generate a report.</p>
                </div>
            )}
        </TabsContent>
        <TabsContent value="logs" className="p-6">
            <div className="border rounded-md">
                <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2"><Terminal /> Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <CodeBlock code={dbLog || log || "No logs available for this operation."} />
                </CardContent>
            </div>
        </TabsContent>
      </Tabs>
      {selectedFile && (
        <CodeDiffViewer 
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
      </>
    );
  };

  return (
    <Card>
       <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Result
        </CardTitle>
        {result && (
            <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${result.ok ? 'bg-green-500' : 'bg-destructive'}`}></span>
                <Badge variant={result.ok ? "default" : "destructive"} className={`text-xs ${result.ok ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''}`}>
                    {result.apply ? 'Applied' : 'Preview'} - {result.ok ? "OK" : "Failed"}
                </Badge>
            </div>
        )}
      </CardHeader>
      <CardContent className="p-0">{renderContent()}</CardContent>
    </Card>
  );
}
