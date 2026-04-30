import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dataUrl: string) => void;
}

export function SignaturePad({ open, onOpenChange, onSubmit }: Props) {
  const ref = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored = (() => {
      try {
        return localStorage.getItem("truc_signature");
      } catch {
        return null;
      }
    })();
    if (stored && ref.current) {
      ref.current.fromDataURL(stored);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign daily log</DialogTitle>
          <DialogDescription>Draw your signature below. We can save it for one-tap reuse.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
          <SignatureCanvas
            ref={ref}
            penColor="#0F172A"
            canvasProps={{
              className: "w-full h-44 rounded-xl",
              "aria-label": "Signature canvas",
            }}
          />
        </div>
        <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => ref.current?.clear()}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ref.current || ref.current.isEmpty()) return;
                const url = ref.current.getCanvas().toDataURL("image/png");
                onSubmit(url);
              }}
            >
              Save & sign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
