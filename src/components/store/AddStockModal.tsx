import { useState, useRef } from "react";
import { FileText, Plus, Upload, Loader2 } from "lucide-react";
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

interface AddStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: string;
  tenantId: string;
  onAdded: () => void;
}

export const AddStockModal = ({
  open,
  onOpenChange,
  fieldId,
  tenantId,
  onAdded,
}: AddStockModalProps) => {
  const [adding, setAdding] = useState(false);
  const [singleItem, setSingleItem] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchContent, setBatchContent] = useState("");
  const [delimiter, setDelimiter] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addItems = async (items: string[]) => {
    const filtered = items.map((i) => i.trim()).filter(Boolean);
    if (filtered.length === 0) {
      toast({ title: "Nenhum item para adicionar", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const rows = filtered.map((content) => ({
        field_id: fieldId,
        tenant_id: tenantId,
        content,
      }));

      const { error } = await (supabase as any)
        .from("product_stock_items")
        .insert(rows);

      if (error) throw error;

      toast({ title: `${filtered.length} item(ns) adicionado(s)! ✅` });
      onAdded();
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleSingleAdd = () => {
    addItems([singleItem]);
    setSingleItem("");
  };

  const handleBatchAdd = () => {
    const sep = delimiter || "\n";
    const items = batchContent.split(sep);
    addItems(items);
    setBatchContent("");
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith(".txt")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo .txt", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      addItems(lines);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
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
            </TabsList>

            {/* File upload tab */}
            <TabsContent value="upload" className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">Selecionar Arquivo TXT</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Arraste um arquivo .txt ou clique para selecionar
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>
            </TabsContent>

            {/* Manual add tab */}
            <TabsContent value="manual" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Modo em lote</Label>
                <Switch checked={batchMode} onCheckedChange={setBatchMode} />
              </div>

              {batchMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Conteúdo em Lote</Label>
                    <Textarea
                      value={batchContent}
                      onChange={(e) => setBatchContent(e.target.value)}
                      placeholder="Um item por linha..."
                      className="bg-muted border-border min-h-[120px] resize-none font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Delimitador</Label>
                    <Input
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                      placeholder="Ex: |, -, ---, ###"
                      className="bg-muted border-border"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Deixe vazio para tratar cada linha como um item individual
                    </p>
                  </div>
                  <Button
                    onClick={handleBatchAdd}
                    disabled={adding || !batchContent.trim()}
                    className="w-full gap-2"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar Itens em Lote
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Novo Item</Label>
                    <Textarea
                      value={singleItem}
                      onChange={(e) => setSingleItem(e.target.value)}
                      placeholder="senha: 123 user: root"
                      className="bg-muted border-border min-h-[80px] resize-none font-mono text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleSingleAdd}
                    disabled={adding || !singleItem.trim()}
                    className="w-full gap-2"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar Item</>}
                  </Button>
                </div>
              )}
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
