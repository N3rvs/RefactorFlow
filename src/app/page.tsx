
"use client";

import React, { useState, useEffect, useContext } from "react";
import type { RefactorPlan, RefactorResponse, SchemaResponse, RenameOperation, Table } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Link2
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { cn } from "@/lib/utils";
import { useDbSession, DbSessionContext } from "@/hooks/useDbSession";
import { Textarea } from "@/components/ui/textarea";

const initialPlan: RefactorPlan = {
  renames: [],
};

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

function RepositoryManager() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Repositorio</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <FolderGit2 className="h-5 w-5 text-muted-foreground"/>
                        <span className="font-medium">Repositorio Local</span>
                    </div>
                    <Badge variant="outline" className="text-green-400 border-green-400/50">Listo</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    La ruta del código fuente está preconfigurada en el servidor.
                </p>
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
                    <Label htmlFor="use-synonyms" className="text-sm">Usar Sinónimos</Label>
                    <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(c) => setOptions((p: any) => ({...p, useSynonyms: c}))} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="use-views" className="text-sm">Usar Vistas</Label>
                    <Switch id="use-views" checked={options.useViews} onCheckedChange={(c) => setOptions((p: any) => ({...p, useViews: c}))} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="cqrs" className="text-sm">CORS</Label>
                    <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(c) => setOptions((p: any) => ({...p, cqrs: c}))} />
                </div>
            </CardContent>
        </Card>
    );
}

