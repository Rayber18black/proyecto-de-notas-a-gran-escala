import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { configApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QrCode, Monitor, Smartphone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

export function QRButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: configApi.get,
    enabled: open,
  });

  const localUrl = config?.local_ip ? `http://${config.local_ip}:8080` : "http://localhost:8080";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn("rounded-full w-9 h-9 border border-border bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 shadow-sm transition-all text-emerald-500", className)}
        title="Acceso Móvil (Red Local)"
      >
        <QrCode className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Acceso QR</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md text-center flex flex-col items-center p-8">
          <DialogHeader className="w-full">
            <DialogTitle className="flex flex-col items-center gap-3 text-2xl font-bold mb-2">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-500">
                <Smartphone className="h-8 w-8" />
              </div>
              Conexión Móvil
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Escanea este código desde tu teléfono o tablet para acceder al sistema si estás conectado al mismo Wi-Fi.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center w-full py-6">
            {isLoading ? (
              <div className="h-[250px] w-[250px] bg-muted animate-pulse rounded-2xl flex items-center justify-center">
                <QrCode className="h-10 w-10 text-muted-foreground opacity-50" />
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="p-4 bg-white rounded-3xl shadow-xl border border-emerald-100">
                  <QRCodeSVG 
                    value={localUrl} 
                    size={220} 
                    level="H"
                    includeMargin={true}
                    className="rounded-lg"
                  />
                </div>
                
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Dirección de Acceso</p>
                  <code className="text-sm font-mono font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-6 py-2 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-inner">
                    {localUrl}
                  </code>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                  <Globe className="h-3 w-3" />
                  <span>Requiere estar en la misma red local que el servidor.</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
