
"use client";

import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import type { RefactorPlan, RefactorResponse, SchemaResponse, RenameOperation, Table, Column } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Wand2,
  Loader2,
  CheckCircle,
  Database,
  Eye,
  FileCode,
  Play,
  Settings,
  Pencil,
  Trash2,
  FolderGit2,
  Link2,
  Info,
  RefreshCw,
  KeyRound,
  Search,
  PlusCircle,
  XCircle
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { cn } from "@/lib/utils";
import { useDbSession, DbSessionContext } from "@/hooks/useDbSession";
import { Textarea } from "@/components/ui/textarea";

const initialPlan: RefactorPlan = {
  renames: [],
};

type ActionModalType = "preview" | "plan" | "codefix" | null;

function ConnectionManager() {
    const context = useContext(DbSessionContext);
    if (!context) throw new Error("ConnectionManager must be used within a DbSessionProvider");
    
    const { sessionId, expiresAt, connect, disconnect, loading, error } = context;
    const { toast } = useToast();
    const [cs, setCs] = useState("");

    const onConnect = async () => {
        if (!cs.trim()) return;
        try {
          await connect(cs.trim(), 3600);
          toast({ title: "Conexión exitosa", description: "La sesión está activa. Ya puedes explorar el esquema." });
          setCs(""); 
        } catch (err: any) {
          toast({ variant: "destructive", title: "Error de conexión", description: err.message });
        }
    };

    if (sessionId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Conexión</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-400">
                           <CheckCircle className="h-4 w-4"/>
                           <span className="text-sm font-medium">Conectado</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={disconnect} disabled={loading}>
                           {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Desconectar"}
                        </Button>
                    </div>
                    {expiresAt && <p className="text-xs text-muted-foreground mt-2">La sesión expira a las {new Date(expiresAt).toLocaleTimeString()}</p>}
                </CardContent>
            </Card>
        );
    }
    
    return (
       <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Conectar a Base de Datos</CardTitle>
                 <CardDescription>Pega tu cadena de conexión para empezar.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Textarea
                        id="connection-string"
                        value={cs}
                        onChange={(e) => setCs(e.target.value)}
                        placeholder="Server=...;Database=...;User Id=...;Password=..."
                        className="w-full h-28 p-2 rounded-md border font-mono text-xs bg-input"
                        autoComplete="off"
                        spellCheck={false}
                        data-lpignore="true"
                    />
                    <Button onClick={onConnect} disabled={loading || !cs.trim()} className="w-full">
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Link2 className="mr-2 h-4 w-4" />}
                        Conectar de forma segura
                    </Button>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function RepositoryManager({ rootKey, setRootKey }: { rootKey: string, setRootKey: (key: string) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Repositorio</CardTitle>
                 <CardDescription className="text-xs">Define el `rootKey` para las operaciones de `CodeFix`.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    <Label htmlFor="root-key">Clave Raíz</Label>
                    <Input id="root-key" value={rootKey} onChange={(e) => setRootKey(e.target.value)} />
                </div>
            </CardContent>
        </Card>
    );
}

function OptionsManager({ options, setOptions }: { options: { useSynonyms: boolean, useViews: boolean, cqrs: boolean }, setOptions: React.Dispatch<React.SetStateAction<any>> }) {
     return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Opciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="use-synonyms" className="text-sm">Usar Sinónimos</Label>
                         <TooltipProvider>
                         <Tooltip>
                            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground"/></TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs">Crea sinónimos para los objetos renombrados, manteniendo la compatibilidad con el código antiguo.</p>
                            </TooltipContent>
                        </Tooltip>
                         </TooltipProvider>
                    </div>
                    <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(c) => setOptions((p: any) => ({...p, useSynonyms: c}))} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Label htmlFor="use-views" className="text-sm">Usar Vistas</Label>
                        <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground"/></TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs">Genera vistas para los nombres de tablas y columnas antiguos como una capa de compatibilidad adicional.</p>
                            </TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Switch id="use-views" checked={options.useViews} onCheckedChange={(c) => setOptions((p: any) => ({...p, useViews: c}))} />
                </div>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="cqrs" className="text-sm">CORS</Label>
                         <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground"/></TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs">Permite o deniega las solicitudes de diferentes orígenes al backend (Cross-Origin Resource Sharing).</p>
                            </TooltipContent>
                        </Tooltip>
                         </TooltipProvider>
                    </div>
                    <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(c) => setOptions((p: any) => ({...p, cqrs: c}))} />
                </div>
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
                 if(Object.keys(rest).length <= 3) { 
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
            <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar tablas..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {loading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {!loading && schema?.tables.length === 0 && (
                     <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                        <p>No se encontraron tablas. Conéctate a una BD y actualiza.</p>
                    </div>
                )}
                {!loading && schema && schema.tables.length > 0 && (
                    <div className="flex-1 overflow-y-auto pr-2 max-h-[calc(100vh-28rem)]">
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

function PlanReview({ plan, onRemove }: { plan: RefactorPlan, onRemove: (index: number) => void}) {
    return (
         <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Plan de Refactorización</CardTitle>
            </CardHeader>
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
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(index)}>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    )
                    })}
                </div>
                )}
            </CardContent>
        </Card>
    )
}

