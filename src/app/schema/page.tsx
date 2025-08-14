
"use client";

import React, { useState, useEffect, useContext } from "react";
import { useDbSession, DbSessionContext } from "@/hooks/useDbSession";
import { useToast } from "@/hooks/use-toast";
import {
  Wand2,
  Database,
  Settings,
  FileCode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import Link from 'next/link';
import ResultsPanel from "@/components/refactor/ResultsPanel";
import type { RefactorResponse } from "@/lib/types";


export default function ResultsPage() {
    const context = useContext(DbSessionContext);
    if (!context) throw new Error("SchemaPage must be used within a DbSessionProvider");
    
    const { sessionId } = context;
    // This state would be populated from a parent component or a global store
    // where the refactor results are kept. For now, it's null.
    const [result, setResult] = useState<RefactorResponse | null>(null);


    if (!sessionId) {
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
                                    <SidebarMenuButton><Wand2 />Refactorizar</SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                 <Link href="/schema">
                                    <SidebarMenuButton isActive><Database />Resultados</SidebarMenuButton>
                                 </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarContent>
                </Sidebar>
                <SidebarInset>
                     <main className="flex-grow p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
                        <div className="flex h-full w-full items-center justify-center">
                            <div className="text-center">
                                <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h2 className="mt-4 text-xl font-semibold">No conectado</h2>
                                <p className="mt-2 text-muted-foreground">Por favor, vuelve al inicio y conéctate a una base de datos para ver los resultados.</p>
                                <Button className="mt-4" asChild>
                                    <Link href="/">Volver al Inicio</Link>
                                </Button>
                            </div>
                        </div>
                    </main>
                </SidebarInset>
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
                             <Link href="/">
                                <SidebarMenuButton>
                                    <Wand2 />
                                    Refactorizar
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                             <Link href="/schema">
                                <SidebarMenuButton isActive>
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
                        <h1 className="text-2xl font-bold">Resultados de Refactorización</h1>
                    </header>
                    <div className="flex-1 min-h-0">
                       {/* The actual results would be passed into this panel */}
                       <ResultsPanel result={result} loading={false} error={result?.error || null} />
                    </div>
                </main>
            </SidebarInset>
        </div>
    );
}

    