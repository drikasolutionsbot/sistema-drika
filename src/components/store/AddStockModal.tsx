import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Loader2, Trash2, CheckCircle2, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const TXT_FILE_PREFIX = "__TXT_FILE__:";

export interface TxtStockPayload {
  filename: string;
  content: string;
  size?: number;
}

export function serializeTxtStockItem(payload: TxtStockPayload): string {
  return `${TXT_FILE_PREFIX}${JSON.stringify({
    filename: payload.filename || "arquivo.txt",
    content: payload.content,
    size: payload.size ?? payload.content.length,
  })}`;
}

export function parseTxtStockItem(raw: string): { isTxtFile: boolean; filename: string; content: string; size: number } {
  if (typeof raw === "string" && raw.startsWith(TXT_FILE_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(TXT_FILE_PREFIX.length));
      if (parsed && typeof parsed.content === "string") {
        return {
          isTxtFile: true,
          filename: String(parsed.filename || "arquivo.txt"),
          content: parsed.content,
          size: Number(parsed.size ?? parsed.content.length),
        };
      }
    } catch {}
  }
  return {
    isTxtFile: false,
    filename: "",
    content: raw || "",
    size: (raw || "").length,
  };
}

interface AddStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  tenantId: string;
  fieldId?: string;
  initialInfiniteStock?: boolean;
  onAdded: () => void;
}

