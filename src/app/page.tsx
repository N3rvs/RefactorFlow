"use client";

import { useState, useEffect } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, SchemaResponse, RenameOperation } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wand2,
  History,
  LayoutGrid,
  Settings,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Power,
  FileText,
  Trash2,
  PlusCircle,
  BrainCircuit,
  ClipboardCopy
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";

function SchemaViewer({ schema, onRefresh, loading }: { schema: SchemaResponse | null; onRefresh: () => void; loading: boolean }) {
    if (!schema && !loading) return null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Database Schema</CardTitle>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh Schema
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                    </div>
                ) : (
                <Accordion type="multiple" className="w-full max-h-96 overflow-y-auto">
                    {schema?.tables.map((table) => (
                        <AccordionItem value={table.name} key={table.name}>
                            <AccordionTrigger className="text-sm">
                                <div className="flex items-center gap-2">
                                    {table.name}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <UiTable>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Column</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Nullable</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {table.columns.map((col) => (
                                            <TableRow key={col.name}>
                                                <TableCell>{col.name}</TableCell>
                                                <TableCell>{col.sqlType}</TableCell>
                                                <TableCell>{col.isNullable ? 'Yes' : 'No'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </UiTable>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                )}
            </CardContent>
        </Card>
    );
}

const initialPlan: RefactorPlan = {
  renames: [
    { scope: 'table', tableFrom: 'Users', tableTo: 'Profiles', area: 'both' },
    { scope: 'column', tableFrom: 'Profiles', columnFrom: 'Email', columnTo: 'EmailAddress', type: 'nvarchar(255)', area: 'both' },
  ],
};


export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("server=myserver;Database=example;");
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  
  const { toast } = useToast();

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "An unknown error occurred.";
  }

  const handleApiCall = async <T,>(
    apiFn: () => Promise<T>,
    loadingState: "preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix",
    onSuccess: (data: T) => void,
    toastMessages: { loading: string; success: string; error: string }
  ) => {
    if (!connectionString.trim() && loadingState !== 'codefix') {
      toast({ variant: "destructive", title: "Connection string is required." });
      return;
    }
     if (plan.renames.length === 0) {
      toast({ variant: "destructive", title: "Refactor plan cannot be empty." });
      return;
    }

    setLoading(loadingState);
    const { id } = toast({ title: toastMessages.loading });

    try {
      const data = await apiFn();
      toast({ id, variant: "default", title: toastMessages.success });
      onSuccess(data);
      if(loadingState === 'analyze') setConnectionOk(true);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      toast({ id, variant: "destructive", title: toastMessages.error, description: errorMessage });
      if(loadingState === 'analyze') setConnectionOk(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => handleApiCall(
    () => analyzeSchema(connectionString),
    "analyze",
    (data) => setSchema(data),
    { loading: "Analyzing schema...", success: "Schema analysis complete.", error: "Schema analysis failed." }
  );

  const handlePlan = () => handleApiCall(
    () => generatePlan({ connectionString, renames: plan.renames, ...options }),
    "plan",
    (data) => setResult(data as any), // A bit of a hack as plan response is different
    { loading: "Generating plan...", success: "Plan generated.", error: "Failed to generate plan." }
  );

  const handleRefactor = (apply: boolean) => handleApiCall(
    () => runRefactor({ connectionString, plan, rootKey, ...options }, apply),
    apply ? "apply" : "preview",
    (data) => setResult(data),
    { 
      loading: apply ? "Applying changes..." : "Generating preview...",
      success: apply ? "Changes applied successfully." : "Preview generated.",
      error: apply ? "Failed to apply changes." : "Failed to generate preview."
    }
  );

  const handleCleanup = () => handleApiCall(
    () => runCleanup({ connectionString, renames: plan.renames, ...options }),
    "cleanup",
    (data) => setResult(data),
    { loading: "Running cleanup...", success: "Cleanup successful.", error: "Cleanup failed." }
  );
  
  const handleCodefix = (apply: boolean) => handleApiCall(
    () => runCodeFix({ rootKey, plan, apply }),
    "codefix",
    (data) => setResult({ ...result, codefix: data, ok: data.ok } as RefactorResponse),
    { 
      loading: apply ? "Applying code fixes..." : "Previewing code fixes...",
      success: apply ? "Code fixes applied." : "Code fix preview generated.",
      error: "Failed to run CodeFix."
    }
  );

  const handleRenameChange = (index: number, field: keyof RenameOperation, value: string | "table" | "column" | "both" | "db" | "code") => {
    const newRenames = [...plan.renames];
    const rename = { ...newRenames[index] };
    (rename as any)[field] = value;
    if(field === 'scope' && value === 'table') {
        rename.columnFrom = undefined;
        rename.columnTo = undefined;
    }
    newRenames[index] = rename;
    setPlan({ renames: newRenames });
  };

  const addRename = () => {
    const newRename: RenameOperation = { scope: 'column', tableFrom: '', columnFrom: '', tableTo: '', columnTo: '', area: 'both' };
    setPlan({ renames: [...plan.renames, newRename] });
  };

  const removeRename = (index: number) => {
    const newRenames = plan.renames.filter((_, i) => i !== index);
    setPlan({ renames: newRenames });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar>
          <SidebarHeader>
              <Logo />
          </SidebarHeader>
          <SidebarContent>
              <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                          <Wand2 />
                          Refactor
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton>
                          <History />
                          History
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton>
                          <LayoutGrid />
                          Schema
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <Settings />
                          Settings
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
              <div className="p-2">
                 <Button variant="outline" className="w-full mt-2" onClick={handleAnalyze}>
                      {loading === 'analyze' ? <Loader2 className="animate-spin" /> : <Power />}
                      {connectionOk ? "Connected" : "Check Connection"}
                 </Button>
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <header className="sticky top-0 z-10 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <div className="mr-4 hidden md:flex">
                  <h1 className="text-xl font-bold">DB + Code Refactor</h1>
                </div>
                <SidebarTrigger className="md:hidden" />
                <div className="flex flex-1 items-center justify-end space-x-4">
                  <Badge variant={connectionOk ? "default" : "secondary"} className={`hidden sm:inline-flex items-center text-xs ${connectionOk ? 'bg-green-600/20 text-green-300 border-green-600/30' : ''}`}>
                    <span className={`w-2 h-2 mr-2 rounded-full ${connectionOk ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    {connectionOk ? "Connected" : "Disconnected"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    v1.0.0
                  </Badge>
                </div>
            </div>
        </header>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              {/* Left Column */}
              <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Connection</CardTitle>
                        <CardDescription>Database connection details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="connection-string" className="text-sm">Connection String</Label>
                            <Textarea
                              id="connection-string"
                              placeholder="server=myserver;Database=example;"
                              rows={3}
                              value={connectionString}
                              onChange={(e) => setConnectionString(e.target.value)}
                              className="font-mono text-sm mt-2"
                            />
                        </div>
                        <div>
                           <Label htmlFor="root-key" className="text-sm">Solution Root Key</Label>
                           <Input id="root-key" value={rootKey} onChange={(e) => setRootKey(e.target.value)} placeholder="SOLUTION" className="mt-2"/>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Refactor Plan</CardTitle>
                        <CardDescription>Define table and column rename operations.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4">
                          {plan.renames.map((rename, index) => (
                              <div key={index} className="p-4 border rounded-md relative space-y-3">
                                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeRename(index)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  <div className="flex gap-4 items-end">
                                      <div className="space-y-1.5 w-1/3">
                                          <Label htmlFor={`scope-${index}`}>Scope</Label>
                                          <select id={`scope-${index}`} value={rename.scope} onChange={(e) => handleRenameChange(index, 'scope', e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                              <option value="table">Table</option>
                                              <option value="column">Column</option>
                                          </select>
                                      </div>
                                      <div className="space-y-1.5 flex-1">
                                          <Label htmlFor={`tableFrom-${index}`}>From</Label>
                                          <Input id={`tableFrom-${index}`} value={rename.tableFrom} onChange={(e) => handleRenameChange(index, 'tableFrom', e.target.value)} placeholder={rename.scope === 'table' ? 'Original table name' : 'Table name'} />
                                      </div>
                                      <div className="space-y-1.5 flex-1">
                                          <Label htmlFor={`tableTo-${index}`}>To</Label>
                                          <Input id={`tableTo-${index}`} value={rename.tableTo || ''} onChange={(e) => handleRenameChange(index, 'tableTo', e.target.value)} placeholder={rename.scope === 'table' ? 'New table name' : 'New table (optional)'} />
                                      </div>
                                  </div>
                                  {rename.scope === 'column' && (
                                    <div className="flex gap-4 items-end">
                                        <div className="space-y-1.5 flex-1">
                                            <Label htmlFor={`columnFrom-${index}`}>Column From</Label>
                                            <Input id={`columnFrom-${index}`} value={rename.columnFrom || ''} onChange={(e) => handleRenameChange(index, 'columnFrom', e.target.value)} placeholder="Original column name" />
                                        </div>
                                        <div className="space-y-1.5 flex-1">
                                            <Label htmlFor={`columnTo-${index}`}>Column To</Label>
                                            <Input id={`columnTo-${index}`} value={rename.columnTo || ''} onChange={(e) => handleRenameChange(index, 'columnTo', e.target.value)} placeholder="New column name" />
                                        </div>
                                         <div className="space-y-1.5 w-1/3">
                                            <Label htmlFor={`type-${index}`}>Type</Label>
                                            <Input id={`type-${index}`} value={rename.type || ''} onChange={(e) => handleRenameChange(index, 'type', e.target.value)} placeholder="eg. nvarchar(100)" />
                                        </div>
                                    </div>
                                  )}
                              </div>
                          ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" onClick={addRename}><PlusCircle /> Add Operation</Button>
                        <Button variant="outline" size="sm" ><BrainCircuit /> AI Generate Plan</Button>
                      </div>
                    </CardContent>
                </Card>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                          <CardTitle>Options</CardTitle>
                          <CardDescription>Compatibility & refactor settings</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="use-synonyms">Use Synonyms</Label>
                                <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="use-views">Use Views</Label>
                                <Switch id="use-views" checked={options.useViews} onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cqrs">CQRS</Label>
                                <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(checked) => setOptions(prev => ({...prev, cqrs: checked}))} />
                            </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                          <CardTitle>Actions</CardTitle>
                          <CardDescription>Execute or simulate the plan</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <Button onClick={() => handleRefactor(false)} disabled={!!loading}>
                                {loading === 'preview' ? <Loader2 className="animate-spin" /> : <FileText />} Preview
                            </Button>
                            <Button onClick={() => handleRefactor(true)} disabled={!!loading || !result || result.apply === true}>
                                {loading === 'apply' ? <Loader2 className="animate-spin" /> : <CheckCircle />} Apply Changes
                            </Button>
                            <Button variant="destructive" onClick={handleCleanup} disabled={!!loading}>
                                {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : <Trash2 />} Cleanup
                            </Button>
                        </CardContent>
                    </Card>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6">
                    <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
                    <SchemaViewer schema={schema} onRefresh={handleAnalyze} loading={loading === 'analyze'} />
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}
