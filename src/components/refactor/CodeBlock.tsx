
"use client";

import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

export function CodeBlock({ code }: { code: string | undefined }) {
    const { toast } = useToast();
    const [hasCopied, setHasCopied] = useState(false);

    useEffect(() => {
        if (hasCopied) {
            const timer = setTimeout(() => {
                setHasCopied(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [hasCopied]);

    const onCopy = () => {
        if (code) {
            navigator.clipboard.writeText(code);
            setHasCopied(true);
            toast({ title: 'Copiado al portapapeles' });
        }
    };

    if (!code) {
        return (
            <div className="flex items-center justify-center bg-muted p-4 rounded-md h-32">
                <p className="text-muted-foreground text-sm">No se ha generado ningún script.</p>
            </div>
        );
    }

    return (
        <div className="relative group">
            <pre className="bg-muted text-muted-foreground p-4 rounded-md overflow-x-auto text-sm leading-relaxed">
                <code>{code}</code>
            </pre>
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onCopy}
                aria-label="Copiar código al portapapeles"
            >
                {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
        </div>
    );
}

    