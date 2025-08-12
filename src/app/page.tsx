"use client";

import { useState, useEffect, useMemo } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest, Table, Column, SchemaResponse } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/refactor/CodeBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wand2,
  History,
  LayoutGrid,
  Settings,
  Database,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Power,
  PowerOff
} from "lucide-react";
import { Logo } from "@/components/logo";

function SchemaViewer({ schema, onRefresh }: { schema: SchemaResponse | null; onRefresh: () => void; }) {
    if (!schema) return null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Esquema (opcional)</CardTitle>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refrescar esquema
                </Button>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {schema.tables.map((table) => (
                        <AccordionItem value={table.name} key={table.name}>
                            <AccordionTrigger className="text-sm">
                                <div className="flex items-center gap-2">
                                    {table.name}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <UiTable>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Column</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Nullable</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {table.columns.map((col) => (
                                            <TableRow key={col.name}>
                                                <TableCell>{col.name}</TableCell>
                                                <TableCell>{col.sqlType}</TableCell>
                                                <TableCell>{col.isNullable ? 'Yes' : 'No'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </UiTable>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}


export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("server=myserver;Database=example;");
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: false });
  
  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  
  const { toast } = useToast();

  const handleAnalyze = (showToast = true) => {
    if (connectionString.trim() === "") {
        if (showToast) toast({ variant: "destructive", title: "Connection string is required." });
        return;
    }
    setLoading("analyze");
    setError(null);
    analyzeSchema(connectionString)
      .then(schema => {
        if (showToast) toast({ title: "Analysis Complete", description: "Schema loaded successfully." });
        setSchema(schema);
        setConnectionOk(true);
      })
      .catch(err => {
        const errorMessage = err.message || "Failed to analyze schema.";
        setError(errorMessage);
        if (showToast) toast({ variant: "destructive", title: "Analysis Failed", description: errorMessage });
        setSchema(null);
        setConnectionOk(false);
      })
      .finally(() => setLoading(false));
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
                          Refactor
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton>
                          <History />
                          Historial
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton>
                          <LayoutGrid />
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
          <SidebarFooter>
              <div className="p-2">
                 <Button variant="outline" className="w-full mt-2">
                      <Power className="mr-2 h-4 w-4"/>
                      Scnexión
                 </Button>
              </div>
          </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <header className="sticky top-0 z-10 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <div className="mr-4 hidden md:flex">
                  <h1 className="text-xl font-bold">Refactar BD + Codigo</h1>
                </div>
                <SidebarTrigger className="md:hidden" />
                <div className="flex flex-1 items-center justify-end space-x-4">
                  <Badge variant="outline" className="text-xs">
                    Development
                  </Badge>
                  <Badge variant="secondary" className="hidden sm:inline-flex items-center text-xs">
                    <span className="w-2 h-2 mr-2 rounded-full bg-blue-500"></span>
                    https://localhost:7040
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
            </div>
        </header>
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              {/* Left Column */}
              <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Connection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="connection-string" className="text-muted-foreground">Connection String</Label>
                        <Textarea
                          id="connection-string"
                          placeholder="server=myserver;Database=example;"
                          rows={3}
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          className="font-mono text-sm mt-2 bg-black/20"
                        />
                         <div className="flex gap-2 mt-4">
                            <Button variant="ghost" size="sm" className="text-muted-foreground">Renombrar tabla</Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">Renombrar columna</Button>
                         </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Opciones</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="use-synonyms">Use Synonyms</Label>
                                <Switch id="use-synonyms" checked={options.useSynonyms} onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="use-views">Use Views</Label>
                                <Switch id="use-views" checked={options.useViews} onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cors" className="flex items-center">CORS</Label>
                                <Button variant="ghost" size="icon"><ChevronRight/></Button>
                            </div>
                            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
                                Las visiaa son sofo lectura Cleam u tas elthrina cuando migres et zedigo.
                            </div>

                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex justify-between items-center text-sm">
                                <span>Files scanned</span>
                                <span className="font-bold">1</span>
                             </div>
                             <div className="flex justify-between items-center text-sm">
                                <span>Changed</span>
                                <span className="font-bold">2</span>
                             </div>
                             <div className="flex items-center justify-between">
                                <Label htmlFor="analyze-action" className="flex items-center">Analyzar</Label>
                                <Button variant="ghost" size="icon"><ChevronRight/></Button>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span>Previosio</span>
                                <span className="font-bold">Gengaurza</span>
                             </div>
                        </CardContent>
                    </Card>
                </div>
                 <div className="flex flex-col gap-4">
                    {connectionOk === true &&
                        <Badge className="bg-green-500 hover:bg-green-600 text-primary-foreground">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Conexión Exitosa
                        </Badge>
                    }
                    {connectionOk === false &&
                        <Badge variant="destructive">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Conexión Fallida
                        </Badge>
                    }
                     <Button className="bg-[#4A69FF] hover:bg-blue-700 text-white w-full">Preview</Button>
                    <div className="flex gap-4">
                        <Button size="lg" className="w-full bg-[#FF471A] hover:bg-orange-600" onClick={() => {}}>Aplicar</Button>
                        <Button variant="secondary" className="w-full" onClick={() => {}}>Cleanup</Button>
                        <Button variant="ghost" className="w-full" onClick={() => handleAnalyze()}>Analyze</Button>
                    </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6 sticky top-20">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Tabs defaultValue="resumen" className="w-full">
                                <TabsList>
                                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                                    <TabsTrigger value="sql">SQL</TabsTrigger>
                                    <TabsTrigger value="codefix">CodeFix</TabsTrigger>
                                    <TabsTrigger value="logs">Logs</TabsTrigger>
                                </TabsList>
                                <TabsContent value="resumen" className="mt-4">
                                     <div className="space-y-4">
                                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                                            <div className="flex items-center gap-2 text-sm">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span>Resumen ok</span>
                                            </div>
                                            <Button variant="ghost" size="sm">OOS <ChevronRight className="h-4 w-4 ml-1" /></Button>
                                        </div>
                                        <UiTable>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>File</TableHead>
                                                    <TableHead>Changed</TableHead>
                                                    <TableHead>Preview</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Badge variant="outline" className="text-green-400 border-green-400"><CheckCircle className="mr-1 h-3 w-3"/> Stzzi</Badge></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                    <TableCell>
                                                        <div className="bg-destructive/20 text-destructive-foreground p-2 rounded-md border border-destructive/50">
                                                            <div className="flex items-center text-sm font-bold"><AlertTriangle className="h-4 w-4 mr-2" />Diff</div>
                                                            <div className="text-xs mt-1 pl-6">
                                                                <p className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-400" /> Expercus</p>
                                                                <p className="flex items-center gap-1"><Database className="h-3 w-3 text-orange-400" /> taambs</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </UiTable>
                                        <Button variant="outline" size="sm"><LayoutGrid className="mr-2 h-4 w-4"/> Analyzar</Button>
                                     </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                    <SchemaViewer schema={schema} onRefresh={() => handleAnalyze(true)} />
              </div>
            </div>
        </main>
      </SidebarInset>
    </div>
  );
}