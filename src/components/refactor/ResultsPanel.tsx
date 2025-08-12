"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, FileText, Bot, Terminal, DatabaseZap, ClipboardCopy, Info } from "lucide-react";
import type { RefactorResponse } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";
import { Button } from "../ui/button";

interface ResultsPanelProps {
  result: RefactorResponse | null;
  loading: boolean;
  error: string | null;
}

const LoadingSkeleton = () => (
    <div className="space-y-4">
        <div className="flex space-x-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
        </div>
        <Skeleton className="h-40 w-full rounded-md" />
    </div>
);

export default function ResultsPanel({ result, loading, error }: ResultsPanelProps) {
  const renderContent = () => {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error && !result) { // Only show full-panel error if there's no partial result
      return (
        <Alert variant="destructive">
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
                <p className="mt-1 text-sm">Your action results will appear here.</p>
            </div>
        );
    }

    const { sql, codefix, dbLog, log } = result;

    return (
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="sql">SQL</TabsTrigger>
          <TabsTrigger value="codefix">CodeFix</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {result.ok ? <CheckCircle className="text-green-500"/> : <AlertTriangle className="text-destructive"/>}
                        Execution Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                   <div className="flex items-center gap-2">
                     <p className="font-medium">Status:</p> 
                     <Badge variant={result.ok ? "default" : "destructive"} className={result.ok ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''}>
                        {result.ok ? "Success" : "Failed"}
                     </Badge>
                   </div>
                    {result.apply !== undefined && <p><span className="font-medium">Mode:</span> <Badge variant="outline">{result.apply ? "Apply" : "Preview"}</Badge></p>}
                   {codefix && (
                    <>
                    <p><span className="font-medium">Files Scanned:</span> {codefix.scanned}</p>
                    <p><span className="font-medium">Files Changed:</span> {codefix.changed}</p>
                    </>
                   )}
                   {error && (
                     <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Operation Error</AlertTitle>
                        <AlertDescription><pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre></AlertDescription>
                    </Alert>
                   )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="sql" className="mt-4">
            <Tabs defaultValue="rename" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="rename">Rename</TabsTrigger>
                    <TabsTrigger value="compat">Compatibility</TabsTrigger>
                    <TabsTrigger value="cleanup">Cleanup</TabsTrigger>
                </TabsList>
                <TabsContent value="rename" className="mt-4"><CodeBlock code={sql?.renameSql} /></TabsContent>
                <TabsContent value="compat" className="mt-4"><CodeBlock code={sql?.compatSql} /></TabsContent>
                <TabsContent value="cleanup" className="mt-4"><CodeBlock code={sql?.cleanupSql} /></TabsContent>
            </Tabs>
        </TabsContent>
        <TabsContent value="codefix" className="mt-4">
            {codefix ? (
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Bot /> CodeFix Report</CardTitle>
                      <CardDescription>{codefix.changed} of {codefix.scanned} files changed.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="max-h-96 overflow-y-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>File Path</TableHead>
                                      <TableHead className="w-24 text-center">Changed</TableHead>
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
                                          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">No files were affected.</TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
              </Card>
            ) : (
                <div className="text-center text-muted-foreground py-16">
                    <Info className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">No CodeFix Data</h3>
                    <p className="mt-1 text-sm">Run a preview or apply changes to generate a CodeFix report.</p>
                </div>
            )}
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Terminal /> Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <CodeBlock code={dbLog || log || "No logs available for this operation."} />
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <FileText /> Result
        </CardTitle>
        <CardDescription>View the outcome of your refactor operations.</CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
