"use client";
import { useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileUp, Loader2, Phone, Search, ShieldCheck, Upload, XCircle } from "lucide-react";
import { BLOOD_GROUPS } from "@raktflow/core";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, shortDate } from "@/lib/utils";

type Donor = {
  id: string;
  ref: string;
  name: string;
  phone: string;
  bloodGroup: string;
  sex: string;
  language: string;
  city: string;
  lastDonationOn: string | null;
  consent: boolean;
  optedOut: boolean;
  isDemoContact: boolean;
  eligible: boolean;
  reasons: string[];
  eligibleFrom: string | null;
};
type DonorPage = { total: number; page: number; pageSize: number; byGroup: { group: string; n: number }[]; donors: Donor[] };
type ImportResult = { imported: number; duplicates: number; errorCount: number; errors: { line: number; message: string }[] };

const REASON: Record<string, string> = {
  too_soon: "Donated recently",
  no_consent: "No consent",
  opted_out: "Opted out",
  deferred: "Deferred",
  dnd_unchecked: "DND check pending",
  wrong_group: "—",
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function DonorsPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ q, group, page: String(page) });
  const { data, isLoading, mutate } = useSWR<DonorPage>(`/api/donors?${params}`, fetcher, { keepPreviousData: true });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setResult(null);
    const res = await fetch("/api/donors/import", { method: "POST", body: await file.text(), headers: { "Content-Type": "text/csv" } });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return toast.error(json.error ?? "Import failed");
    setResult(json);
    toast.success(`${json.imported} donors imported`);
    mutate();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Donors"
        description="The bank's donor registry. RaktFlow only calls donors who consented, passed the DND check, and are past the 90/120-day gap. Names and numbers never leave RaktFlow; Flagsmith and Sarvam see a pseudonymous ID."
      >
        <Button variant="outline" asChild>
          <a href="/api/donors/template">
            <Download /> CSV template
          </a>
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload donors
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-4 gap-3 md:grid-cols-8">
        {(data?.byGroup ?? BLOOD_GROUPS.map((g) => ({ group: g, n: 0 }))).map((g) => (
          <button
            key={g.group}
            onClick={() => {
              setGroup(group === g.group ? "" : g.group);
              setPage(0);
            }}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm",
              group === g.group && "border-primary ring-2 ring-primary/30",
            )}
          >
            <div className="text-sm font-semibold text-primary">{g.group}</div>
            <div className="text-xl font-semibold tabular-nums">{g.n}</div>
            <div className="text-[11px] text-muted-foreground">donors</div>
          </button>
        ))}
      </div>

      <Card
        className={cn("mb-6 border-dashed transition-colors", dragOver && "border-primary bg-primary/5")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-4 text-primary" /> Import your donor list
          </CardTitle>
          <CardDescription>
            Drop a CSV here, or export from your blood bank software. Columns: <code>name, phone, blood_group, sex, last_donation_on, language, city, consent</code>.
            Phones are normalised to +91, duplicates are skipped, and only rows with consent = yes can be called.
          </CardDescription>
        </CardHeader>
        {result && (
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success"><CheckCircle2 /> {result.imported} imported</Badge>
              <Badge variant="secondary">{result.duplicates} duplicates skipped</Badge>
              {result.errorCount > 0 && <Badge variant="destructive"><XCircle /> {result.errorCount} rows with errors</Badge>}
            </div>
            {result.errors.slice(0, 5).map((e) => (
              <div key={e.line} className="text-xs text-destructive">
                Line {e.line}: {e.message}
              </div>
            ))}
            {result.imported > 0 && (
              <p className="text-xs text-muted-foreground">New donors start with DND check pending. RaktFlow checks the TRAI registry before the first call.</p>
            )}
          </CardContent>
        )}
      </Card>

      <Card className="py-0">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name, ID or city"
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          {group && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setGroup("")}>
              {group} ✕
            </Badge>
          )}
          <div className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} donors</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Donor</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Last donated</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead className="pr-6">Can be called</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !data &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="px-6">
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.donors.map((d) => (
              <TableRow key={d.id} className={cn(d.isDemoContact && "bg-sarvam/5")}>
                <TableCell className="pl-6">
                  <div className="flex items-center gap-2 font-medium">
                    {d.name}
                    {d.isDemoContact && <Badge variant="sarvam"><Phone /> demo call</Badge>}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{d.ref} · {d.city}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-semibold text-primary">{d.bloodGroup}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.phone}</TableCell>
                <TableCell className="uppercase text-muted-foreground">{d.language}</TableCell>
                <TableCell>{d.lastDonationOn ? shortDate(d.lastDonationOn) : "—"}</TableCell>
                <TableCell>{d.consent ? <ShieldCheck className="size-4 text-success" /> : <span className="text-xs text-muted-foreground">no</span>}</TableCell>
                <TableCell className="pr-6">
                  {d.eligible ? (
                    <Badge variant="success">eligible</Badge>
                  ) : (
                    <Badge variant="secondary">{REASON[d.reasons[0] ?? ""] ?? d.reasons[0]}{d.reasons[0] === "too_soon" && d.eligibleFrom ? ` · from ${shortDate(d.eligibleFrom)}` : ""}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
