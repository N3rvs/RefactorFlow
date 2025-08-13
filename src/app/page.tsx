
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
  Info,
  PlusCircle,
  XCircle,
  Eye,
  FileCode,
  Box,
  SlidersHorizontal
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { Checkbox } from "@/components/ui/checkbox";

function SchemaViewer({ schema, onRefresh, loading }: { schema: SchemaResponse | null; onRefresh: () => void; loading: boolean }) {
    if (!schema && !loading) return (
      <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Esquema (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground h-48">
            <p className="text-xs">Presiona "Check Connection" para cargar el esquema.</p>
          </CardContent>
      </Card>
    );

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Esquema (opcional)</CardTitle>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Refrescar
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2 py-4">
                        <div className="h-6 rounded-md bg-muted animate-pulse" />
                        <div className="h-6 rounded-md bg-muted animate-pulse" />
                        <div className="h-6 rounded-md bg-muted animate-pulse" />
                    </div>
                ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {schema?.tables.map((table) => (
                    <div key={table.name} className="flex items-center space-x-2">
                      <Checkbox id={`table-${table.name}`} />
                      <label htmlFor={`table-${table.name}`} className="text-sm font-light text-muted-foreground">{table.name}</label>
                    </div>
                  ))}
                </div>
                )}
            </CardContent>
        </Card>
    );
}

const initialPlan: RefactorPlan = {
  renames: [],
};

const initialNewRename: Omit<RenameOperation, 'scope'> = {
  tableFrom: "",
  tableTo: "",
  columnFrom: "",
  columnTo: "",
  type: "",
};