export default function RefactorPage() {
  const context = useContext(DbSessionContext);
  if (!context) throw new Error("RefactorPage must be used within a DbSessionProvider");
  
  const { sessionId } = context;

  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true, allowDestructive: false });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "plan" | "codefix" | "schema" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  
  const [isApplyAlertOpen, setApplyAlertOpen] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModalType>(null);
  
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  
  const { toast, dismiss } = useToast();

  const handleAnalyze = useCallback(async () => {
    if (!sessionId) {
      toast({ variant: "destructive", title: "No estás conectado", description: "Por favor, conéctate a una base de datos para analizar el esquema." });
      return;
    }
    setLoading("schema");
    try {
      const data = await analyzeSchema(sessionId);
      setSchema(data);
      if (data.tables.length > 0) {
        toast({ title: "Esquema analizado con éxito." });
      } else {
        toast({ variant: "default", title: "Análisis completado", description: "No se encontraron tablas." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al analizar", description: err.message });
      setSchema({ tables: [] });
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    if (sessionId) {
        handleAnalyze();
    } else {
        setSchema(null);
    }
  }, [sessionId, handleAnalyze]);

  const removeRename = (index: number) => {
    setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
  };

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "Ocurrió un error desconocido.";
  }
  
  const handleApiCall = async <T,>(
    apiFn: () => Promise<T>,
    loadingState: "preview" | "apply" | "cleanup" | "plan" | "codefix",
    onSuccess: (data: T) => void,
    toastMessages: { loading: string; success: string; error: string }
  ) => {
    if (!sessionId && !['plan', 'codefix'].includes(loadingState)) {
      toast({ variant: "destructive", title: "La sesión no está activa.", description: "Por favor, conéctate a una base de datos primero." });
      return;
    }
     if (plan.renames.length === 0 && !['cleanup'].includes(loadingState)) {
      toast({ variant: "destructive", title: "El plan de refactorización no puede estar vacío." });
      return;
    }

    setLoading(loadingState);
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

  const handlePlan = () => handleApiCall(
    () => generatePlan({ renames: plan.renames, ...options }),
    "plan",
    (data) => setResult(prev => ({ ...prev, sql: data.sql, ok: true, apply: false, codefix: prev?.codefix || null, dbLog: prev?.dbLog, log: prev?.log })),
    { loading: "Generando plan...", success: "Plan generado.", error: "Fallo al generar el plan." }
  );
  
  const handleRefactorPreview = () => {
    handleApiCall(
    () => runRefactor({ sessionId: sessionId!, plan, apply: false, rootKey, ...options }),
    "preview",
    (data) => setResult(data),
    { 
      loading: "Generando vista previa...",
      success: "Vista previa generada.",
      error: "Error al generar la vista previa."
    }
  );
  }
  
  const confirmApply = () => {
     handleApiCall(
        () => runRefactor({ sessionId: sessionId!, plan, apply: true, rootKey, ...options }),
        "apply",
        (data) => setResult(data),
        { 
          loading: "Aplicando cambios...",
          success: "Cambios aplicados.",
          error: "Error al aplicar cambios."
        }
    );
    setApplyAlertOpen(false);
  }
  
  const handleCodefix = () => handleApiCall(
    () => runCodeFix({ rootKey, plan, apply: false }),
    "codefix",
    (data) => setResult(prev => ({ ...prev, codefix: data, ok: data.ok, apply: false, sql: prev?.sql || null })),
    { 
      loading: "Previsualizando correcciones de código...",
      success: "Previsualización de correcciones generada.",
      error: "Fallo al ejecutar CodeFix."
    }
  );

  const actionModalContent = {
    preview: {
        title: "Generar Vista Previa de Base de Datos",
        description: "Esta acción simulará los cambios del plan contra la base de datos conectada y generará los scripts SQL de 'rename' y 'compat', pero no los aplicará. Es un paso seguro para revisar los cambios.",
        action: handleRefactorPreview
    },
    plan: {
        title: "Generar Scripts SQL",
        description: "Esta acción generará los scripts SQL basados en el plan de refactorización y las opciones seleccionadas. Los scripts no se ejecutarán.",
        action: handlePlan
    },
    codefix: {
        title: "Generar Vista Previa de Código",
        description: "Esta acción analizará tu repositorio local y mostrará una vista previa de los cambios de código necesarios para alinearse con el plan de refactorización. No se aplicará ningún cambio.",
        action: handleCodefix
    }
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
                    <Link href="/">
                        <SidebarMenuButton isActive>
                            <Wand2 />
                            Refactorizar
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                    <Link href="/schema">
                        <SidebarMenuButton>
                           <Database />
                           Resultados
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
             <header className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Refactorizar Esquema</h1>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActionModal("preview")} disabled={!!loading || plan.renames.length === 0}>
                        {loading === 'preview' ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye className="h-4 w-4"/>}
                        <span className="ml-2 hidden sm:inline">Vista Previa BD</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActionModal("codefix")} disabled={!!loading || plan.renames.length === 0}>
                        {loading === 'codefix' ? <Loader2 className="animate-spin h-4 w-4" /> : <FolderGit2 className="h-4 w-4"/>}
                        <span className="ml-2 hidden sm:inline">Vista Previa Código</span>
                    </Button>
                    <Button onClick={() => setApplyAlertOpen(true)} disabled={!!loading || plan.renames.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {loading === 'apply' ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4"/>}
                        <span className="ml-2">Aplicar</span>
                    </Button>
                 </div>
            </header>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Columna Izquierda */}
                <div className="lg:col-span-2 h-full flex flex-col">
                    <SchemaEditor
                        schema={schema}
                        loading={loading === "schema"}
                        plan={plan}
                        onPlanChange={setPlan}
                        onRefresh={handleAnalyze}
                    />
                </div>

                {/* Columna Derecha */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <ConnectionManager/>
                    <RepositoryManager rootKey={rootKey} setRootKey={setRootKey}/>
                    <OptionsManager options={options} setOptions={setOptions}/>
                    <PlanReview plan={plan} onRemove={removeRename} />
                </div>
             </div>
        </main>
      </SidebarInset>
      
      <AlertDialog open={isApplyAlertOpen} onOpenChange={setApplyAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Aplicar los cambios?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta acción ejecutará los scripts SQL y los cambios de código en tu base de datos y repositorio. Esta acción puede ser irreversible.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                      onClick={confirmApply}
                      disabled={loading === 'apply'}
                      className={buttonVariants({ variant: "default" })}
                  >
                     {loading === 'apply' ? <Loader2 className="animate-spin" /> : "Sí, aplicar cambios"}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>{actionModal && actionModalContent[actionModal].title}</AlertDialogTitle>
                  <AlertDialogDescription>
                      {actionModal && actionModalContent[actionModal].description}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setActionModal(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                      onClick={() => {
                          if (actionModal) {
                            actionModalContent[actionModal].action();
                          }
                          setActionModal(null);
                      }}
                      className={buttonVariants({ variant: "default" })}
                  >
                    Sí, continuar
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    