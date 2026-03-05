import { useState, useEffect } from "react";
import { Plus, GripVertical, Pencil, Check, X, FolderOpen } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  name: string;
  tenant_id: string;
  sort_order: number | null;
  created_at: string;
}

interface CategoryManagerProps {
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

export const CategoryManager = ({ categories, onCategoriesChange }: CategoryManagerProps) => {
  const { tenantId } = useTenant();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async () => {
    if (!tenantId || !newName.trim()) return;
    const { data, error } = await supabase.functions.invoke("manage-categories", {
      body: {
        action: "create",
        tenant_id: tenantId,
        category: { name: newName.trim(), sort_order: categories.length },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    } else {
      onCategoriesChange([...categories, data]);
      setNewName("");
      setShowCreate(false);
      toast({ title: "Categoria criada!" });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!tenantId || !editName.trim()) return;
    const { data, error } = await supabase.functions.invoke("manage-categories", {
      body: {
        action: "update",
        tenant_id: tenantId,
        category_id: id,
        category: { name: editName.trim() },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      onCategoriesChange(categories.map((c) => (c.id === id ? data : c)));
      setEditingId(null);
      toast({ title: "Categoria salva!" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-categories", {
      body: { action: "delete", tenant_id: tenantId, category_id: id },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      onCategoriesChange(categories.filter((c) => c.id !== id));
      toast({ title: "Categoria removida!" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Categorias</h3>
          <p className="text-xs text-muted-foreground">Organize seus produtos em categorias</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nova Categoria
        </Button>
      </div>

      {/* Create input */}
      {showCreate && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da categoria..."
            className="h-9 bg-muted/50 border-border text-sm flex-1"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button size="sm" onClick={handleCreate} className="gradient-pink text-primary-foreground border-none hover:opacity-90 h-9 text-xs">
            Criar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); }} className="h-9">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Categories list */}
      {categories.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">Nenhuma categoria criada</p>
          <p className="text-xs mt-1">Categorias ajudam a organizar seus produtos</p>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 px-3 py-2.5 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 bg-muted/50 border-border text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(cat.id)}
                  />
                  <button
                    onClick={() => handleUpdate(cat.id)}
                    className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium flex-1">{cat.name}</span>
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
