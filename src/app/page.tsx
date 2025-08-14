
"use client";

import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import type { RefactorPlan, RefactorResponse, SchemaResponse, RenameOperation, Table, Column } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Power,
  FileText,
  Trash2,
  Database,
  Info,
  PlusCircle,
  XCircle,
  Eye,
  FileCode,
  Box,
  Pencil,
  Play,
  KeyRound,
  Link2,
  Search,
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { cn } from "@/lib/utils";
import { useDbSession, DbSessionContext } from "@/hooks/useDbSession";

const initialPlan: RefactorPlan = {
  renames: [],
};

function ConnectionCard() {
    const context = useContext(DbSessionContext);
    if (!context) throw new Error("ConnectionCard must be used within a DbSessionProvider");
    
    const { sessionId, connect, disconnect, loading, error } = context;
    const [cs, setCs] = useState("");
    const [textareaName, setTextareaName] = useState("connection-string-ssr");
    const { toast } = useToast();

    useEffect(() => {
        setTextareaName(`cs_${Math.random().toString(36).slice(2)}`);
    }, []);

    const onConnect = async () => {
        if (!cs.trim()) return;
        try {
            await connect(cs.trim(), 3600);
            setCs(""); 
            toast({ title: "Conexión exitosa", description: "La sesión está activa. Analizando esquema..." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error de conexión", description: err.message });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-medium text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Conexión a la Base de Datos
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="connection-string" className="text-xs text-muted-foreground">
                        Cadena de Conexión (se usa una vez para crear una sesión efímera)
                    </Label>
                    <Textarea
                        id="connection-string"
                        value={cs}
                        onChange={(e) => setCs(e.target.value)}
                        placeholder="Pega aquí tu cadena de conexión"
                        className="w-full h-24 p-2 rounded border font-mono text-sm"
                        autoComplete="off"
                        spellCheck={false}
                        name={textareaName}
                        data-lpignore="true" data-1p-ignore="true"
                    />
                    <Button onClick={onConnect} disabled={loading || !cs.trim()} className="w-full">
                        {loading ? <Loader2 className="animate-spin" /> : <Link2 />}
                        Conectar
                    </Button>
                </div>
                {error && (
                    <p className="mt-2 text-xs text-destructive">{error}</p>
                )}
            </CardContent>
        </Card>
    );
}

function SchemaEditor({ 
    schema, 
    loading,
    plan,
    onPlanChange,
    onRefresh,
}: { 
    schema: SchemaResponse | null; 
    loading: boolean;
    plan: RefactorPlan;
    onPlanChange: (newPlan: RefactorPlan) => void;
    onRefresh: () => void;
}) {
    const [newColumns, setNewColumns] = useState<Record<string, { name: string; type: string }>>({});
    const [searchTerm, setSearchTerm] = useState("");

    const handleTableNameChange = (originalName: string, newName: string) => {
        if (!newName.trim() || newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'table' && r.tableFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }

        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'table' && r.tableFrom === originalName);

        if (existingRenameIndex > -1) {
            const updatedRenames = [...plan.renames];
            updatedRenames[existingRenameIndex].tableTo = newName;
            onPlanChange({ ...plan, renames: updatedRenames });
        } else {
            const newRename: RenameOperation = { scope: 'table', tableFrom: originalName, tableTo: newName };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
        }
    };
    
    const handleColumnNameChange = (tableName: string, originalName: string, newName: string) => {
       if (!newName.trim() || newName === originalName) {
            const updatedRenames = plan.renames.filter(r => !(r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName));
            onPlanChange({ ...plan, renames: updatedRenames });
            return;
        }
        
        const existingRenameIndex = plan.renames.findIndex(r => r.scope === 'column' && r.tableFrom === tableName && r.columnFrom === originalName);

        if (existingRenameIndex > -1) {
             const updatedRenames = [...plan.renames];
             updatedRenames[existingRenameIndex].columnTo = newName;
             onPlanChange({ ...plan, renames: updatedRenames });
        } else {
            const newRename: RenameOperation = { scope: 'column', tableFrom: tableName, columnFrom: originalName, columnTo: newName };
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
                 if(Object.keys(rest).length <= 3) { // scope, tableFrom, columnFrom
                    updatedRenames = updatedRenames.filter((_, i) => i !== existingRenameIndex);
                 } else {
                    updatedRenames[existingRenameIndex] = rest;
                 }
            }
        } else if (isChangingType) {
            const newRename: RenameOperation = { scope: 'column', tableFrom: tableName, columnFrom: columnName, columnTo: columnName, type: newType };
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
    
    const { toast } = useToast();

    const confirmAddColumn = (id: string, tableName: string) => {
        const newColumn = newColumns[id];
        if (newColumn && newColumn.name && newColumn.type) {
            const newRename: RenameOperation = { scope: 'add-column', tableFrom: tableName, columnTo: newColumn.name, type: newColumn.type };
            onPlanChange({ ...plan, renames: [...plan.renames, newRename] });
            const tempNewCols = {...newColumns};
            delete tempNewCols[id];
            setNewColumns(tempNewCols);
        } else {
            toast({ variant: 'destructive', title: "Nombre y tipo de columna son requeridos."})
        }
    };

    const cancelAddColumn = (id: string) => {
        const tempNewCols = {...newColumns};
        delete tempNewCols[id];
        setNewColumns(tempNewCols);
    };
    
    const enhancedTables = useMemo(() => {
        if (!schema?.tables) return [];
        const tablesWithPk = schema.tables.map(table => {
            const pkIndex = table.indexes?.find(idx => idx.isPrimary);
            const pkColumns = pkIndex ? pkIndex.columns : [];
            const columnsWithPk = table.columns.map(col => ({ ...col, isPrimaryKey: pkColumns.includes(col.name) }));
            return { ...table, columns: columnsWithPk };
        });
        if (!searchTerm) return tablesWithPk;
        return tablesWithPk.filter(table => table.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [schema, searchTerm]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-medium">Editor de Esquema</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Actualizar
                </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar tablas..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {loading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {!loading && (
                    <div className="flex-1 overflow-y-auto pr-2">
                        <Accordion type="multiple" className="w-full">
                            {enhancedTables.map((table) => (
                                <AccordionItem value={table.name} key={table.name}>
                                    <AccordionTrigger>
                                      <div className="flex items-center gap-2 flex-1 group mr-4">
                                         <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                         <Input defaultValue={table.name} className="h-8 border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent" onBlur={(e) => handleTableNameChange(table.name, e.target.value)} onClick={(e) => e.stopPropagation()} />
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-6">
                                        <div className="space-y-1">
                                            {table.columns.map(col => (
                                                <div key={col.name} className="flex justify-between items-center text-xs group gap-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        {col.isPrimaryKey ? <KeyRound className="h-3 w-3 text-amber-400" /> : <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />}
                                                       <Input defaultValue={col.name} className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent" onBlur={(e) => handleColumnNameChange(table.name, col.name, e.target.value)} onClick={(e) => e.stopPropagation()} />
                                                    </div>
                                                    <Input defaultValue={col.sqlType} className="h-7 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary bg-transparent font-mono text-sky-400 w-28" onBlur={(e) => handleColumnTypeChange(table.name, col.name, e.target.value, col.sqlType)} onClick={(e) => e.stopPropagation()} />
                                                </div>
                                            ))}
                                             {Object.entries(newColumns).filter(([id]) => id.includes(`-${table.name}-`)).map(([id, col]) => (
                                                <div key={id} className="flex justify-between items-center text-xs group gap-2 p-2 bg-muted/50 rounded-md">
                                                    <div className="flex items-center gap-2 flex-1">
                                                       <Input placeholder="nombre_columna" className="h-7 text-xs" value={col.name} onChange={(e) => handleNewColumnChange(id, 'name', e.target.value)} onClick={(e) => e.stopPropagation()} />
                                                    </div>
                                                    <Input placeholder="tipo_sql" className="h-7 text-xs font-mono w-28" value={col.type} onChange={(e) => handleNewColumnChange(id, 'type', e.target.value)} onClick={(e) => e.stopPropagation()} />
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
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function RefactorPage() {
  const context = useContext(DbSessionContext);
  if (!context) throw new Error("RefactorPage must be used within a DbSessionProvider");
  
  const { sessionId, disconnect, loading: sessionLoading, expiresAt } = context;

  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true, allowDestructive: false });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  
  const [isCleanupAlertOpen, setCleanupAlertOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  
  const { toast, dismiss } = useToast();

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "Ocurrió un error desconocido.";
  }

  const handleApiCall = async <T,>(
    apiFn: () => Promise<T>,
    loadingState: "preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix",
    onSuccess: (data: T) => void,
    toastMessages: { loading: string; success: string; error: string }
  ) => {
    if (!sessionId) {
      toast({ variant: "destructive", title: "La sesión no está activa." });
      return;
    }
     if (plan.renames.length === 0 && !['analyze', 'cleanup'].includes(loadingState)) {
      toast({ variant: "destructive", title: "El plan de refactorización no puede estar vacío." });
      return;
    }

    setLoading(loadingState);
    setResult(null); // Clear previous results
    const { id } = toast({ title: toastMessages.loading, duration: 999999 });

    try {
      const data = await apiFn();
      dismiss(id);
      toast({ variant: "default", title: toastMessages.success, duration: 3000 });
      onSuccess(data);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      dismiss(id);
      toast({ variant: "destructive", title: toastMessages.error, description: errorMessage, duration: 5000 });
      setResult({ ok: false, error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = React.useCallback(() => {
      if (!sessionId) return;
      handleApiCall(
        () => analyzeSchema(sessionId),
        "analyze",
        (data) => setSchema(data),
        { loading: "Analizando esquema...", success: "Análisis de esquema completado.", error: "Falló el análisis de esquema." }
    );
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && !schema) {
      handleAnalyze();
    }
  }, [sessionId, schema, handleAnalyze]);

  const handlePlan = () => handleApiCall(
    () => generatePlan({ renames: plan.renames, ...options }),
    "plan",
    (data) => setResult(prev => ({ ...prev, sql: data.sql, ok: true, apply: false, codefix: prev?.codefix || null, dbLog: prev?.dbLog, log: prev?.log })),
    { loading: "Generando plan...", success: "Plan generado.", error: "Fallo al generar el plan." }
  );

  const handleRefactor = (apply: boolean) => {
    handleApiCall(
    () => runRefactor({ sessionId, plan, apply, rootKey, ...options }),
    apply ? "apply" : "preview",
    (data) => setResult(prev => ({ ...prev, ...data })),
    { 
      loading: apply ? "Aplicando cambios..." : "Generando vista previa...",
      success: apply ? "Cambios aplicados." : "Vista previa generada.",
      error: apply ? "Error al aplicar cambios." : "Error al generar la vista previa."
    }
  );
  }

  const triggerCleanup = () => {
    const hasDestructiveOps = plan.renames.some(op => op.scope.startsWith('drop'));
    if (hasDestructiveOps || options.allowDestructive) {
      setCleanupAlertOpen(true);
    } else {
      handleCleanup();
    }
  };
  
  const handleCleanup = () => {
    handleApiCall(
        () => runCleanup({ sessionId, renames: plan.renames, ...options }),
        "cleanup",
        (data) => {
            setResult(data);
            setCleanupAlertOpen(false);
            setCleanupConfirmation("");
        },
        { loading: "Ejecutando limpieza...", success: "Limpieza completada.", error: "Falló la limpieza." }
    );
  }
  
  const handleCodefix = (apply: boolean) => handleApiCall(
    () => runCodeFix({ rootKey, plan, apply }),
    "codefix",
    (data) => setResult(prev => ({ ...prev, codefix: data, ok: data.ok, apply: apply, sql: prev?.sql || null })),
    { 
      loading: apply ? "Aplicando correcciones de código..." : "Previsualizando correcciones de código...",
      success: apply ? "Correcciones de código aplicadas." : "Previsualización de correcciones generada.",
      error: "Fallo al ejecutar CodeFix."
    }
  );

  const removeRename = (index: number) => {
    setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
  };
  
  const MainContent = () => {
    if (!sessionId) {
        return (
            <div className="w-full max-w-md mx-auto mt-20">
                <ConnectionCard />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
            <div className="lg:col-span-3 h-full">
                <SchemaEditor 
                    schema={schema} 
                    loading={loading === 'analyze' || sessionLoading && !schema} 
                    plan={plan} 
                    onPlanChange={setPlan}
                    onRefresh={handleAnalyze}
                />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-6">
                 <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Plan de Refactorización</CardTitle>
                      <CardContent className="space-y-2 pt-4">
                          {plan.renames.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Edita el esquema para añadir cambios al plan.</p>
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
                                                `${op.tableFrom}.${op.columnFrom} -> ${op.columnTo || ''}${op.type ? ` (${op.type})` : ''}`
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
                    </CardHeader>
                </Card>

                <ResultsPanel result={result} loading={!!loading && loading !== 'analyze'} error={result?.error || null} />

            </div>
        </div>
    );
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
                          Refactorizar
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="p-2 border-t border-border">
                {sessionId ? (
                     <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm p-2">
                          <div className="flex items-center gap-2 text-green-400">
                             <CheckCircle className="h-4 w-4" />
                             <span>Conectado</span>
                          </div>
                        </div>
                        {expiresAt && (
                            <p className="text-xs text-muted-foreground px-2">
                                Expira a las {new Date(expiresAt).toLocaleTimeString()}
                            </p>
                        )}
                        <Button variant="outline" className="w-full" onClick={disconnect} disabled={sessionLoading}>
                             {sessionLoading ? <Loader2 className="animate-spin" /> : <Power />}
                             Desconectar
                        </Button>
                     </div>
                ) : (
                    <div className="text-sm text-muted-foreground p-2">
                        No conectado
                    </div>
                )}
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 h-full">
            <header className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Herramienta de Refactorización de BD</h1>
                {sessionId && (
                    <div className="flex items-center gap-4">
                      <Button variant="outline" onClick={() => handleRefactor(false)} disabled={loading === 'preview' || plan.renames.length === 0}>
                          {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                          Vista Previa BD
                      </Button>
                       <Button variant="outline" onClick={handlePlan} disabled={loading === 'plan' || plan.renames.length === 0}>
                          {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                          Generar SQL
                      </Button>
                       <Button variant="outline" onClick={() => handleCodefix(false)} disabled={loading === 'codefix' || plan.renames.length === 0}>
                          {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                          Vista Previa Código
                      </Button>
                      <Button variant="destructive" onClick={() => handleRefactor(true)} disabled={loading === 'apply' || plan.renames.length === 0}>
                            {loading === 'apply' ? <Loader2 className="animate-spin" /> : <Play />}
                            Aplicar Cambios
                      </Button>
                      <Button variant="secondary" onClick={triggerCleanup} disabled={loading === 'cleanup'}>
                           {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                           Limpieza
                        </Button>
                    </div>
                )}
            </header>
            <div className="h-[calc(100%-4rem)]">
                <MainContent />
            </div>
        </main>
      </SidebarInset>
      
      <AlertDialog open={isCleanupAlertOpen} onOpenChange={setCleanupAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar objetos de la base de datos?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta acción es irreversible y podría incluir operaciones como DROP TABLE o DROP COLUMN si están en el plan.
                      Por favor, escribe "ELIMINAR" para confirmar.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={cleanupConfirmation}
                onChange={e => setCleanupConfirmation(e.target.value)}
                placeholder='ELIMINAR'
                className="my-4"
              />
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setCleanupConfirmation("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                      onClick={handleCleanup}
                      disabled={cleanupConfirmation !== 'ELIMINAR' || loading === 'cleanup'}
                      className={buttonVariants({ variant: "destructive" })}
                  >
                     {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : "Sí, eliminar"}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
