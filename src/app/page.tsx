
"use client";

import React, { useState, useEffect, useContext } from "react";
import type { RefactorPlan, RefactorResponse, SchemaResponse, RenameOperation } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema, generatePlan, runCodeFix } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  DatabaseZap,
  Circle,
  Link2,
  Github,
  GitBranch
} from "lucide-react";
import { Logo } from "@/components/logo";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { cn } from "@/lib/utils";
import { useDbSession, DbSessionContext } from "@/hooks/useDbSession";

const initialPlan: RefactorPlan = {
  renames: [],
};

function ConnectionManager() {
    const context = useContext(DbSessionContext);
    if (!context) throw new Error("ConnectionManager must be used within a DbSessionProvider");
    
    const { sessionId, connect, loading, error, disconnect, sessionLoading } = context;
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
    
    if (sessionId) {
        return (
             <div className="space-y-2">
                <div className="flex items-center justify-between text-sm p-2">
                  <div className={`flex items-center gap-2 ${sessionId ? 'text-green-400' : 'text-muted-foreground'}`}>
                     <Circle className={`h-3 w-3 fill-current`} />
                     <span>{sessionId ? 'Conectado' : 'Desconectado'}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={disconnect} disabled={!sessionId || sessionLoading}>
                     {sessionLoading ? <Loader2 className="animate-spin" /> : <Power />}
                     Desconectar
                </Button>
             </div>
        );
    }

    return (
        <div className="space-y-4 p-2">
            <h3 className="text-sm font-medium px-2">Conectar a Base de Datos</h3>
            <Textarea
                id="connection-string"
                value={cs}
                onChange={(e) => setCs(e.target.value)}
                placeholder="Pega aquí tu cadena de conexión..."
                className="w-full h-24 p-2 rounded border font-mono text-sm bg-background"
                autoComplete="off"
                spellCheck={false}
                name={name}
                data-lpignore="true" data-1p-ignore="true"
            />
            <Button onClick={onConnect} disabled={loading || !cs.trim()} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : <Link2 />}
                Conectar
            </Button>
            {error && (
                <p className="mt-2 px-2 text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}

function RepositoryManager() {
    return (
        <div className="space-y-4 p-2">
            <h3 className="text-sm font-medium px-2">Repositorio de Código</h3>
            <div className="p-2 rounded-lg bg-muted/50 text-sm text-muted-foreground text-center">
                <Github className="mx-auto h-8 w-8 mb-2"/>
                <p>Aún no has conectado un repositorio.</p>
            </div>
             <Button variant="outline" className="w-full">
                <GitBranch className="mr-2 h-4 w-4"/>
                Conectar Repositorio
            </Button>
        </div>
    )
}

export default function RefactorPage() {
  const context = useContext(DbSessionContext);
  if (!context) throw new Error("RefactorPage must be used within a DbSessionProvider");
  
  const { sessionId, disconnect, loading: sessionLoading } = context;

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

  const MainContent = () => {
    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8">
                <div className="flex flex-col items-center justify-center text-center">
                    <DatabaseZap className="h-16 w-16 text-primary mb-4" />
                    <h2 className="text-2xl font-bold">Bienvenido a DB Refactor</h2>
                    <p className="text-muted-foreground mt-2 max-w-md">
                        Para empezar, conecta una base de datos desde el panel lateral.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium">Opciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="use-synonyms" className="text-sm">Usar Sinónimos</Label>
                            <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(c) => setOptions(p => ({...p, useSynonyms: c}))} />
                        </div>
                         <div className="flex items-center justify-between">
                            <Label htmlFor="use-views" className="text-sm">Usar Vistas</Label>
                            <Switch id="use-views" checked={options.useViews} onCheckedChange={(c) => setOptions(p => ({...p, useViews: c}))} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6">
                 <div className="flex-1">
                    <ResultsPanel result={result} loading={!!loading && loading !== 'analyze'} error={result?.error || null} />
                 </div>
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
                   <SidebarMenuItem>
                      <Link href="/schema" passHref asChild>
                        <SidebarMenuButton>
                           <Database />
                           Explorar Esquema
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
           <SidebarFooter>
             <RepositoryManager />
             <div className="my-4 border-t border-sidebar-border -mx-4"></div>
             <ConnectionManager />
           </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
            <header className="flex items-center justify-between mb-6">
                <Card className="flex-1 mr-4">
                    <CardContent className="p-2">
                        <Input placeholder="Describe tu plan de refactorización o edita el esquema directamente..." className="border-none focus-visible:ring-0 text-base" />
                    </CardContent>
                </Card>
                 <div className="flex items-center gap-2">
                    <Button onClick={() => handleRefactor(true)} disabled={loading === 'apply' || !sessionId || plan.renames.length === 0} className="bg-destructive hover:bg-destructive/90">
                        <Play className="mr-2"/>
                        Aplicar Cambios
                    </Button>
                    <Button variant="outline" onClick={triggerCleanup} disabled={loading === 'cleanup' || !sessionId || plan.renames.length === 0}>
                        <Trash2 className="mr-2"/>
                        Limpieza
                    </Button>
                </div>
            </header>
             <div className="bg-muted/30 p-2 rounded-lg mb-6">
                <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={loading === 'preview' || !sessionId || plan.renames.length === 0}>
                          {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                          Vista Previa DB
                      </Button>
                       <Button variant="outline" size="sm" onClick={handlePlan} disabled={loading === 'plan' || !sessionId || plan.renames.length === 0}>
                          {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                          Generar SQL
                      </Button>
                       <Button variant="outline" size="sm" onClick={() => handleCodefix(false)} disabled={loading === 'codefix' || !sessionId || plan.renames.length === 0}>
                          {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                          Vista Previa Código
                      </Button>
                 </div>
             </div>
            <div className="flex-1 min-h-0">
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

    