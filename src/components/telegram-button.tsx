import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Send, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function TelegramButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bot-info"],
    queryFn: publicApi.getBotInfo,
    enabled: open,
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn("rounded-full w-9 h-9 border border-border bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 shadow-sm transition-all text-blue-500", className)}
        title="Conectar con el Bot de Telegram"
      >
        <Send className="h-[1.2rem] w-[1.2rem] -ml-0.5" />
        <span className="sr-only">Telegram Bot</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md text-center flex flex-col items-center">
          <DialogHeader className="w-full">
            <DialogTitle className="flex flex-col items-center gap-3 text-2xl font-bold mb-2">
              <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-500">
                <Send className="h-8 w-8 -ml-1" />
              </div>
              Bot de Telegram
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Escanea el código QR o usa el enlace directo para ir al bot y consultar tus calificaciones.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center w-full py-6">
            {isLoading ? (
              <div className="h-[250px] w-[250px] bg-muted animate-pulse rounded-xl flex items-center justify-center">
                <QrCode className="h-10 w-10 text-muted-foreground opacity-50" />
              </div>
            ) : data?.link ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="p-4 bg-white rounded-2xl shadow-sm border">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.link)}&margin=10`} 
                    alt="QR Code" 
                    className="w-[200px] h-[200px]"
                  />
                </div>
                <a 
                  href={data.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Send className="h-4 w-4" />
                  Ir al Bot Directamente
                </a>
              </div>
            ) : (
              <div className="p-6 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 rounded-xl max-w-sm text-sm border border-orange-200 dark:border-orange-900/50">
                <p className="font-bold mb-1">Bot no disponible</p>
                <p>El bot de Telegram no está configurado actualmente o se encuentra desactivado por la administración escolar.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
