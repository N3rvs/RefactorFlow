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
  RefreshCw,
  Power,
  FileText,
  Trash2,
  BrainCircuit,
  Globe,
  Menu,
  ChevronRight,
  Database,
  Info
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";

function SchemaViewer({ schema, onRefresh, loading }: { schema: SchemaResponse | null; onRefresh: () => void; loading: boolean }) {
    if (!schema && !loading) return (
      <Card className="flex-grow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Esquema (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground h-48">
            <p>Presiona "Check Connection" para cargar el esquema.</p>
          </CardContent>
      </Card>
    );

    return (
        <Card className="flex-grow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Esquema (opcional)</CardTitle>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refrescar esquema
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2 py-4">
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                    </div>
                ) : (
                <Accordion type="multiple" className="w-full max-h-96 overflow-y-auto">
                    {schema?.tables.map((table) => (
                        <AccordionItem value={table.name} key={table.name}>
                            <AccordionTrigger className="text-sm font-normal">
                                <div className="flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4" />
                                    <Database className="h-4 w-4" />
                                    {table.name}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <UiTable>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Columna</TableHead>
                                            <TableHead>Tipo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {table.columns.map((col) => (
                                            <TableRow key={col.name}>
                                                <TableCell>{col.name}</TableCell>
                                                <TableCell>{col.sqlType}</TableCell>
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
  renames: [],
};

export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("server=myserver;Database=example;");
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true });
  const [rootKey, setRootKey] = useState("SOLUTION");
  const [activePlanTab, setActivePlanTab] = useState<"table" | "column">("table");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  
  const { toast, dismiss } = useToast();

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
     if (plan.renames.length === 0 && (loadingState === 'preview' || loadingState === 'apply' || loadingState === 'cleanup')) {
      toast({ variant: "destructive", title: "Refactor plan cannot be empty." });
      return;
    }

    setLoading(loadingState);
    const { id } = toast({ title: toastMessages.loading, duration: 999999 });

    try {
      const data = await apiFn();
      dismiss(id);
      toast({ variant: "default", title: toastMessages.success, duration: 3000 });
      onSuccess(data);
      if(loadingState === 'analyze') setConnectionOk(true);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      dismiss(id);
      toast({ variant: "destructive", title: toastMessages.error, description: errorMessage, duration: 5000 });
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
    (data) => setResult(data as any),
    { loading: "Generating plan...", success: "Plan generated.", error: "Failed to generate plan." }
  );

  const handleRefactor = (apply: boolean) => handleApiCall(
    () => runRefactor({ connectionString, plan, rootKey, ...options }, apply),
    apply ? "apply" : "preview",
    (data) => setResult(data),
    { 
      loading: apply ? "Aplicando cambios..." : "Generando preview...",
      success: apply ? "Cambios aplicados." : "Preview generada.",
      error: apply ? "Error al aplicar cambios." : "Error al generar preview."
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


  const handleAiGeneratePlan = () => {
     toast({ title: "AI Plan Generation", description: "This feature is not yet implemented." });
  }

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
                          Historial
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton>
                          <LayoutGrid />
                          Esquema
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <Settings />
                          Ajustes
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="p-2 border-t border-border">
                 <Button variant={connectionOk ? "secondary" : "outline"} className="w-full mt-2 justify-start gap-2" onClick={handleAnalyze}>
                      {loading === 'analyze' ? <Loader2 className="animate-spin" /> : <Power />}
                      <span>{connectionOk === null ? "Conexión" : connectionOk ? "Conexión Exitosa" : "Error Conexión"}</span>
                 </Button>
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <header className="sticky top-0 z-10 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <div className="mr-4 hidden md:flex">
                  <h1 className="text-xl font-medium">Refactar BD + Codigo</h1>
                </div>
                <SidebarTrigger className="md:hidden" />
                <div className="flex flex-1 items-center justify-end space-x-4">
                  <Badge variant="outline" className="text-xs font-normal">Development</Badge>
                  <Badge variant="secondary" className="text-xs font-normal flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    https://localhost:7040
                  </Badge>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
            </div>
        </header>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Column */}
              <div className="col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-medium text-base">Connection</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="connection-string" className="text-xs text-muted-foreground">Connection String</Label>
                            <Textarea
                              id="connection-string"
                              placeholder="server=myserver;Database=example;"
                              rows={3}
                              value={connectionString}
                              onChange={(e) => setConnectionString(e.target.value)}
                              className="font-mono text-sm mt-1 bg-background"
                            />
                        </div>
                         {/* Plan tabs */}
                        <div className="flex space-x-1 rounded-md bg-muted p-1">
                            <Button onClick={() => setActivePlanTab('table')} variant={activePlanTab === 'table' ? 'ghost' : 'ghost'} className={`w-full h-8 text-xs ${activePlanTab === 'table' ? 'bg-background shadow-sm' : ''}`}>Renombrar tabla</Button>
                            <Button onClick={() => setActivePlanTab('column')} variant={activePlanTab === 'column' ? 'ghost' : 'ghost'} className={`w-full h-8 text-xs ${activePlanTab === 'column' ? 'bg-background shadow-sm' : ''}`}>Renombrar columna</Button>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Opciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="use-synonyms" className="text-sm font-light flex items-center gap-2">
                                Use Synonyms
                                <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                            <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="use-views" className="text-sm font-light flex items-center gap-2">
                                Use Views
                                <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                            <Switch id="use-views" checked={options.useViews} onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="cqrs" className="text-sm font-light flex items-center gap-2">
                                CORS
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Label>
                             <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(checked) => setOptions(prev => ({...prev, cqrs: checked}))} />
                        </div>
                         <p className="text-xs text-muted-foreground pt-2">
                            Las visiaa son sofo lectura Cleam u tas elthrina cuando migres et zedigo.
                         </p>
                         {connectionOk && (
                            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-md p-3">
                                <CheckCircle className="h-4 w-4"/>
                                Conexion Exitosa
                            </div>
                         )}
                         <Button className="w-full" onClick={() => handleRefactor(false)} disabled={loading === 'preview'}>
                            {loading === 'preview' ? <Loader2 className="animate-spin" /> : null}
                            Preview
                         </Button>
                    </CardContent>
                </Card>

              </div>

              {/* Middle Column */}
              <div className="col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Acciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {result?.codefix ? (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Files scanned</span>
                            <span>{result.codefix.scanned}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Changed</span>
                            <span>{result.codefix.changed}</span>
                          </div>
                        </>
                      ) : (
                         <div className="text-center text-muted-foreground text-xs py-4">No hay acciones para mostrar.</div>
                      )}
                      
                      <div className="border-t border-border pt-4 space-y-2">
                         <Button variant="ghost" className="w-full justify-between text-muted-foreground font-normal">
                            <span>Analyzar</span>
                            <ChevronRight className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" className="w-full justify-between text-muted-foreground font-normal">
                            <span>Previosio</span>
                            <span className="text-foreground">Gengaurza</span>
                         </Button>
                      </div>

                      <div className="pt-4 space-y-3">
                        <Button variant="destructive" className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleRefactor(true)} disabled={loading === 'apply' || !result || result.apply === true}>
                            {loading === 'apply' ? <Loader2 className="animate-spin" /> : null}
                            Aplicar
                        </Button>
                        <Button variant="secondary" className="w-full" onClick={handleCleanup} disabled={loading === 'cleanup'}>
                           {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : null}
                           Cleanup
                        </Button>
                         <Button variant="outline" className="w-full" onClick={handleAnalyze} disabled={loading === 'analyze'}>
                           {loading === 'analyze' ? <Loader2 className="animate-spin" /> : null}
                           Analyze
                        </Button>
                      </div>
                    </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="col-span-1 flex flex-col gap-6">
                 <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
                 <SchemaViewer schema={schema} onRefresh={handleAnalyze} loading={loading === 'analyze'} />
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}

    