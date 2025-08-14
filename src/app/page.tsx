
"use client";

import React, { useState, useEffect, useContext } from "react";
import type { RefactorPlan, RefactorResponse, SchemaResponse, RenameOperation } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Wand2,
  Loader2,
  CheckCircle,
  Power,
  FileText,
  Trash2,
  Database,
  Eye,
  FileCode,
  Play,
  Settings,
  Pencil,
  PlusCircle,
  XCircle,
  FolderGit2
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
    
    const { sessionId, expiresAt, disconnect, loading } = context;

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
                           <span className="text-sm">Conectado</span>
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
    return null;
}

function RepositoryManager() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Repositorio</CardTitle>
            </CardHeader>
            <CardContent>
                <Label htmlFor="root-key">Clave Raiz</Label>
                <Input id="root-key" readOnly value="SOLUTION" className="mt-2 bg-input"/>
            </CardContent>
        </Card>
    );
}

function OptionsManager({ options, setOptions }) {
     return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium">Opciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="use-synonyms">Usar Sinónimos</Label>
                    <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(c) => setOptions(p => ({...p, useSynonyms: c}))} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="use-views">Usar Vistas</Label>
                    <Switch id="use-views" checked={options.useViews} onCheckedChange={(c) => setOptions(p => ({...p, useViews: c}))} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="cqrs">CORS</Label>
                    <Switch id="cqrs" checked={options.cqrs} onCheckedChange={(c) => setOptions(p => ({...p, cqrs: c}))} />
                </div>
            </CardContent>
        </Card>
    );
}

function PlanManager({ plan, setPlan }) {
    // Dummy state for new operation form
    const [newOp, setNewOp] = useState({ scope: 'column', tableFrom: '', columnFrom: '', tableTo: '' });

    const handleAddOperation = () => {
        if (!newOp.tableFrom) return; // Add more validation as needed
        const op: RenameOperation = {
            scope: newOp.scope as any,
            tableFrom: newOp.tableFrom,
            ...(newOp.scope === 'column' && { columnFrom: newOp.columnFrom, columnTo: newOp.tableTo }),
            ...(newOp.scope === 'table' && { tableTo: newOp.tableTo }),
        };
        setPlan(prev => ({ ...prev, renames: [...prev.renames, op] }));
        // Reset form
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
                            {/* This is a simplified form. A real one would use selects and better state management */}
                            <Input placeholder="Scope" value={newOp.scope} onChange={e => setNewOp({...newOp, scope: e.target.value})} />
                            <Input placeholder="TableFrom" value={newOp.tableFrom} onChange={e => setNewOp({...newOp, tableFrom: e.target.value})} />
                            <Input placeholder="ColumnFrom" value={newOp.columnFrom} onChange={e => setNewOp({...newOp, columnFrom: e.target.value})} disabled={newOp.scope !== 'column'} />
                            <Input placeholder="TableTo/ColumnTo" value={newOp.tableTo} onChange={e => setNewOp({...newOp, tableTo: e.target.value})} />
                            <Button onClick={handleAddOperation}>Añadir</Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {plan.renames.map((op, index) => (
                             <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm">
                                <div className="flex items-center gap-4 font-mono text-xs">
                                    <Badge variant="outline" className="w-20 justify-center">{op.scope}</Badge>
                                    <span>{op.scope === 'table' ? `${op.tableFrom} -> ${op.tableTo}` : `${op.tableFrom}.${op.columnFrom} -> ${op.columnTo}`}</span>
                                </div>
                                <div className="flex items-center">
                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Pencil className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveOperation(index)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                             </div>
                        ))}
                         {plan.renames.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay operaciones en el plan.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ConnectionView() {
  const context = useContext(DbSessionContext);
  if (!context) throw new Error("ConnectionView must be used within a DbSessionProvider");
  
  const { connect, loading, error } = context;
  const [cs, setCs] = useState("");
  const { toast } = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(`cs_${Math.random().toString(36).slice(2)}`);
  }, []);

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
  
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="flex flex-col items-center justify-center text-center max-w-lg w-full px-8">
        <Database className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold">Bienvenido a DRefactor</h2>
        <p className="text-muted-foreground mt-2">
          Para empezar, conéctate a tu base de datos para analizar el esquema y empezar a refactorizar.
        </p>
        <div className="w-full space-y-4 mt-8">
          <Textarea
            id="connection-string"
            value={cs}
            onChange={(e) => setCs(e.target.value)}
            placeholder="Pega aquí tu cadena de conexión..."
            className="w-full h-32 p-4 rounded-lg border font-mono text-sm bg-background"
            autoComplete="off"
            spellCheck={false}
            name={name}
            data-lpignore="true"
            data-1p-ignore="true"
          />
          <Button
            onClick={onConnect}
            disabled={loading || !cs.trim()}
            className="w-full text-base py-6 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
            Conectar de forma segura
          </Button>
          {error && (
            <p className="mt-2 px-2 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
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

  const handleRefactor = (apply: boolean) => {
    if (!sessionId) return;
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
            {!sessionId ? (
                <div className="flex-1 min-h-0">
                    <ConnectionView />
                </div>
            ) : (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Columna Izquierda */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <ConnectionManager/>
                    <RepositoryManager/>
                    <OptionsManager options={options} setOptions={setOptions}/>
                </div>

                {/* Columna Derecha */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <PlanManager plan={plan} setPlan={setPlan}/>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={!sessionId || plan.renames.length === 0 || !!loading}>
                            {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                            Vista Previa BD
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePlan} disabled={!sessionId || plan.renames.length === 0 || !!loading}>
                            {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                            Generar SQL
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleCodefix(false)} disabled={!sessionId || plan.renames.length === 0 || !!loading}>
                            {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                            Vista Previa Código
                        </Button>
                        <Button onClick={() => handleRefactor(true)} disabled={!sessionId || plan.renames.length === 0 || !!loading} className="ml-auto">
                            {loading === 'apply' ? <Loader2 className="animate-spin" /> : <Play />}
                            Aplicar
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-6 flex-1">
                        <div className="flex flex-col">
                           <ResultsPanel result={result} loading={!!loading} error={result?.error || null} />
                        </div>
                        <Card>
                            <CardHeader className="flex flex-row justify-between items-center">
                                <CardTitle className="text-base font-medium">Esquema</CardTitle>
                                <Button variant="outline" size="sm"><Database className="mr-2 h-4 w-4"/> Analizar</Button>
                            </CardHeader>
                            <CardContent>
                                {/* Schema summary table would go here */}
                                <p className="text-sm text-muted-foreground">Analiza el esquema para ver las tablas.</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
             </div>
            )}
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
