export function GET() {
  const csv = [
    "name,phone,blood_group,sex,last_donation_on,language,city,consent",
    "Anita Desai,+919800000001,O+,female,2026-05-14,mr,Pune,yes",
    "Rahul Mehta,9800000002,B+,male,,hi,Pune,yes",
  ].join("\n");
  return new Response(csv + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="raktflow-donors-template.csv"' },
  });
}