function PlanManager({ plan, setPlan }: { plan: RefactorPlan, setPlan: React.Dispatch<React.SetStateAction<RefactorPlan>> }) {
    const [newOp, setNewOp] = useState({ scope: 'column', tableFrom: '', columnFrom: '', tableTo: '' });

    const handleAddOperation = () => {
        if (!newOp.tableFrom) return; 
        const op: RenameOperation = {
            scope: newOp.scope as any,
            tableFrom: newOp.tableFrom,
            ...(newOp.scope === 'column' ? 
                { columnFrom: newOp.columnFrom, columnTo: newOp.tableTo } : 
                { tableTo: newOp.tableTo, columnFrom: undefined }
            ),
        };
        setPlan(prev => ({ ...prev, renames: [...prev.renames, op] }));
        setNewOp({ scope: 'column', tableFrom: '', columnFrom: '', tableTo: '' });
    };

    const handleRemoveOperation = (index: number) => {
        setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
    };
    
    return (
        <Card className="flex-1">
            <CardHeader>
                <CardTitle>Plan de Refactorización</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <Label className="text-xs text-muted-foreground">Añadir operacion</Label>
                        <div className="grid grid-cols-5 gap-2 mt-1">
                            <Select value={newOp.scope} onValueChange={v => setNewOp({...newOp, scope: v})}>
                                <SelectTrigger className="bg-input border-0 h-9"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="table">table</SelectItem>
                                    <SelectItem value="column">column</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input placeholder="TableFrom" value={newOp.tableFrom} onChange={e => setNewOp({...newOp, tableFrom: e.target.value})} className="bg-input border-0 h-9"/>
                            <Input placeholder="ColumnFrom" value={newOp.columnFrom} onChange={e => setNewOp({...newOp, columnFrom: e.target.value})} disabled={newOp.scope !== 'column'} className="bg-input border-0 h-9" />
                            <Input placeholder={newOp.scope === 'table' ? 'TableTo' : 'ColumnTo'} value={newOp.tableTo} onChange={e => setNewOp({...newOp, tableTo: e.target.value})} className="bg-input border-0 h-9"/>
                            <Button onClick={handleAddOperation} variant="outline" size="sm">Añadir</Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {plan.renames.map((op, index) => (
                             <div key={index} className="grid grid-cols-5 items-center gap-4 text-sm font-mono p-1 rounded-md hover:bg-muted/50">
                                 <Badge variant="outline" className="w-20 justify-center">{op.scope}</Badge>
                                 <span className="truncate">{op.tableFrom}</span>
                                 <span className="truncate">{op.columnFrom ?? '-'}</span>
                                 <span className="truncate">{op.scope === 'table' ? op.tableTo : op.columnTo}</span>
                                 <div className="flex items-center justify-end">
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveOperation(index)}><Trash2 className="h-4 w-4"/></Button>
                                 </div>
                             </div>
                        ))}
                         {plan.renames.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">No hay operaciones en el plan.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SchemaSummary({ onAnalyze, loading }: { onAnalyze: () => void, loading: boolean }) {
    // Dummy data for display based on the image
    const summaryData = [
        { name: 'orders', cols: 5, fx: 1, idx: 1 },
        { name: 'products', cols: 3, fx: 2, idx: 2 },
        { name: 'users', cols: 4, fx: 2, idx: 2 },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-base font-medium">Esquema</CardTitle>
                    <CardDescription className="text-xs">Resumen de la base de datos.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={onAnalyze} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Database className="mr-2 h-4 w-4"/>} Analizar
                </Button>
            </CardHeader>
            <CardContent>
                <UiTable>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tabla</TableHead>
                            <TableHead className="text-right"># Cols</TableHead>
                            <TableHead className="text-right"># FX</TableHead>
                            <TableHead className="text-right"># IDX</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summaryData.map(table => (
                            <TableRow key={table.name}>
                                <TableCell className="font-mono text-xs">{table.name}</TableCell>
                                <TableCell className="text-right">{table.cols}</TableCell>
                                <TableCell className="text-right">{table.fx}</TableCell>
                                <TableCell className="text-right">{table.idx}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </UiTable>
                 <Button variant="link" size="sm" asChild className="w-full mt-2 text-muted-foreground">
                    <Link href="/schema" className="flex items-center">
                        <Eye className="mr-2 h-4 w-4"/> Ver esquema completo
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export default function RefactorPage() {
  const context = useContext(DbSessionContext);
  if (!context) throw new Error("RefactorPage must be used within a DbSessionProvider");
  
  const { sessionId } = context;

  const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: true, allowDestructive: false });
  const [rootKey] = useState("SOLUTION");
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | "plan" | "codefix" | false>(false);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  
  const [isCleanupAlertOpen, setCleanupAlertOpen] = useState(false);
  const [isApplyAlertOpen, setApplyAlertOpen] = useState(false);
  
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
    if (!sessionId && !['plan', 'codefix'].includes(loadingState)) {
      toast({ variant: "destructive", title: "La sesión no está activa.", description: "Por favor, conéctate a una base de datos primero." });
      return;
    }
     if (plan.renames.length === 0 && !['analyze', 'cleanup'].includes(loadingState)) {
      toast({ variant: "destructive", title: "El plan de refactorización no puede estar vacío." });
      return;
    }

    setLoading(loadingState);
    if(loadingState !== 'plan' && loadingState !== 'codefix') {
      setResult(null);
    }
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
      if(loadingState !== 'analyze') {
        setResult({ ok: false, error: errorMessage });
      }
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
  
  const handleAnalyze = () => handleApiCall(
    () => analyzeSchema(sessionId!),
    "analyze",
    (data) => setSchema(data),
    { loading: "Analizando esquema...", success: "Esquema analizado.", error: "Fallo al analizar el esquema." }
  );

  const handleRefactor = (apply: boolean) => {
    if (apply) {
        setApplyAlertOpen(true);
        return;
    }
    
    handleApiCall(
    () => runRefactor({ sessionId: sessionId!, plan, apply, rootKey, ...options }),
    "preview",
    (data) => setResult(prev => ({ ...prev, ...data })),
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
        (data) => setResult(prev => ({ ...prev, ...data })),
        { 
          loading: "Aplicando cambios...",
          success: "Cambios aplicados.",
          error: "Error al aplicar cambios."
        }
    );
    setApplyAlertOpen(false);
  }

  const triggerCleanup = () => {
    setCleanupAlertOpen(true);
  };
  
  const handleCleanup = () => {
    if (!sessionId) return;
    handleApiCall(
        () => runCleanup({ sessionId, renames: plan.renames, ...options }),
        "cleanup",
        (data) => {
            setResult(data);
            setCleanupAlertOpen(false);
        },
        { loading: "Ejecutando limpieza...", success: "Limpieza completada.", error: "Falló la limpieza." }
    );
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
                   <SidebarMenuItem>
                      <Link href="/schema" asChild>
                        <SidebarMenuButton>
                           <Database />
                           Esquema
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton>
                         <Settings />
                         Ajustes
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
                {/* Columna Izquierda */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <ConnectionManager/>
                    <RepositoryManager/>
                    <OptionsManager options={options} setOptions={setOptions}/>
                </div>

                {/* Columna Derecha */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                    <PlanManager plan={plan} setPlan={setPlan}/>
                    
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={!!loading}>
                            {loading === 'preview' ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye className="h-4 w-4"/>}
                            <span className="ml-2">Vista Previa BD</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePlan} disabled={!!loading}>
                            {loading === 'plan' ? <Loader2 className="animate-spin h-4 w-4" /> : <FileCode className="h-4 w-4"/>}
                            <span className="ml-2">Generar SQL</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCodefix} disabled={!!loading}>
                            {loading === 'codefix' ? <Loader2 className="animate-spin h-4 w-4" /> : <FolderGit2 className="h-4 w-4"/>}
                            <span className="ml-2">Vista Previa Código</span>
                        </Button>
                        <Button onClick={() => handleRefactor(true)} disabled={!!loading} className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90">
                            {loading === 'apply' ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4"/>}
                            <span className="ml-2">Aplicar</span>
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                        <div className="flex flex-col">
                           <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
                        </div>
                        <div className="flex flex-col">
                          <SchemaSummary onAnalyze={handleAnalyze} loading={loading === 'analyze'}/>
                        </div>
                    </div>
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
    </div>
  );
}

    