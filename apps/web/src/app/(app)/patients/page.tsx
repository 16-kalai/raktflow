"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, HeartPulse, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { BLOOD_GROUPS } from "@raktflow/core";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/utils";

type Patient = {
  id: string;
  patientName: string | null;
  label: string;
  age: number | null;
  condition: string | null;
  hospital: string | null;
  bloodGroup: string;
  date: string;
  units: number;
  everyDays: number | null;
  notes: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function PatientsPage() {
  const { data, mutate, isLoading } = useSWR<{ patients: Patient[] }>("/api/patients", fetcher);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function addPatient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ""));
    setSaving(true);
    const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Could not add patient");
    toast.success(`${json.patient.patientName} added. Their transfusion is now pinned on the forecast.`);
    (e.target as HTMLFormElement).reset();
    setOpen(false);
    mutate();
  }

  async function remove(id: string) {
    await fetch(`/api/patients/${id}`, { method: "DELETE" });
    mutate();
  }

  const patients = data?.patients ?? [];
  const units = patients.reduce((s, p) => s + p.units, 0);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Patients with planned transfusions or surgeries. RaktFlow pins each date on the forecast, so a coordinator sees exactly whose blood is at risk when stock dips below safe."
      >
        <Button onClick={() => setOpen((v) => !v)}>
          <Plus /> Add patient
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={HeartPulse} label="Patients on schedule" value={patients.length} />
        <Stat icon={CalendarClock} label="Units reserved (next dates)" value={units} />
        <Stat icon={Repeat} label="Recurring (e.g. thalassemia)" value={patients.filter((p) => p.everyDays).length} />
      </div>

      {open && (
        <Card className="mb-6 animate-in fade-in slide-in-from-top-2">
          <CardHeader>
            <CardTitle>New patient</CardTitle>
            <CardDescription>Use initials or a hospital ID in a real deployment; the demo uses illustrative names.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addPatient} className="grid gap-4 md:grid-cols-4">
              <Field name="patientName" label="Patient" placeholder="Diya" required />
              <Field name="age" label="Age" type="number" placeholder="7" />
              <Field name="condition" label="Condition" placeholder="Thalassemia major" required />
              <Field name="hospital" label="Hospital / unit" placeholder="Day-care unit" />
              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood group</Label>
                <select id="bloodGroup" name="bloodGroup" required className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs">
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <Field name="date" label="Next transfusion" type="date" defaultValue="2026-11-14" required />
              <Field name="units" label="Units" type="number" defaultValue="1" required />
              <Field name="everyDays" label="Repeats every (days)" type="number" placeholder="21" />
              <div className="md:col-span-3">
                <Field name="notes" label="Notes" placeholder="Phenotype-matched units" />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}Save patient
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Patient</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Next date</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead className="pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8} className="px-6">
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))}
            {patients.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-6">
                  <div className="font-medium">{p.patientName ?? p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.age ? `${p.age} yrs` : "—"}{p.notes ? ` · ${p.notes}` : ""}</div>
                </TableCell>
                <TableCell>{p.condition ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-semibold text-primary">{p.bloodGroup}</Badge>
                </TableCell>
                <TableCell className="font-medium">{shortDate(p.date)}</TableCell>
                <TableCell>{p.units}</TableCell>
                <TableCell>{p.everyDays ? <Badge variant="secondary">every {p.everyDays} days</Badge> : <Badge variant="outline">one-off</Badge>}</TableCell>
                <TableCell className="text-muted-foreground">{p.hospital ?? "—"}</TableCell>
                <TableCell className="pr-6 text-right">
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(p.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && patients.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No patients yet. Add one to pin their transfusion on the forecast.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Illustrative patients. In production these come from the hospital's transfusion schedule (HIS/LIS export or CSV) and are stored with hospital IDs, not names.
      </p>
    </>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
