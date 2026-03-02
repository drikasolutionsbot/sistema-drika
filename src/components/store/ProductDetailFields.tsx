import { useState } from "react";
import { Plus, Search, GripVertical, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Field {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
}

export const ProductDetailFields = () => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  const addField = () => {
    const newField: Field = {
      id: crypto.randomUUID(),
      name: "Novo campo",
      description: "Novo produto",
      price: "0.00",
      stock: 0,
    };
    setFields([...fields, newField]);
    setExpandedId(newField.id);
  };

  const filtered = fields.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar campos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted border-none"
        />
      </div>

      {/* Add button */}
      <button
        onClick={addField}
        className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
      >
        Adicionar Campo <Plus className="h-4 w-4" />
      </button>

      {/* Fields list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Campos</h4>
          {filtered.map((field) => (
            <div
              key={field.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggle(field.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-medium">{field.name}</p>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                  <p className="text-xs font-medium text-primary">R$ {field.price}</p>
                </div>
                {expandedId === field.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Expanded content */}
              {expandedId === field.id && (
                <div className="border-t border-border p-4">
                  <Tabs defaultValue="geral">
                    <TabsList className="bg-muted mb-4">
                      <TabsTrigger value="geral">Geral</TabsTrigger>
                      <TabsTrigger value="estoque">Estoque</TabsTrigger>
                    </TabsList>

                    <TabsContent value="geral" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Nome do Campo</Label>
                          <Input
                            value={field.name}
                            onChange={(e) => {
                              setFields(fields.map((f) => f.id === field.id ? { ...f, name: e.target.value } : f));
                            }}
                            className="bg-muted border-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Emoji (Opcional)</Label>
                          <Input placeholder="😀" className="bg-muted border-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Descrição</Label>
                        <Textarea
                          value={field.description}
                          onChange={(e) => {
                            setFields(fields.map((f) => f.id === field.id ? { ...f, description: e.target.value } : f));
                          }}
                          className="bg-muted border-none min-h-[80px] resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Preço</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.price}
                            onChange={(e) => {
                              setFields(fields.map((f) => f.id === field.id ? { ...f, price: e.target.value } : f));
                            }}
                            className="bg-muted border-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Preço de Comparação (Opcional)</Label>
                          <Input type="number" step="0.01" placeholder="0.00" className="bg-muted border-none" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="estoque" className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                        <div>
                          <p className="text-sm font-medium">Estoque atual</p>
                          <p className="text-2xl font-bold">{field.stock} itens</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Estoque
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum campo adicionado ainda</p>
          <p className="text-xs mt-1">Campos são variações do produto (ex: 30 dias, 90 dias)</p>
        </div>
      )}
    </div>
  );
};
