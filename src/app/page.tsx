

"use client";

import React, { useState, useEffect, useRef } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, SchemaResponse, RenameOperation, PlanRequest } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  Play,
  KeyRound,
  Link2
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
        if (newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'table' && r.tableFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }

        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'table' && r.tableFrom === originalName);

        if (existingRenameIndex > -1) {
            const updatedRenames = [...plan.renames];
            updatedRenames[existingRenameIndex] = { ...updatedRenames[existingRenameIndex], tableTo: newName };
            onPlanChange({ ...plan, renames: updatedRenames });
        } else if (newName) {
            const newRename: RenameOperation = {
                scope: 'table',
                tableFrom: originalName,
                tableTo: newName,
            };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
        }
    };
    
    const handleColumnNameChange = (tableName: string, originalName: string, newName: string) => {
        if (newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }
        
        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName);

        if (existingRenameIndex > -1) {
             const updatedRenames = [...plan.renames];
             updatedRenames[existingRenameIndex] = { ...updatedRenames[existingRenameIndex], columnTo: newName };
             onPlanChange({ ...plan, renames: updatedRenames });
        } else if (newName) {
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
            const existing = updatedRenames[existingRenameIndex];
            if (isChangingType) {
                 updatedRenames[existingRenameIndex] = { ...existing, type: newType };
            } else {
                 const { type, ...rest } = existing;
                 updatedRenames[existingRenameIndex] = rest;
            }
        } else if (isChangingType) {
            const newRename: RenameOperation = {
                scope: 'column',
                tableFrom: tableName,
                columnFrom: columnName,
                columnTo: columnName,
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
    
    const enhancedTables = React.useMemo(() => {
        if (!schema?.tables) return [];
        return schema.tables.map(table => {
            const pkIndex = table.indexes?.find(idx => idx.isPrimary);
            const pkColumns = pkIndex ? pkIndex.columns : [];
            const columnsWithPk = table.columns.map(col => ({
                ...col,
                isPrimaryKey: pkColumns.includes(col.name)
            }));
            return { ...table, columns: columnsWithPk };
        });
    }, [schema]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <CardTitle className="text-base font-medium">Database Schema</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Refresh
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
                        <h3 className="text-lg font-medium">Connect your database</h3>
                        <p className="text-sm">Press "Check Connection" to load and visualize the schema.</p>
                    </div>
                )}
                {hasSchema && !loading && (
                    <Accordion type="multiple" className="w-full max-h-[calc(100vh-20rem)] overflow-y-auto pr-2">
                        {enhancedTables.map((table) => (
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
                                                    {col.isPrimaryKey ? (
                                                        <KeyRound className="h-3 w-3 text-amber-400" />
                                                    ) : (
                                                        <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    )}
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
                                                      placeholder="column_name"
                                                      className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent"
                                                      value={col.name}
                                                      onChange={(e) => handleNewColumnChange(id, 'name', e.target.value)}
                                                      onClick={(e) => e.stopPropagation()}
                                                   />
                                                </div>
                                                <Input 
                                                    placeholder="data_type"
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
                                            <PlusCircle className="mr-2 h-3 w-3" /> Add Column
                                        </Button>
                                    </div>
                                    {table.foreignKeys && table.foreignKeys.length > 0 && (
                                        <div className="mt-4 pt-2 border-t border-border/50">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Foreign Keys</p>
                                            <div className="space-y-1">
                                                {table.foreignKeys.map(fk => (
                                                    <div key={fk.name} className="flex items-center text-xs text-muted-foreground gap-2 font-mono">
                                                        <Link2 className="h-3 w-3 text-cyan-400"/>
                                                        <span>{fk.columnName}</span>
                                                        <span className="text-foreground">→</span>
                                                        <span>{fk.referencesTable}.{fk.referencesColumn}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

const initialNewRename: Partial<RenameOperation> = {
  scope: "table",
  tableFrom: "",
  tableTo: "",
};


export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("Server=NERVELESS;Database=StoreGuille;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True;");
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [newRename, setNewRename] = useState<Partial<RenameOperation>>(initialNewRename);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true, allowDestructive: false });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  
  const [isCleanupAlertOpen, setCleanupAlertOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const cleanupButtonRef = useRef<HTMLButtonElement>(null);


  const [activePlanTab, setActivePlanTab] = useState<'table' | 'column' | 'add-column' | 'drop-table' | 'drop-column'>('table');
  const [newColTable, setNewColTable] = useState("");
  const [newColName, setNewColName] = useState("");
  const [baseType, setBaseType] = useState<'int' | 'nvarchar' | 'decimal' | 'bit' | 'date' | 'datetime2'>('nvarchar');
  const [length, setLength] = useState<number>(50);
  const [precision, setPrecision] = useState<number>(10);
  const [scale, setScale] = useState<number>(2);

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
      loading: apply ? "Applying changes..." : "Generating preview...",
      success: apply ? "Changes applied." : "Preview generated.",
      error: apply ? "Error applying changes." : "Error generating preview."
    }
  );

  const triggerCleanup = () => {
    const hasDestructiveOps = plan.renames.some(op => op.scope.startsWith('drop'));
    if (hasDestructiveOps || options.allowDestructive) {
      setCleanupAlertOpen(true);
    } else {
      handleCleanup();
    }
  };
  
  const handleCleanup = () => handleApiCall(
    () => runCleanup({ connectionString, renames: plan.renames, ...options }),
    "cleanup",
    (data) => {
        setResult(data);
        setCleanupAlertOpen(false);
        setCleanupConfirmation("");
    },
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

  function buildSqlType(): string {
    if (baseType === "nvarchar") return `nvarchar(${length || 50})`;
    if (baseType === "decimal") return `decimal(${precision || 10}, ${scale || 2})`;
    return baseType;
  }
  
  const handleAddManualRename = () => {
    let newOp: RenameOperation | null = null;
  
    switch(activePlanTab) {
        case 'table':
             if (!newRename.tableFrom || !newRename.tableTo) {
                toast({ variant: "destructive", title: "Table From and Table To are required" });
                return;
              }
              newOp = { ...newRename, scope: 'table' } as RenameOperation;
              break;
        case 'column':
             if (!newRename.tableFrom || !newRename.columnFrom || !newRename.columnTo) {
                toast({ variant: "destructive", title: "Table From, Column From, and Column To are required" });
                return;
              }
              newOp = { ...newRename, scope: 'column' } as RenameOperation;
              break;
        case 'add-column':
             if (!newColTable.trim() || !newColName.trim()) {
                toast({ variant: "destructive", title: "Table and Column Name are required." });
                return;
              }
              newOp = {
                scope: 'add-column',
                tableFrom: newColTable.trim(),
                columnTo: newColName.trim(),
                type: buildSqlType(),
              };
              break;
        case 'drop-table':
            if (!newRename.tableFrom) {
                toast({ variant: "destructive", title: "Table From is required" });
                return;
            }
            newOp = { scope: 'drop-table', tableFrom: newRename.tableFrom };
            break;
        case 'drop-column':
             if (!newRename.tableFrom || !newRename.columnFrom) {
                toast({ variant: "destructive", title: "Table From and Column From are required" });
                return;
            }
            newOp = { scope: 'drop-column', tableFrom: newRename.tableFrom, columnFrom: newRename.columnFrom };
            break;
    }
  
    if (newOp) {
      setPlan(prev => ({ ...prev, renames: [...prev.renames, newOp as RenameOperation] }));
      setNewRename({ scope: activePlanTab });
      setNewColTable("");
      setNewColName("");
    }
  };
  
  const removeRename = (index: number) => {
    setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
  };
  
  useEffect(() => {
    if (result && result.error) {
        toast({
            title: `Operation failed`,
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
                          History
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <Box />
                          Schema
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                          <SlidersHorizontal />
                          Settings
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
                  <h1 className="text-xl font-medium">Refactor DB + Code</h1>
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
                      <CardTitle className="text-base font-medium">Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <TooltipProvider>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="use-synonyms" className="text-sm font-light flex items-center gap-2">
                                Use Synonyms
                                <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Crea sinónimos para los objetos renombrados, permitiendo que el código antiguo siga funcionando temporalmente.</p>
                                  </TooltipContent>
                                </Tooltip>
                            </Label>
                            <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="use-views" className="text-sm font-light flex items-center gap-2">
                                Use Views
                                 <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Crea vistas de solo lectura para las tablas antiguas, asegurando la compatibilidad con aplicaciones que solo leen datos.</p>
                                  </TooltipContent>
                                </Tooltip>
                            </Label>
                            <Switch id="use-views" checked={options.useViews} onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))} />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="cqrs" className="text-sm font-light flex items-center gap-2">
                                CORS
                                 <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Habilita la compatibilidad con CQRS (Command Query Responsibility Segregation) creando vistas para lectura.</p>
                                  </TooltipContent>
                                </Tooltip>
                             </Label>
                             <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(checked) => setOptions(prev => ({...prev, cqrs: checked}))} />
                        </div>
                         <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
                             <Label htmlFor="allowDestructive" className="text-sm font-light flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                Allow Destructive
                                 <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3 w-3 text-destructive cursor-help" /></TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Permite la ejecución de operaciones destructivas como DROP TABLE y DROP COLUMN. Usar con precaución.</p>
                                  </TooltipContent>
                                </Tooltip>
                            </Label>
                             <Switch id="allowDestructive" checked={options.allowDestructive} onCheckedChange={(checked) => setOptions(prev => ({...prev, allowDestructive: checked}))} />
                        </div>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground pt-2">Read-only views and synonyms allow legacy client code to work without immediate changes.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Cleanup</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       <p className="text-xs text-muted-foreground pb-2">Once changes are applied and code is updated, you can remove compatibility elements (views/synonyms).</p>
                       <Button ref={cleanupButtonRef} variant="secondary" className="w-full" onClick={triggerCleanup} disabled={loading === 'cleanup'}>
                           {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                           Run Cleanup
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
                      <CardTitle className="text-base font-medium">Refactor Plan</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <Accordion type="single" collapsible>
                            <AccordionItem value="manual-add">
                                <AccordionTrigger className="text-sm">Add manual operation</AccordionTrigger>
                                <AccordionContent className="space-y-3 pt-4">
                                     <div className="flex space-x-1 rounded-md bg-muted p-1 flex-wrap">
                                        <button onClick={() => setActivePlanTab("table")} className={cn(buttonVariants({ variant: activePlanTab === 'table' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Rename Table</button>
                                        <button onClick={() => setActivePlanTab("column")} className={cn(buttonVariants({ variant: activePlanTab === 'column' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Rename Column</button>
                                        <button onClick={() => setActivePlanTab("add-column")} className={cn(buttonVariants({ variant: activePlanTab === 'add-column' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Add Column</button>
                                        <button onClick={() => setActivePlanTab("drop-table")} className={cn(buttonVariants({ variant: activePlanTab === 'drop-table' ? 'destructive': 'ghost', size: 'sm' }), 'flex-1')}>Drop Table</button>
                                        <button onClick={() => setActivePlanTab("drop-column")} className={cn(buttonVariants({ variant: activePlanTab === 'drop-column' ? 'destructive': 'ghost', size: 'sm' }), 'flex-1')}>Drop Column</button>
                                     </div>
                                     <div className="pt-2">
                                        {activePlanTab === 'table' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-xs">Table From</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'table' }))} className="h-9 text-sm" />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Table To</Label>
                                                    <Input value={newRename.tableTo || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableTo: e.target.value, scope: 'table' }))} className="h-9 text-sm" />
                                                </div>
                                            </div>
                                        )}
                                        {activePlanTab === 'column' && (
                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs">Table From</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Column From</Label>
                                                        <Input value={newRename.columnFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnFrom: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Column To</Label>
                                                        <Input value={newRename.columnTo || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnTo: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Type (Optional)</Label>
                                                    <Input value={newRename.type || ''} onChange={(e) => setNewRename(prev => ({ ...prev, type: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                </div>
                                            </div>
                                        )}
                                        {activePlanTab === 'add-column' && (
                                            <div className="space-y-3">
                                                 <div>
                                                    <Label className="text-xs">Table</Label>
                                                    <Input value={newColTable} onChange={(e) => setNewColTable(e.target.value)} className="h-9 text-sm" />
                                                 </div>
                                                 <div>
                                                    <Label className="text-xs">Column Name</Label>
                                                    <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} className="h-9 text-sm" />
                                                 </div>
                                                  <div>
                                                    <Label className="text-xs">Data Type</Label>
                                                    <select
                                                        value={baseType}
                                                        onChange={(e) => setBaseType(e.target.value as any)}
                                                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                                    >
                                                        <option value="nvarchar">nvarchar</option>
                                                        <option value="varchar">varchar</option>
                                                        <option value="int">int</option>
                                                        <option value="decimal">decimal</option>
                                                        <option value="bit">bit</option>
                                                        <option value="date">date</option>
                                                        <option value="datetime2">datetime2</option>
                                                    </select>
                                                  </div>
                                                  {baseType === 'nvarchar' && (
                                                    <div>
                                                        <Label className="text-xs">Length</Label>
                                                        <Input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="h-9 text-sm" />
                                                    </div>
                                                  )}
                                                  {baseType === 'decimal' && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <Label className="text-xs">Precision</Label>
                                                            <Input type="number" value={precision} onChange={(e) => setPrecision(Number(e.target.value))} className="h-9 text-sm" />
                                                        </div>
                                                        <div>
                                                           <Label className="text-xs">Scale</Label>
                                                            <Input type="number" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-9 text-sm" />
                                                        </div>
                                                    </div>
                                                  )}
                                            </div>
                                        )}
                                        {activePlanTab === 'drop-table' && (
                                            <div>
                                                <Label className="text-xs text-destructive">Table to Drop</Label>
                                                <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'drop-table' }))} className="h-9 text-sm border-destructive" />
                                            </div>
                                        )}
                                        {activePlanTab === 'drop-column' && (
                                             <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs text-destructive">Table From</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'drop-column' }))} className="h-9 text-sm border-destructive" />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-destructive">Column to Drop</Label>
                                                    <Input value={newRename.columnFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnFrom: e.target.value, scope: 'drop-column' }))} className="h-9 text-sm border-destructive" />
                                                </div>
                                            </div>
                                        )}
                                     </div>
                                    <Button size="sm" onClick={handleAddManualRename} className="w-full">Add to plan</Button>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <Separator />

                      {plan.renames.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No changes in plan yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {plan.renames.map((op, index) => {
                            const isDestructive = op.scope.startsWith('drop');
                            return (
                                <div key={index} className={cn("flex items-center justify-between bg-muted/50 p-2 rounded-md", isDestructive && "bg-destructive/10")}>
                                    <div className="text-xs">
                                        <Badge variant={isDestructive ? "destructive" : "outline"} className="mr-2">{op.scope}</Badge>
                                        <span className="font-mono">{
                                            op.scope === 'table' ? `${op.tableFrom} -> ${op.tableTo}` : 
                                            op.scope === 'add-column' ? `ADD ${op.columnTo}(${op.type}) TO ${op.tableFrom}` :
                                            op.scope === 'drop-table' ? op.tableFrom :
                                            op.scope === 'drop-column' ? `${op.tableFrom}.${op.columnFrom}` :
                                            `${op.tableFrom}.${op.columnFrom} -> ${op.columnTo || op.columnFrom}${op.type ? ` (${op.type})` : ''}`
                                        }</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRename(index)}>
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            )
                          })}
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
                            Apply Changes
                      </Button>
                    </CardFooter>
                </Card>
                <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
              </div>
            </div>
        </main>
      </SidebarInset>
      
      <AlertDialog open={isCleanupAlertOpen} onOpenChange={setCleanupAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Delete database objects?</AlertDialogTitle>
                  <AlertDialogDescription>
                      DROP TABLE / DROP COLUMN commands are about to be executed. This action is irreversible.
                      Please type "ELIMINAR" to confirm.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={cleanupConfirmation}
                onChange={e => setCleanupConfirmation(e.target.value)}
                placeholder='ELIMINAR'
                className="my-4"
              />
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setCleanupConfirmation("")}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                      onClick={handleCleanup}
                      disabled={cleanupConfirmation !== 'ELIMINAR' || loading === 'cleanup'}
                      className={buttonVariants({ variant: "destructive" })}
                  >
                     {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : "Yes, delete"}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    