export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("Server=NERVELESS;Database=StoreGuille;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True;");
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [newRename, setNewRename] = useState(initialNewRename);
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
    if (!connectionString.trim() && !['codefix', 'plan'].includes(loadingState)) {
      toast({ variant: "destructive", title: "Connection string is required." });
      return;
    }
     if (plan.renames.length === 0 && ['preview', 'apply', 'cleanup', 'plan', 'codefix'].includes(loadingState)) {
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
    () => generatePlan({ renames: plan.renames, ...options }),
    "plan",
    (data) => setResult(prev => ({ ...prev, sql: data.sql, ok: true })),
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
    (data) => setResult(prev => ({ ...prev, codefix: data, ok: data.ok })),
    { 
      loading: apply ? "Applying code fixes..." : "Previewing code fixes...",
      success: apply ? "Code fixes applied." : "Code fix preview generated.",
      error: "Failed to run CodeFix."
    }
  );

  const addRename = () => {
    const operation: RenameOperation = {
      scope: activePlanTab,
      ...newRename,
    };
    if (!operation.tableFrom || (operation.scope === 'column' && !operation.columnFrom)) {
        toast({ variant: 'destructive', title: 'Faltan campos obligatorios.' });
        return;
    }
    setPlan(prev => ({ ...prev, renames: [...prev.renames, operation] }));
    setNewRename(initialNewRename);
  };
  
  const removeRename = (index: number) => {
    setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
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
                          Historial
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <Box />
                          Esquema
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <SlidersHorizontal />
                          Ajustes
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="p-2 border-t border-border">
                 <Button variant={connectionOk ? "secondary" : "outline"} className="w-full mt-2 justify-start gap-2" onClick={handleAnalyze}>
                      {loading === 'analyze' ? <Loader2 className="animate-spin" /> : <Power />}
                      <span>{connectionOk === null ? "Check Connection" : connectionOk ? "Connection OK" : "Connection Failed"}</span>
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
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    https://localhost:7040
                  </Badge>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
            </div>
        </header>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              
              <div className="col-span-2 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-medium text-base">Connection</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                        <div className="flex space-x-1 rounded-md bg-muted p-1 mt-4">
                            <Button onClick={() => setActivePlanTab('table')} variant={activePlanTab === 'table' ? 'ghost' : 'ghost'} className={`w-full h-8 text-xs ${activePlanTab === 'table' ? 'bg-card shadow-sm' : ''}`}>Renombrar tabla</Button>
                            <Button onClick={() => setActivePlanTab('column')} variant={activePlanTab === 'column' ? 'ghost' : 'ghost'} className={`w-full h-8 text-xs ${activePlanTab === 'column' ? 'bg-card shadow-sm' : ''}`}>Renombrar columna</Button>
                        </div>
                        <div className="space-y-3 pt-4">
                          <Input
                            placeholder="Tabla Origen"
                            value={newRename.tableFrom}
                            onChange={(e) => setNewRename(prev => ({...prev, tableFrom: e.target.value}))}
                          />
                          {activePlanTab === 'column' && (
                             <Input
                              placeholder="Columna Origen"
                              value={newRename.columnFrom}
                              onChange={(e) => setNewRename(prev => ({...prev, columnFrom: e.target.value}))}
                            />
                          )}
                           <Input
                            placeholder={`${activePlanTab === 'table' ? 'Tabla' : 'Columna'} Destino`}
                            value={activePlanTab === 'table' ? newRename.tableTo : newRename.columnTo}
                            onChange={(e) => setNewRename(prev => activePlanTab === 'table' ? {...prev, tableTo: e.target.value} : {...prev, columnTo: e.target.value})}
                          />
                          <Button onClick={addRename} size="sm" className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir al Plan
                          </Button>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Plan de Refactorización</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {plan.renames.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aún no hay cambios en el plan.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {plan.renames.map((op, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                                <div className="text-xs">
                                    <Badge variant="outline" className="mr-2">{op.scope}</Badge>
                                    <span className="font-mono">{op.scope === 'table' ? `${op.tableFrom} -> ${op.tableTo}` : `${op.tableFrom}.${op.columnFrom} -> ${op.columnTo}`}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRename(index)}>
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                          ))}
                        </div>
                      )}
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
                            </Label>
                            <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="use-views" className="text-sm font-light flex items-center gap-2">
                                Use Views
                            </Label>
                            <Switch id="use-views" checked={options.useViews} onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="cqrs" className="text-sm font-light flex items-center gap-2">
                                CORS
                             </Label>
                             <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(checked) => setOptions(prev => ({...prev, cqrs: checked}))} />
                        </div>
                        <p className="text-xs text-muted-foreground pt-2">Las vistas de solo lectura y los sinónimos permiten que el código cliente heredado funcione sin cambios inmediatos.</p>
                    </CardContent>
                </Card>

              </div>

              <div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="col-span-2">
                    <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
                  </div>
                  <div className="col-span-1">
                     <Card>
                        <CardHeader>
                          <CardTitle className="text-base font-medium">Acciones</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                           <Button variant="outline" className="w-full justify-start" onClick={() => handleRefactor(false)} disabled={loading === 'preview'}>
                              {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                              Preview
                          </Button>
                           <Button variant="outline" className="w-full justify-start" onClick={handlePlan} disabled={loading === 'plan'}>
                              {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                              Generate SQL
                          </Button>
                          <Button variant="destructive" className="w-full" onClick={() => handleRefactor(true)} disabled={loading === 'apply' || !result || result.apply === true}>
                                {loading === 'apply' ? <Loader2 className="animate-spin" /> : null}
                                Aplicar
                          </Button>
                           <Button variant="secondary" className="w-full" onClick={handleCleanup} disabled={loading === 'cleanup'}>
                               {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : null}
                               Cleanup
                            </Button>
                             <Button variant="outline" className="w-full justify-start" onClick={handleAnalyze} disabled={loading === 'analyze'}>
                              {loading === 'analyze' ? <Loader2 className="animate-spin" /> : <Database/>}
                              Analyze
                          </Button>
                        </CardContent>
                    </Card>
                  </div>
                   <div className="col-span-1">
                      <SchemaViewer schema={schema} onRefresh={handleAnalyze} loading={loading === 'analyze'} />
                   </div>
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}


    