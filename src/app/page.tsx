
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  ChevronDown,
  Circle,
  Plus,
  Link2
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
    
    const { sessionId, connect, disconnect, loading, error, expiresAt } = context;
    const [cs, setCs] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const { toast } = useToast();
    const [name, setName] = useState("");

    useEffect(() => {
        // This ensures the random name is only generated on the client, avoiding hydration mismatches.
        setName(`cs_${Math.random().toString(36).slice(2)}`);
    }, []);

    useEffect(() => {
        if (sessionId) {
            setCs("");
        }
    }, [sessionId]);

    const onConnect = async () => {
        if (!cs.trim()) return;
        setIsConnecting(true);
        try {
            await connect(cs.trim(), 3600);
            toast({ title: "Conexión exitosa", description: "La sesión está activa. Ya puedes explorar el esquema." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error de conexión", description: err.message });
        } finally {
            setIsConnecting(false);
        }
    };
    
    if (sessionId) {
        return null; // Don't show anything in the main panel if connected
    }

    return (
        <div className="flex flex-col items-center justify-center h-full gap-8">
             <div className="flex flex-col items-center justify-center text-center">
                <DatabaseZap className="h-16 w-16 text-primary mb-4" />
                <h2 className="text-2xl font-bold">Bienvenido a DB Refactor</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Para empezar, por favor introduce la cadena de conexión a tu base de datos. La conexión es efímera y segura.
                </p>
            </div>
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="font-medium text-base flex items-center gap-2">
                        <Power className="h-4 w-4" />
                        Conectar a la Base de Datos
                    </CardTitle>
                    <CardDescription>
                        Tu cadena de conexión se usa una sola vez para crear una sesión segura y no se almacena.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Textarea
                            id="connection-string"
                            value={cs}
                            onChange={(e) => setCs(e.target.value)}
                            placeholder="Pega aquí tu cadena de conexión..."
                            className="w-full h-24 p-2 rounded border font-mono text-sm"
                            autoComplete="off"
                            spellCheck={false}
                            name={name}
                            data-lpignore="true" data-1p-ignore="true"
                        />
                        <Button onClick={onConnect} disabled={isConnecting || !cs.trim()} className="w-full">
                            {isConnecting ? <Loader2 className="animate-spin" /> : <Link2 />}
                            Conectar
                        </Button>
                    </div>
                    {error && (
                        <p className="mt-2 text-xs text-destructive">{error}</p>
                    )}
                </CardContent>
            </Card>
        </div>
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
  }, [sessionId, toast]);

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
    const hasDestructiveOps = plan.renames.some(op => op.scope.startsWith('drop'));
    if (hasDestructiveOps || options.allowDestructive) {
      setCleanupAlertOpen(true);
    } else {
      handleCleanup();
    }
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
        return <ConnectionManager />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {/* Left Column */}
            <div className="md:col-span-1 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Conexión</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <p className="text-sm text-muted-foreground">Sesión activa.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Repositorio</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <p className="text-sm text-muted-foreground">No configurado.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Opciones</CardTitle>
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
                    </CardContent>
                </Card>
            </div>

            {/* Right Column */}
            <div className="md:col-span-2 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <Button variant="outline"><Plus className="mr-2"/> Añadir operacion manual</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost">Resultado <ChevronDown className="ml-2"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>SQL</DropdownMenuItem>
                        <DropdownMenuItem>CodeFix</DropdownMenuItem>
                         <DropdownMenuItem>Logs</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                 <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRefactor(false)} disabled={loading === 'preview' || plan.renames.length === 0}>
                          {loading === 'preview' ? <Loader2 className="animate-spin" /> : <Eye/>}
                          Vista Previa DB
                      </Button>
                       <Button variant="outline" size="sm" onClick={handlePlan} disabled={loading === 'plan' || plan.renames.length === 0}>
                          {loading === 'plan' ? <Loader2 className="animate-spin" /> : <FileText/>}
                          Generar SQL
                      </Button>
                       <Button variant="outline" size="sm" onClick={() => handleCodefix(false)} disabled={loading === 'codefix' || plan.renames.length === 0}>
                          {loading === 'codefix' ? <Loader2 className="animate-spin" /> : <FileCode/>}
                          Vista Previa Código
                      </Button>
                 </div>
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
                          <Circle className={`mr-2 h-2 w-2 ${sessionId ? 'text-green-500' : 'text-muted-foreground'}`} />
                          Conexión
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <Button variant="ghost" className="w-full justify-start" onClick={disconnect} disabled={!sessionId || sessionLoading}>
                         Desconectar
                      </Button>
                  </SidebarMenuItem>
              </SidebarMenu>
               <div className="p-2 mt-auto">
                 <div className="h-20 bg-muted rounded-md mb-4" />
                 <Link href="/schema" passHref legacyBehavior>
                    <a className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full bg-accent hover:bg-accent/90')}>
                        Explorar esquema
                    </a>
                </Link>
              </div>
          </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <header className="flex items-center justify-between mb-6">
                <Card className="flex-1">
                    <CardContent className="p-2">
                        <Input placeholder="Pran de refactorizar" className="border-none focus-visible:ring-0" />
                    </CardContent>
                </Card>
            </header>
            <div className="flex-1">
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

    