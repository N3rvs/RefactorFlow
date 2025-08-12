"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RefactorPlan } from "@/lib/types";

interface ApplyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  plan: RefactorPlan | null;
}

export function ApplyConfirmDialog({ open, onOpenChange, onConfirm, plan }: ApplyConfirmDialogProps) {
  const tableRenames = plan?.renames.filter(r => r.scope === 'table').length ?? 0;
  const columnRenames = plan?.renames.filter(r => r.scope === 'column').length ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently apply changes to your database and codebase.
            <div className="mt-4 text-sm text-foreground">
              <p className="font-medium">Summary of changes:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {tableRenames > 0 && <li>Rename {tableRenames} table(s)</li>}
                {columnRenames > 0 && <li>Rename {columnRenames} column(s)</li>}
                <li>Potentially modify project files.</li>
              </ul>
            </div>
            Please ensure you have a backup before proceeding.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, apply changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
