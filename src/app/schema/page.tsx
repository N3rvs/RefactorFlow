

"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, SchemaResponse, RenameOperation, PlanRequest, Table, Column } from "@/lib/types";
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
  Loader2,
  RefreshCw,
  Power,
  Database,
  Info,
  PlusCircle,
  XCircle,
  Box,
  SlidersHorizontal,
  Pencil,
  KeyRound,
  Link2,
  Search,
  CheckCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDbSession } from "@/hooks/useDbSession";

function SchemaViewer({ 
    schema, 
    onRefresh, 
    loading,
    plan,
    onPlanChange,
}: { 
    schema: SchemaResponse | null; 
    onRefresh: () => void; 
    loading: boolean;
    plan: RefactorPlan;
    onPlanChange: (newPlan: RefactorPlan) => void;
}) {
    const hasSchema = schema && schema.tables && schema.tables.length > 0;
    const [newColumns, setNewColumns] = useState<Record<string, { name: string; type: string }>>({});
    const [searchTerm, setSearchTerm] = useState("");

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
    
    const enhancedTables = useMemo(() => {
        if (!schema?.tables) return [];
        const tablesWithPk = schema.tables.map(table => {
            const pkIndex = table.indexes?.find(idx => idx.isPrimary);
            const pkColumns = pkIndex ? pkIndex.columns : [];
            const columnsWithPk = table.columns.map(col => ({
                ...col,
                isPrimaryKey: pkColumns.includes(col.name)
            }));
            return { ...table, columns: columnsWithPk };
        });
        
        if (!searchTerm) {
            return tablesWithPk;
        }

        return tablesWithPk.filter(table => table.name.toLowerCase().includes(searchTerm.toLowerCase()));

    }, [schema, searchTerm]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <CardTitle className="text-base font-medium">Esquema de la Base de Datos</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                    Actualizar
                </Button>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar tablas..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
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
                        <p className="text-sm">Usa la página de Refactorización para iniciar una sesión y luego vuelve aquí para ver el esquema.</p>
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
                                    {table.foreignKeys && table.foreignKeys.length > 0 && (
                                        <div className="mt-4 pt-2 border-t border-border/50">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Claves Foráneas</p>
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


export default function SchemaPage() {
  const { sessionId, loading: sessionLoading, disconnect } = useDbSession();
  const [plan, setPlan] = useState<RefactorPlan>({ renames: [] });
  
  const [loading, setLoading] = useState<"analyze" | false>(false);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  
  const { toast, dismiss } = useToast();

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "Ocurrió un error desconocido.";
  }

  const handleAnalyze = React.useCallback(() => {
     if (!sessionId) {
      toast({ variant: "destructive", title: "Inicia una sesión en la página de Refactorizar para ver el esquema." });
      return;
    }

    setLoading("analyze");
    const { id } = toast({ title: "Analizando esquema...", duration: 999999 });

    analyzeSchema(sessionId)
      .then(data => {
        dismiss(id);
        toast({ variant: "default", title: "Análisis de esquema completado.", duration: 3000 });
        setSchema(data);
      })
      .catch(err => {
        const errorMessage = getErrorMessage(err);
        dismiss(id);
        toast({ variant: "destructive", title: "Falló el análisis de esquema.", description: errorMessage, duration: 5000 });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId, toast, dismiss]);

  useEffect(() => {
    if(sessionId && !schema) {
        handleAnalyze();
    }
  }, [sessionId, schema, handleAnalyze])

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
                      <SidebarMenuButton>
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
                      <SidebarMenuButton isActive>
                          <Box />
                          Esquema
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="p-2 border-t border-border">
                 <Button variant={"outline"} className="w-full mt-2 justify-start gap-2" onClick={disconnect} disabled={!sessionId || sessionLoading}>
                      {sessionLoading ? <Loader2 className="animate-spin" /> : <Power />}
                      <span>{sessionId ? "Desconectar" : "Sin Conexión"}</span>
                 </Button>
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <header className="sticky top-0 z-10 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <div className="mr-4 hidden md:flex">
                  <h1 className="text-xl font-medium">Esquema de la Base de Datos</h1>
                </div>
                <div className="flex flex-1 items-center justify-end space-x-4">
                  <Badge variant="outline" className="text-xs font-normal">Desarrollo</Badge>
                </div>
            </div>
        </header>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 items-start h-full">
              <div className="lg:col-span-1 flex flex-col gap-6">
                  <SchemaViewer 
                    schema={schema} 
                    onRefresh={handleAnalyze} 
                    loading={loading === 'analyze' || sessionLoading}
                    plan={plan}
                    onPlanChange={setPlan}
                   />
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}

    
