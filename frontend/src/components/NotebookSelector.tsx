import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Notebook {
  id: number;
  name: string;
  user_id?: string;
}

interface NotebookSelectorProps {
  userId?: string;
  onChange: (notebookId: number) => void;
}

export function NotebookSelector({ userId = "anon", onChange }: NotebookSelectorProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const apiBase = import.meta.env.DEV ? "/api" : "";

  useEffect(() => {
    const last = localStorage.getItem("notebook_id");
    fetch(`${apiBase}/notebooks?user_id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then((list: Notebook[]) => {
        setNotebooks(list);
        let initial: number | null = null;
        if (last) {
          const n = parseInt(last, 10);
          if (!Number.isNaN(n) && list.some(nb => nb.id === n)) initial = n;
        }
        if (initial === null && list.length > 0) initial = list[0].id;
        if (initial !== null) {
          setSelectedId(initial);
          onChange(initial);
        }
      }).catch(() => {});
  }, [userId]);

  function handleSelect(val: string) {
    const id = parseInt(val, 10);
    setSelectedId(id);
    localStorage.setItem("notebook_id", String(id));
    onChange(id);
  }

  async function handleCreate() {
    const name = newName.trim() || `Notebook ${Date.now()}`;
    const res = await fetch(`${apiBase}/notebooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, user_id: userId }),
    });
    const nb: Notebook = await res.json();
    const next = [nb, ...notebooks];
    setNotebooks(next);
    setSelectedId(nb.id);
    localStorage.setItem("notebook_id", String(nb.id));
    onChange(nb.id);
    setNewName("");
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId ? String(selectedId) : undefined} onValueChange={handleSelect}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select notebook" />
        </SelectTrigger>
        <SelectContent>
          {notebooks.map((n) => (
            <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New notebook name" className="w-48" />
      <Button onClick={handleCreate} variant="secondary">Create</Button>
    </div>
  );
}


