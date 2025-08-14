

"use client";

import React, { useState, useEffect, useRef } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, SchemaResponse, RenameOperation, PlanRequest } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

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
  Link2,
  FolderGit2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDbSession } from "@/hooks/useDbSession";

const initialPlan: RefactorPlan = {
  renames: [],
};

const initialNewRename: Partial<RenameOperation> = {
  scope: "table",
  tableFrom: "",
  tableTo: "",
};


function ConnectionCard() {
    const { sessionId, connect, disconnect, expiresAt, loading, error } = useDbSession();
    const [cs, setCs] = useState("");
    const { toast } = useToast();

    const onConnect = async () => {
        if (!cs.trim()) return;
        try {
            await connect(cs.trim(), 3600); // 1 hour
            setCs(""); // Clear immediately
            toast({ title: "Conexión exitosa", description: "La sesión está activa." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error de conexión", description: err.message });
        }
    };

    const onDisconnect = async () => {
        await disconnect();
        toast({ title: "Desconectado", description: "La sesión ha terminado." });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-medium text-base">Conexión</CardTitle>
            </CardHeader>
            <CardContent>
                {!sessionId ? (
                    <div className="space-y-2">
                        <Label htmlFor="connection-string" className="text-xs text-muted-foreground">
                            Cadena de Conexión (efímera, no se guarda)
                        </Label>
                        <Textarea
                            id="connection-string"
                            value={cs}
                            onChange={(e) => setCs(e.target.value)}
                            placeholder="Pega aquí tu cadena de conexión"
                            className="w-full h-24 p-2 rounded border font-mono text-sm"
                            autoComplete="off"
                            spellCheck={false}
                            name={`cs_${Math.random().toString(36).slice(2)}`}
                            data-lpignore="true" data-1p-ignore="true"
                        />
                        <Button onClick={onConnect} disabled={loading || !cs.trim()} className="w-full">
                            {loading ? <Loader2 className="animate-spin" /> : <Link2 />}
                            Conectar
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-green-400">
                             <CheckCircle className="h-4 w-4" />
                             <span>Conectado</span>
                          </div>
                          <Button onClick={onDisconnect} variant="ghost" size="sm">Desconectar</Button>
                      </div>
                       {expiresAt && (
                            <p className="text-xs text-muted-foreground">
                                La sesión expira a las {new Date(expiresAt).toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                )}
                {error && !sessionId && (
                    <p className="mt-2 text-xs text-destructive">{error}</p>
                )}
            </CardContent>
        </Card>
    );
}


export default function RefactorPage() {
  const { sessionId, loading: sessionLoading } = useDbSession();
  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [newRename, setNewRename] = useState<Partial<RenameOperation>>(initialNewRename);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true, allowDestructive: false });
  const [rootKey, setRootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  
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
    return "Ocurrió un error desconocido.";
  }

  const handleApiCall = async <T,>(
    apiFn: () => Promise<T>,
    loadingState: "preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix",
    onSuccess: (data: T) => void,
    toastMessages: { loading: string; success: string; error: string }
  ) => {
    if (!sessionId && !['codefix', 'plan'].includes(loadingState)) {
      toast({ variant: "destructive", title: "La sesión no está activa." });
      return;
    }
     if (plan.renames.length === 0 && !['analyze', 'codefix', 'plan', 'preview', 'apply', 'cleanup'].includes(loadingState)) {
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
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
      if (!sessionId) {
          toast({ variant: "destructive", title: "Conéctate primero para analizar el esquema."});
          return;
      }
      handleApiCall(
        () => analyzeSchema(sessionId),
        "analyze",
        (data) => setSchema(data),
        { loading: "Analizando esquema...", success: "Análisis de esquema completado.", error: "Falló el análisis de esquema." }
    );
  }

  const handlePlan = () => handleApiCall(
    () => generatePlan({ renames: plan.renames, ...options }),
    "plan",
    (data) => setResult(prev => ({ ...prev, sql: data.sql, ok: true, apply: false, codefix: prev?.codefix || null, dbLog: prev?.dbLog, log: prev?.log })),
    { loading: "Generando plan...", success: "Plan generado.", error: "Fallo al generar el plan." }
  );

  const handleRefactor = (apply: boolean) => {
     if (!sessionId) {
          toast({ variant: "destructive", title: "Conéctate primero para ejecutar la refactorización."});
          return;
      }
    handleApiCall(
    () => runRefactor({ sessionId, plan, rootKey, ...options }, apply),
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
    if (!sessionId) {
        toast({ variant: "destructive", title: "Conéctate primero para ejecutar la limpieza."});
        return;
    }
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
                toast({ variant: "destructive", title: "Los campos 'Tabla Desde' y 'Tabla Hasta' son obligatorios." });
                return;
              }
              newOp = { ...newRename, scope: 'table' } as RenameOperation;
              break;
        case 'column':
             if (!newRename.tableFrom || !newRename.columnFrom || !newRename.columnTo) {
                toast({ variant: "destructive", title: "Los campos 'Tabla Desde', 'Columna Desde' y 'Columna Hasta' son obligatorios." });
                return;
              }
              newOp = { ...newRename, scope: 'column' } as RenameOperation;
              break;
        case 'add-column':
             if (!newColTable.trim() || !newColName.trim()) {
                toast({ variant: "destructive", title: "Los campos 'Tabla' y 'Nombre de Columna' son obligatorios." });
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
                toast({ variant: "destructive", title: "El campo 'Tabla Desde' es obligatorio." });
                return;
            }
            newOp = { scope: 'drop-table', tableFrom: newRename.tableFrom };
            break;
        case 'drop-column':
             if (!newRename.tableFrom || !newRename.columnFrom) {
                toast({ variant: "destructive", title: "Los campos 'Tabla Desde' y 'Columna Desde' son obligatorios." });
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
                    <Link href="/" className="w-full">
                      <SidebarMenuButton isActive>
                          <Wand2 />
                          Refactorizar
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                          <History />
                          Historial
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                    <Link href="/schema" className="w-full">
                      <SidebarMenuButton>
                          <Box />
                          Esquema
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="p-2 border-t border-border">
                 <Button variant={"outline"} className="w-full mt-2 justify-start gap-2" onClick={handleAnalyze} disabled={!sessionId || loading === 'analyze'}>
                      {loading === 'analyze' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      <span>Analizar Esquema</span>
                 </Button>
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start h-full">
              
              <div className="lg:col-span-2 flex flex-col gap-6">
                <ConnectionCard />
                <Card>
                    <CardHeader>
                      <CardTitle className="font-medium text-base">Repositorio</CardTitle>
                    </CardHeader>
                     <CardContent>
                        <div>
                            <Label htmlFor="root-key" className="text-xs text-muted-foreground">Clave Raíz</Label>
                             <Input
                                id="root-key"
                                placeholder="SOLUTION"
                                value={rootKey}
                                onChange={(e) => setRootKey(e.target.value)}
                                className="font-mono text-sm mt-1 bg-background"
                             />
                             <p className="text-xs text-muted-foreground mt-2">La clave para la ruta raíz del proyecto donde aplicar los cambios de código (ej. SOLUTION, FRONTEND).</p>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Opciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <TooltipProvider>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="use-synonyms" className="text-sm font-light flex items-center gap-2">
                                Usar Sinónimos
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
                                Usar Vistas
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
                                CQRS
                                 <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Habilita la compatibilidad con Command Query Responsibility Segregation (CQRS) mediante la creación de vistas para lectura.</p>
                                  </TooltipContent>
                                </Tooltip>
                             </Label>
                             <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(checked) => setOptions(prev => ({...prev, cqrs: checked}))} />
                        </div>
                         <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
                             <Label htmlFor="allowDestructive" className="text-sm font-light flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                Permitir Operaciones Destructivas
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
                        <p className="text-xs text-muted-foreground pt-2">Las vistas de solo lectura y los sinónimos permiten que el código cliente heredado funcione sin cambios inmediatos.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Limpieza</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       <p className="text-xs text-muted-foreground pb-2">Una vez aplicados los cambios y actualizado el código, puedes eliminar los elementos de compatibilidad (vistas/sinónimos).</p>
                       <Button ref={cleanupButtonRef} variant="secondary" className="w-full" onClick={triggerCleanup} disabled={loading === 'cleanup' || !sessionId}>
                           {loading === 'cleanup' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                           Ejecutar Limpieza
                        </Button>
                    </CardContent>
                </Card>

              </div>

              <div className="lg:col-span-3 flex flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Plan de Refactorización</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <Accordion type="single" collapsible>
                            <AccordionItem value="manual-add">
                                <AccordionTrigger className="text-sm">Añadir operación manual</AccordionTrigger>
                                <AccordionContent className="space-y-3 pt-4">
                                     <div className="flex space-x-1 rounded-md bg-muted p-1 flex-wrap">
                                        <button onClick={() => setActivePlanTab("table")} className={cn(buttonVariants({ variant: activePlanTab === 'table' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Renombrar Tabla</button>
                                        <button onClick={() => setActivePlanTab("column")} className={cn(buttonVariants({ variant: activePlanTab === 'column' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Renombrar Columna</button>
                                        <button onClick={() => setActivePlanTab("add-column")} className={cn(buttonVariants({ variant: activePlanTab === 'add-column' ? 'primary': 'ghost', size: 'sm' }), 'flex-1')}>Añadir Columna</button>
                                        <button onClick={() => setActivePlanTab("drop-table")} className={cn(buttonVariants({ variant: activePlanTab === 'drop-table' ? 'destructive': 'ghost', size: 'sm' }), 'flex-1')}>Eliminar Tabla</button>
                                        <button onClick={() => setActivePlanTab("drop-column")} className={cn(buttonVariants({ variant: activePlanTab === 'drop-column' ? 'destructive': 'ghost', size: 'sm' }), 'flex-1')}>Eliminar Columna</button>
                                     </div>
                                     <div className="pt-2">
                                        {activePlanTab === 'table' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-xs">Tabla Origen</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'table' }))} className="h-9 text-sm" />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Tabla Destino</Label>
                                                    <Input value={newRename.tableTo || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableTo: e.target.value, scope: 'table' }))} className="h-9 text-sm" />
                                                </div>
                                            </div>
                                        )}
                                        {activePlanTab === 'column' && (
                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs">Tabla Origen</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Columna Origen</Label>
                                                        <Input value={newRename.columnFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnFrom: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Columna Destino</Label>
                                                        <Input value={newRename.columnTo || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnTo: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Tipo (Opcional)</Label>
                                                    <Input value={newRename.type || ''} onChange={(e) => setNewRename(prev => ({ ...prev, type: e.target.value, scope: 'column' }))} className="h-9 text-sm" />
                                                </div>
                                            </div>
                                        )}
                                        {activePlanTab === 'add-column' && (
                                            <div className="space-y-3">
                                                 <div>
                                                    <Label className="text-xs">Tabla</Label>
                                                    <Input value={newColTable} onChange={(e) => setNewColTable(e.target.value)} className="h-9 text-sm" />
                                                 </div>
                                                 <div>
                                                    <Label className="text-xs">Nombre de Columna</Label>
                                                    <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} className="h-9 text-sm" />
                                                 </div>
                                                  <div>
                                                    <Label className="text-xs">Tipo de Dato</Label>
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
                                                        <Label className="text-xs">Longitud</Label>
                                                        <Input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="h-9 text-sm" />
                                                    </div>
                                                  )}
                                                  {baseType === 'decimal' && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <Label className="text-xs">Precisión</Label>
                                                            <Input type="number" value={precision} onChange={(e) => setPrecision(Number(e.target.value))} className="h-9 text-sm" />
                                                        </div>
                                                        <div>
                                                           <Label className="text-xs">Escala</Label>
                                                            <Input type="number" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-9 text-sm" />
                                                        </div>
                                                    </div>
                                                  )}
                                            </div>
                                        )}
                                        {activePlanTab === 'drop-table' && (
                                            <div>
                                                <Label className="text-xs text-destructive">Tabla a Eliminar</Label>
                                                <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'drop-table' }))} className="h-9 text-sm border-destructive" />
                                            </div>
                                        )}
                                        {activePlanTab === 'drop-column' && (
                                             <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs text-destructive">Tabla Origen</Label>
                                                    <Input value={newRename.tableFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, tableFrom: e.target.value, scope: 'drop-column' }))} className="h-9 text-sm border-destructive" />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-destructive">Columna a Eliminar</Label>
                                                    <Input value={newRename.columnFrom || ''} onChange={(e) => setNewRename(prev => ({ ...prev, columnFrom: e.target.value, scope: 'drop-column' }))} className="h-9 text-sm border-destructive" />
                                                </div>
                                            </div>
                                        )}
                                     </div>
                                    <Button size="sm" onClick={handleAddManualRename} className="w-full">Añadir al plan</Button>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <Separator />

                      {plan.renames.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aún no hay cambios en el plan.</p>
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
                      <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={loading === 'preview' || plan.renames.length === 0 || !sessionId}>
                          {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                          Vista Previa BD
                      </Button>
                       <Button variant="outline" size="sm" onClick={handlePlan} disabled={loading === 'plan' || plan.renames.length === 0}>
                          {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                          Generar SQL
                      </Button>
                       <Button variant="outline" size="sm" onClick={() => handleCodefix(false)} disabled={loading === 'codefix' || plan.renames.length === 0}>
                          {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                          Vista Previa Código
                      </Button>
                      <div className="flex-grow"></div>
                      <Button variant="destructive" size="sm" onClick={() => handleRefactor(true)} disabled={loading === 'apply' || plan.renames.length === 0 || !sessionId}>
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
      
      <AlertDialog open={isCleanupAlertOpen} onOpenChange={setCleanupAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar objetos de la base de datos?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Se van a ejecutar comandos DROP TABLE / DROP COLUMN. Esta acción es irreversible.
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

    