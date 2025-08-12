"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Play, Sparkles, Trash2, Loader2, FileJson2, Database } from "lucide-react";

interface RefactorFormProps {
  connectionString: string;
  setConnectionString: Dispatch<SetStateAction<string>>;
  planJson: string;
  setPlanJson: Dispatch<SetStateAction<string>>;
  jsonError: string | null;
  options: { useSynonyms: boolean; useViews: boolean; cqrs: boolean };
  setOptions: Dispatch<SetStateAction<{ useSynonyms: boolean; useViews: boolean; cqrs: boolean }>>;
  onPreview: () => void;
  onApply: () => void;
  onCleanup: () => void;
  onAnalyze: () => void;
  loading: boolean | string;
  isFormValid: boolean;
}

export default function RefactorForm({
  connectionString,
  setConnectionString,
  planJson,
  setPlanJson,
  jsonError,
  options,
  setOptions,
  onPreview,
  onApply,
  onCleanup,
  onAnalyze,
  loading,
  isFormValid,
}: RefactorFormProps) {
  
  const formatJson = () => {
    try {
      const parsed = JSON.parse(planJson);
      setPlanJson(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // Ignore if JSON is invalid, the error is already shown
    }
  };
  
  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Connection</CardTitle>
          <CardDescription>
            Provide the SQL Server connection string for your database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connection-string">Connection String</Label>
            <Textarea
              id="connection-string"
              placeholder="Server=localhost;Database=myDB;Trusted_Connection=True;..."
              rows={3}
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
           <Button variant="outline" size="sm" onClick={onAnalyze} disabled={loading === 'analyze' || !connectionString}>
            {loading === 'analyze' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Analyze Schema
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Plan (renames[])</CardTitle>
          <CardDescription>
            Define table and column renames in JSON format.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="plan-json">Rename Plan</Label>
                <Button variant="ghost" size="sm" onClick={formatJson} disabled={!!jsonError}>
                    <FileJson2 className="mr-2 h-4 w-4"/> Format
                </Button>
            </div>
            <Textarea
              id="plan-json"
              rows={12}
              value={planJson}
              onChange={(e) => setPlanJson(e.target.value)}
              className={`font-mono text-xs ${jsonError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Options</CardTitle>
          <CardDescription>
            Configure compatibility layers and other settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-synonyms" className="flex items-center gap-2">
              Use Synonyms
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Creates synonyms for renamed tables to maintain backward compatibility.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Switch
              id="use-synonyms"
              checked={options.useSynonyms}
              onCheckedChange={(checked) => setOptions(prev => ({...prev, useSynonyms: checked}))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="use-views" className="flex items-center gap-2">
              Use Views
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Creates views for tables with renamed columns (read-only).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Switch
              id="use-views"
              checked={options.useViews}
              onCheckedChange={(checked) => setOptions(prev => ({...prev, useViews: checked}))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button onClick={onPreview} disabled={!!loading || !isFormValid} size="lg" variant="outline">
            {loading === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Preview
          </Button>
          <Button onClick={onApply} disabled={!!loading || !isFormValid} size="lg">
            {loading === 'apply' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Apply
          </Button>
          <Button onClick={onCleanup} disabled={!!loading || !isFormValid} size="lg" variant="ghost">
            {loading === 'cleanup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Cleanup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
