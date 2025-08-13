
"use client";

import { useState, useEffect } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, SchemaResponse, RenameOperation } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
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
  SlidersHorizontal,
  Pencil,
  Sparkles,
  Play
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { Checkbox } from "@/components/ui/checkbox";

function SchemaViewer({ 
    schema, 
    onRefresh, 
    loading,
    plan,
    onPlanChange
}: { 
    schema: SchemaResponse | null; 
    onRefresh: () => void; 
    loading: boolean;
    plan: RefactorPlan;
    onPlanChange: (newPlan: RefactorPlan) => void;
}) {
    const hasSchema = schema && schema.tables && schema.tables.length > 0;
    const [newColumns, setNewColumns] = useState<Record<string, { name: string; type: string }>>({});


    const handleTableNameChange = (originalName: string, newName: string) => {
        // Remove existing rename for this table if new name is same as original
        if (newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'table' && r.tableFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }

        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'table' && r.tableFrom === originalName);

        if (existingRenameIndex > -1) {
            // Update existing table rename
            const updatedRenames = [...plan.renames];
            updatedRenames[existingRenameIndex] = { ...updatedRenames[existingRenameIndex], tableTo: newName };
            onPlanChange({ ...plan, renames: updatedRenames });
        } else if (newName) {
            // Add new table rename
            const newRename: RenameOperation = {
                scope: 'table',
                tableFrom: originalName,
                tableTo: newName,
            };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
        }
    };
    
    const handleColumnNameChange = (tableName: string, originalName: string, newName: string) => {
        // Remove existing rename for this column if new name is same as original
        if (newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }
        
        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName);

        if (existingRenameIndex > -1) {
            // Update existing column rename
             const updatedRenames = [...plan.renames];
             updatedRenames[existingRenameIndex] = { ...updatedRenames[existingRenameIndex], columnTo: newName };
             onPlanChange({ ...plan, renames: updatedRenames });
        } else if (newName) {
            // Add new column rename
            const newRename: RenameOperation = {
                scope: 'column',
                tableFrom: tableName,
                columnFrom: originalName,
                columnTo: newName,
            };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
        }
    };
    
    const handleColumnTypeChange = (tableName: string, columnName: string, newType: string, originalType: string) => {
        const isChangingType = newType && newType !== originalType;

        let updatedRenames = [...plan.renames];
        const existingRenameIndex = updatedRenames.findIndex(r => r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === columnName);

        if (existingRenameIndex > -1) {
            // If it exists, update it.
            const existing = updatedRenames[existingRenameIndex];
            if (isChangingType) {
                 updatedRenames[existingRenameIndex] = { ...existing, type: newType };
            } else {
                 const { type, ...rest } = existing;
                 updatedRenames[existingRenameIndex] = rest;
            }
        } else if (isChangingType) {
            // If it doesn't exist, create it.
            const newRename: RenameOperation = {
                scope: 'column',
                tableFrom: tableName,
                columnFrom: columnName,
                type: newType,
            };
            updatedRenames.push(newRename);
        }
        
        onPlanChange({ ...plan, renames: updatedRenames });
    };

    const handleAddNewColumn = (tableName: string) => {
        const newId = `new-${tableName}-${Date.now()}`;
        setNewColumns(prev => ({...prev, [newId]: { name: '', type: '' }}));
    };

    const handleNewColumnChange = (id: string, field: 'name' | 'type', value: string) => {
        setNewColumns(prev => ({ ...prev, [id]: { ...prev[id], [field]: value }}));
    };

    const confirmAddColumn = (id: string, tableName: string) => {
        const newColumn = newColumns[id];
        if (newColumn && newColumn.name && newColumn.type) {
            const newRename: RenameOperation = {
                scope: 'add-column',
                tableFrom: tableName,
                columnTo: newColumn.name,
                type: newColumn.type,
            };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
            
            const tempNewCols = {...newColumns};
            delete tempNewCols[id];
            setNewColumns(tempNewCols);
        }
    };

    const cancelAddColumn = (id: string) => {
        const tempNewCols = {...newColumns};
        delete tempNewCols[id];
        setNewColumns(tempNewCols);
    };


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Esquema de Base de Datos</CardTitle>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Refrescar
                </Button>
            </CardHeader>
            <CardContent>
                {loading && (
                    <div className="space-y-2 py-4">
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-8 rounded-md bg-muted animate-pulse" />
                    </div>
                )}
                 {!loading && !hasSchema && (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96">
                        <Database className="h-16 w-16 mb-4" />
                        <h3 className="text-lg font-medium">Conecta tu base de datos</h3>
                        <p className="text-sm">Presiona "Check Connection" para cargar y visualizar el esquema.</p>
                    </div>
                )}
                {hasSchema && !loading && (
                    <Accordion type="multiple" className="w-full max-h-[calc(100vh-20rem)] overflow-y-auto pr-2">
                        {schema.tables.map((table) => (
                            <AccordionItem value={table.name} key={table.name}>
                                <AccordionTrigger>
                                  <div className="flex items-center gap-2 flex-1 group mr-4">
                                     <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                     <Input 
                                        defaultValue={table.name}
                                        className="h-8 border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent"
                                        onBlur={(e) => handleTableNameChange(table.name, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                     />
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pl-6">
                                    <div className="space-y-1">
                                        {table.columns.map(col => (
                                            <div key={col.name} className="flex justify-between items-center text-xs group gap-2">
                                                <div className="flex items-center gap-2 flex-1">
                                                   <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                                   <Input 
                                                      defaultValue={col.name}
                                                      className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent"
                                                      onBlur={(e) => handleColumnNameChange(table.name, col.name, e.target.value)}
                                                      onClick={(e) => e.stopPropagation()}
                                                   />
                                                </div>
                                                <Input 
                                                    defaultValue={col.sqlType}
                                                    className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent font-mono text-sky-400 w-24"
                                                    onBlur={(e) => handleColumnTypeChange(table.name, col.name, e.target.value, col.sqlType)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        ))}
                                         {Object.entries(newColumns).filter(([id]) => id.includes(`-${table.name}-`)).map(([id, col]) => (
                                            <div key={id} className="flex justify-between items-center text-xs group gap-2 p-2 bg-muted/50 rounded-md">
                                                <div className="flex items-center gap-2 flex-1">
                                                   <Input 
                                                      placeholder="nombre_columna"
                                                      className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent"
                                                      value={col.name}
                                                      onChange={(e) => handleNewColumnChange(id, 'name', e.target.value)}
                                                      onClick={(e) => e.stopPropagation()}
                                                   />
                                                </div>
                                                <Input 
                                                    placeholder="tipo_dato"
                                                    className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent font-mono text-sky-400 w-24"
                                                     value={col.type}
                                                      onChange={(e) => handleNewColumnChange(id, 'type', e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => confirmAddColumn(id, table.name)}><CheckCircle className="h-4 w-4 text-green-500"/></Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelAddColumn(id)}><XCircle className="h-4 w-4 text-red-500"/></Button>
                                            </div>
                                        ))}
                                        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => handleAddNewColumn(table.name)}>
                                            <PlusCircle className="mr-2 h-3 w-3" /> Añadir Columna
                                        </Button>
                                    </div>
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

const initialNewRename: RenameOperation = {
  scope: "table",
  tableFrom: "",
  tableTo: "",
  columnFrom: "",
  columnTo: "",
  type: "",
};


export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("Server=NERVELESS;Database=StoreGuille;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True;");
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [newRename, setNewRename] = useState<RenameOperation>(initialNewRename);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
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
     if (plan.renames.length === 0 && !['analyze'].includes(loadingState)) {
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
    (data) => setResult(prev => ({ ...prev, sql: data.sql, ok: true, apply: false, codefix: prev?.codefix || null, dbLog: prev?.dbLog, log: prev?.log })),
    { loading: "Generating plan...", success: "Plan generated.", error: "Failed to generate plan." }
  );

  const handleRefactor = (apply: boolean) => handleApiCall(
    () => runRefactor({ connectionString, plan, rootKey, ...options }, apply),
    apply ? "apply" : "preview",
    (data) => setResult(prev => ({ ...prev, ...data })),
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
    (data) => setResult(prev => ({ ...prev, codefix: data, ok: data.ok, apply: apply, sql: prev?.sql || null })),
    { 
      loading: apply ? "Applying code fixes..." : "Previewing code fixes...",
      success: apply ? "Code fixes applied." : "Code fix preview generated.",
      error: "Failed to run CodeFix."
    }
  );
  
  const handleAddManualRename = () => {
    if (!newRename.tableFrom) {
      toast({ variant: "destructive", title: "Table From is required" });
      return;
    }
    setPlan(prev => ({ ...prev, renames: [...prev.renames, newRename] }));
    setNewRename(initialNewRename);
  };
  
  const removeRename = (index: number) => {
    setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
  };
  
  useEffect(() => {
    if (result && result.error) {
        toast({
            title: `Operación fallida`,
            description: getErrorMessage(result.error),
            variant: "destructive",
            duration: 5000
        })
    }
  }, [result, toast]);

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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start h-full">
              
              <div className="lg:col-span-2 flex flex-col gap-6">
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
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Limpieza</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       <p className="text-xs text-muted-foreground pb-2">Una vez aplicados los cambios y actualizado el código, puedes eliminar los elementos de compatibilidad (vistas/sinónimos).</p>
                       <Button variant="secondary" className="w-full" onClick={handleCleanup} disabled={loading === 'cleanup'}>
                           {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                           Cleanup
                        </Button>
                    </CardContent>
                </Card>

              </div>

              <div className="lg:col-span-3 flex flex-col gap-6">
                  <SchemaViewer 
                    schema={schema} 
                    onRefresh={handleAnalyze} 
                    loading={loading === 'analyze'}
                    plan={plan}
                    onPlanChange={setPlan}
                   />
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Plan de Refactorización</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <Accordion type="single" collapsible>
                            <AccordionItem value="manual-add">
                                <AccordionTrigger className="text-sm">Añadir operación manual</AccordionTrigger>
                                <AccordionContent className="space-y-3 pt-4">
                                     <div className="grid grid-cols-2 gap-3">
                                         <div>
                                            <Label className="text-xs">Scope</Label>
                                            <select
                                                value={newRename.scope}
                                                onChange={(e) => setNewRename(prev => ({ ...prev, scope: e.target.value as "table" | "column" | "add-column" }))}
                                                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                            >
                                                <option value="table">Table</option>
                                                <option value="column">Column</option>
                                                <option value="add-column">Add Column</option>
                                            </select>
                                        </div>
                                         <div>
                                            <Label className="text-xs">Table From</Label>
                                            <Input value={newRename.tableFrom} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                    </div>
                                    {newRename.scope === 'table' && (
                                        <div>
                                            <Label className="text-xs">Table To</Label>
                                            <Input value={newRename.tableTo} onChange={(e) => setNewRename(prev => ({ ...prev, tableTo: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                    )}
                                    {newRename.scope === 'column' && (
                                         <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs">Column From</Label>
                                                <Input value={newRename.columnFrom} onChange={(e) => setNewRename(prev => ({ ...prev, columnFrom: e.target.value }))} className="h-9 text-sm" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Column To</Label>
                                                <Input value={newRename.columnTo} onChange={(e) => setNewRename(prev => ({ ...prev, columnTo: e.target.value }))} className="h-9 text-sm" />
                                            </div>
                                        </div>
                                    )}
                                    {(newRename.scope === 'column' || newRename.scope === 'add-column') && (
                                         <div>
                                            <Label className="text-xs">Type</Label>
                                            <Input value={newRename.type} onChange={(e) => setNewRename(prev => ({ ...prev, type: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                    )}
                                    <Button size="sm" onClick={handleAddManualRename} className="w-full">Añadir al plan</Button>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <Separator />

                      {plan.renames.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aún no hay cambios en el plan.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {plan.renames.map((op, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                                <div className="text-xs">
                                    <Badge variant="outline" className="mr-2">{op.scope}</Badge>
                                    <span className="font-mono">{
                                        op.scope === 'table' ? `${op.tableFrom} -> ${op.tableTo}` : 
                                        op.scope === 'add-column' ? `ADD ${op.columnTo}(${op.type}) TO ${op.tableFrom}` :
                                        `${op.tableFrom}.${op.columnFrom} -> ${op.columnTo || op.columnFrom}${op.type ? ` (${op.type})` : ''}`
                                    }</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRename(index)}>
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={loading === 'preview' || plan.renames.length === 0}>
                          {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                          DB Preview
                      </Button>
                       <Button variant="outline" size="sm" onClick={handlePlan} disabled={loading === 'plan' || plan.renames.length === 0}>
                          {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                          Generate SQL
                      </Button>
                       <Button variant="outline" size="sm" onClick={() => handleCodefix(false)} disabled={loading === 'codefix' || plan.renames.length === 0}>
                          {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                          CodeFix Preview
                      </Button>
                      <div className="flex-grow"></div>
                      <Button variant="destructive" size="sm" onClick={() => handleRefactor(true)} disabled={loading === 'apply' || plan.renames.length === 0}>
                            {loading === 'apply' ? <Loader2 className="animate-spin" /> : <Play />}
                            Aplicar Cambios
                      </Button>
                    </CardFooter>
                </Card>
                <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}
