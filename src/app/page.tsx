"use client";

import { useState, useEffect, useMemo } from "react";
import type { RefactorPlan, RefactorResponse, CleanupRequest, RefactorRequest } from "@/lib/types";
import { runRefactor, runCleanup, analyzeSchema } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import Header from "@/components/layout/Header";
import RefactorForm from "@/components/refactor/RefactorForm";
import ResultsPanel from "@/components/refactor/ResultsPanel";
import { ApplyConfirmDialog } from "@/components/refactor/ApplyConfirmDialog";

const defaultPlan = {
  renames: [
    {
      scope: "column",
      tableFrom: "AppBeers",
      columnFrom: "Alcohol",
      columnTo: "AbvPercent",
      type: "decimal(5,2)",
    },
    { scope: "table", tableFrom: "AppBeers", tableTo: "Beverages" },
  ],
};

export default function RefactorPage() {
  const [connectionString, setConnectionString] = useState("");
  const [planJson, setPlanJson] = useState(JSON.stringify(defaultPlan, null, 2));
  const [options, setOptions] = useState({ useSynonyms: true, useViews: true, cqrs: false });
  const [rootKey] = useState("SOLUTION");

  const [loading, setLoading] = useState<"preview" | "apply" | "cleanup" | "analyze" | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefactorResponse | null>(null);
  
  const [parsedPlan, setParsedPlan] = useState<RefactorPlan | null>(defaultPlan);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    try {
      if (planJson.trim() === "") {
        throw new Error("Plan JSON cannot be empty.");
      }
      const parsed = JSON.parse(planJson);
      if (!parsed.renames || !Array.isArray(parsed.renames)) {
        throw new Error("Plan must contain a 'renames' array.");
      }
      if (parsed.renames.length === 0) {
        throw new Error("The 'renames' array cannot be empty.");
      }
      setParsedPlan(parsed);
      setJsonError(null);
    } catch (e: any) {
      setParsedPlan(null);
      setJsonError(e.message);
    }
  }, [planJson]);

  const formValid = useMemo(() => {
    return connectionString.trim() !== "" && parsedPlan !== null && !jsonError;
  }, [connectionString, parsedPlan, jsonError]);

  const handleApiCall = async <T, R>(apiCall: (data: T) => Promise<R>, data: T, loadingState: "preview" | "apply" | "cleanup" | "analyze", successMessage: string) => {
    setLoading(loadingState);
    setError(null);
    setResult(null);
    try {
      const response = await apiCall(data) as RefactorResponse;
      setResult(response);
      if (response.ok === false) {
         setError(response.error || "An unknown error occurred.");
         toast({
          variant: "destructive",
          title: "API Error",
          description: response.error || "An unknown error occurred.",
        });
      } else {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected network error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!formValid || !parsedPlan) return;
    const requestData: Omit<RefactorRequest, 'apply'> = { connectionString, plan: parsedPlan, rootKey, ...options };
    handleApiCall(
      (data) => runRefactor(data, false), 
      requestData, 
      "preview", 
      "Preview generated successfully."
    );
  };
  
  const handleApply = () => {
    if (!formValid || !parsedPlan) return;
    setIsApplyDialogOpen(true);
  };
  
  const confirmApply = () => {
    if (!formValid || !parsedPlan) return;
    const requestData: Omit<RefactorRequest, 'apply'> = { connectionString, plan: parsedPlan, rootKey, ...options };
    handleApiCall(
      (data) => runRefactor(data, true), 
      requestData, 
      "apply", 
      "Changes applied successfully."
    );
  }

  const handleCleanup = () => {
    if (!formValid || !parsedPlan) return;
    const requestData: CleanupRequest = { connectionString, renames: parsedPlan.renames, ...options };
    handleApiCall(
      runCleanup, 
      requestData,
      "cleanup", 
      "Cleanup executed successfully."
    );
  };
  
  const handleAnalyze = () => {
    if (connectionString.trim() === "") {
        toast({ variant: "destructive", title: "Connection string is required." });
        return;
    }
    setLoading("analyze");
    setError(null);
    setResult(null);
    analyzeSchema(connectionString)
      .then(schema => {
        toast({ title: "Analysis Complete", description: "Schema loaded successfully." });
        console.log("Schema:", schema);
        // Here you would set the schema to be displayed in a viewer
      })
      .catch(err => {
        const errorMessage = err.message || "Failed to analyze schema.";
        setError(errorMessage);
        toast({ variant: "destructive", title: "Analysis Failed", description: errorMessage });
      })
      .finally(() => setLoading(false));
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-6 font-headline">
          Refactor Database + Code
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <RefactorForm
            connectionString={connectionString}
            setConnectionString={setConnectionString}
            planJson={planJson}
            setPlanJson={setPlanJson}
            jsonError={jsonError}
            options={options}
            setOptions={setOptions}
            onPreview={handlePreview}
            onApply={handleApply}
            onCleanup={handleCleanup}
            onAnalyze={handleAnalyze}
            loading={loading}
            isFormValid={formValid}
          />
          <ResultsPanel result={result} loading={loading} error={error} />
        </div>
      </main>
      <ApplyConfirmDialog 
        open={isApplyDialogOpen}
        onOpenChange={setIsApplyDialogOpen}
        onConfirm={confirmApply}
        plan={parsedPlan}
      />
    </div>
  );
}
