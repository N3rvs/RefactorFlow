
"use client";

import React, { useState, useEffect, useContext, useMemo } from "react";
import { useDbSession } from "@/hooks/useDbSession";
import { analyzeSchema, runRefactor } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { RefactorPlan, SchemaResponse, RenameOperation, Table, Column } from "@/lib/types";
import {
  Wand2,
  Loader2,
  RefreshCw,
  Database,
  Pencil,
  Play,
  KeyRound,
  Search,
  PlusCircle,
  XCircle,
  Power,
  CheckCircle,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import Link from 'next/link';
import { cn } from "@/lib/utils";

const initialPlan: RefactorPlan = {
  renames: [],
};


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
            <CardContent className="flex-1 flex flex-col p-4">
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
                        <p>No se encontraron tablas. Verifica la cadena de conexión o los permisos.</p>
                    </div>
                )}
                {!loading && schema && schema.tables.length > 0 && (
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

export default function SchemaPage() {
    const context = useDbSession();
    if (!context) throw new Error("SchemaPage must be used within a DbSessionProvider");
    
    const { sessionId, disconnect, loading: sessionLoading } = context;

    const [plan, setPlan] = useState<RefactorPlan>(initialPlan);
    const [schema, setSchema] = useState<SchemaResponse | null>(null);
    const [loadingSchema, setLoadingSchema] = useState(true);
    const { toast } = useToast();

    const handleAnalyze = React.useCallback(async () => {
        if (!sessionId) {
          return;
        }
        setLoadingSchema(true);
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
          setSchema({ tables: [] }); // Clear schema on error
        } finally {
          setLoadingSchema(false);
        }
    }, [sessionId, toast]);

    useEffect(() => {
        if (sessionId) {
            handleAnalyze();
        }
    }, [sessionId, handleAnalyze]);

    const removeRename = (index: number) => {
        setPlan(prev => ({ ...prev, renames: prev.renames.filter((_, i) => i !== index) }));
    };
    
    const handleApply = async () => {
        if (!sessionId) {
            toast({ variant: "destructive", title: "La sesión no está activa." });
            return;
        }
        if (plan.renames.length === 0) {
            toast({ variant: "destructive", title: "El plan está vacío." });
            return;
        }
        
        try {
            await runRefactor({ sessionId, plan, apply: true, rootKey: 'SOLUTION', useSynonyms: true, useViews: true, cqrs: true });
            toast({ title: "Plan aplicado con éxito" });
            handleAnalyze(); // Re-fetch schema
        } catch(err: any) {
            toast({ variant: "destructive", title: "Error al aplicar el plan", description: err.message });
        }
    };


    if (!sessionId && !sessionLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="text-center">
                    <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">No conectado</h2>
                    <p className="mt-2 text-muted-foreground">Por favor, vuelve al inicio y conéctate a una base de datos para explorar el esquema.</p>
                    <Link href="/" passHref>
                        <Button className="mt-4">Volver al Inicio</Button>
                    </Link>
                </div>
            </div>
        );
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
                            <Link href="/" asChild>
                                <SidebarMenuButton>
                                    <Wand2 />
                                    Refactorizar
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton isActive>
                                <Database />
                                Esquema
                            </SidebarMenuButton>
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
                    <header className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">Explorador de Esquema</h1>
                         <Button onClick={handleApply} disabled={plan.renames.length === 0} className="bg-destructive hover:bg-destructive/90">
                            <Play className="mr-2" />
                            Aplicar Plan
                        </Button>
                    </header>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
                        <div className="lg:col-span-3 h-full">
                           <SchemaEditor 
                             schema={schema}
                             loading={loadingSchema}
                             plan={plan}
                             onPlanChange={setPlan}
                             onRefresh={handleAnalyze}
                           />
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-6">
                           <PlanReview plan={plan} onRemove={removeRename} />
                        </div>
                    </div>
                </main>
            </SidebarInset>
        </div>
    );
}