export const AddStockModal = ({
  open,
  onOpenChange,
  productId,
  tenantId,
  fieldId,
  initialInfiniteStock = false,
  onAdded,
}: AddStockModalProps) => {
  const [adding, setAdding] = useState(false);
  const [singleItem, setSingleItem] = useState("");
  const [batchContent, setBatchContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<TxtStockPayload[]>([]);
  const [copiesPerFile, setCopiesPerFile] = useState(1);
  const [infiniteStock, setInfiniteStock] = useState<boolean>(initialInfiniteStock);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInfiniteStock(initialInfiniteStock);
  }, [initialInfiniteStock, open]);

  const addItems = async (items: string[], customSuccessMsg?: string) => {
    const filtered = items.filter((i) => i.trim().length > 0);
    if (filtered.length === 0) {
      toast({ title: "Nenhum item para adicionar", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "add_stock",
          tenant_id: tenantId,
          product_id: productId,
          field_id: fieldId || null,
          items: filtered,
          infinite_stock: infiniteStock,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: customSuccessMsg || `${data?.count || filtered.length} item(ns) adicionado(s)! ✅` });
      setUploadedFiles([]);
      setCopiesPerFile(1);
      onAdded();
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleSingleAdd = () => {
    addItems([singleItem.trim()]);
    setSingleItem("");
  };

  const handleBatchAdd = () => {
    const items = batchContent.split("\n").map((i) => i.trim()).filter(Boolean);
    addItems(items);
    setBatchContent("");
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const validTxtFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));
    if (validTxtFiles.length === 0) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo .txt", variant: "destructive" });
      return;
    }

    const loaded: TxtStockPayload[] = [];
    for (const file of validTxtFiles) {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result ?? ""));
        reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
        reader.readAsText(file);
      });
      loaded.push({
        filename: file.name,
        content: text,
        size: file.size || text.length,
      });
    }

    setUploadedFiles((prev) => [...prev, ...loaded]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSaveTxtFiles = async () => {
    if (uploadedFiles.length === 0) return;
    const copies = infiniteStock ? 1 : Math.max(1, Math.min(500, Number(copiesPerFile) || 1));
    const itemsToSave: string[] = [];
    for (const f of uploadedFiles) {
      const serialized = serializeTxtStockItem(f);
      for (let i = 0; i < copies; i++) {
        itemsToSave.push(serialized);
      }
    }
    await addItems(
      itemsToSave,
      infiniteStock
        ? `Arquivo(s) TXT salvo(s) com Estoque Infinito (∞)! ✅`
        : `${itemsToSave.length} arquivo(s) TXT salvo(s) no estoque para envio na venda! ✅`
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void handleFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5" /> Adicionar Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="p-5">
          <Tabs defaultValue="upload">
            <TabsList className="w-full bg-muted mb-4">
              <TabsTrigger value="upload" className="flex-1 gap-2">
                <FileText className="h-3.5 w-3.5" /> Upload de Arquivo
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-2">
                <Plus className="h-3.5 w-3.5" /> Adicionar Item
              </TabsTrigger>
              <TabsTrigger value="lines" className="flex-1 gap-2">
                Linhas
              </TabsTrigger>
            </TabsList>

            {/* File upload tab */}
            <TabsContent value="upload" className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">Selecionar Arquivo TXT</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Arraste um arquivo .txt ou clique para selecionar
                  </p>
                  <p className="text-[11px] text-emerald-400/90 mt-1.5 font-medium">
                    O arquivo .txt inteiro ficará salvo e será enviado como anexo .txt ao cliente na venda.
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      void handleFilesSelected(e.target.files);
                    }
                  }}
                />
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {uploadedFiles.length} arquivo(s) .txt carregado(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles([])}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Limpar lista
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={`${file.filename}-${idx}`}
                        className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{file.filename}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({Math.max(1, Math.ceil((file.size || file.content.length) / 1024))} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                        <InfinityIcon className="h-3.5 w-3.5" />
                        Estoque Infinito (∞)
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Envia este arquivo .txt em todas as vendas sem nunca esgotar o estoque
                      </p>
                    </div>
                    <Switch
                      checked={infiniteStock}
                      onCheckedChange={setInfiniteStock}
                    />
                  </div>

                  {!infiniteStock && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold">Unidades no estoque por arquivo</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Quantas vendas poderão receber este arquivo .txt
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={copiesPerFile}
                        onChange={(e) => setCopiesPerFile(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                        className="w-24 h-8 bg-card border-border text-center text-xs font-bold"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSaveTxtFiles}
                    disabled={adding}
                    className="w-full gap-2"
                  >
                    {adding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        {infiniteStock
                          ? `Salvar Arquivo(s) TXT com Estoque Infinito (∞)`
                          : `Salvar ${uploadedFiles.length * copiesPerFile} Arquivo(s) TXT no Estoque`}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Manual add tab */}
            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Novo Item</Label>
                <Textarea
                  value={singleItem}
                  onChange={(e) => setSingleItem(e.target.value)}
                  placeholder="Digite o item aqui..."
                  className="bg-muted border-border min-h-[80px] resize-none"
                />
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                    <InfinityIcon className="h-3.5 w-3.5" />
                    Estoque Infinito (∞)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Envia este item em todas as vendas sem nunca esgotar
                  </p>
                </div>
                <Switch checked={infiniteStock} onCheckedChange={setInfiniteStock} />
              </div>
              <Button
                onClick={handleSingleAdd}
                disabled={adding || !singleItem.trim()}
                className="w-full gap-2"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar Item</>}
              </Button>
            </TabsContent>

            {/* Lines tab */}
            <TabsContent value="lines" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Conteúdo em Linhas</Label>
                <Textarea
                  value={batchContent}
                  onChange={(e) => setBatchContent(e.target.value)}
                  placeholder="Um item por linha..."
                  className="bg-muted border-border min-h-[120px] resize-none font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Cada linha será tratada como um item individual do estoque
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                    <InfinityIcon className="h-3.5 w-3.5" />
                    Estoque Infinito (∞)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Mantém os itens no estoque sem esgotar após as vendas
                  </p>
                </div>
                <Switch checked={infiniteStock} onCheckedChange={setInfiniteStock} />
              </div>
              <Button
                onClick={handleBatchAdd}
                disabled={adding || !batchContent.trim()}
                className="w-full gap-2"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar Itens</>}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-right">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
