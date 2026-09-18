import { getDb } from "@/lib/db";
import SearchBar from "@/components/SearchBar";
import { Page, PageHeader, Section, A, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatDollar(v: number | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

type Row = {
  id: string;
  name: string;
  slug: string;
  lean: string | null;
  donor_total: number | null;
  donor_count: number | null;
  paper_count: number | null;
  link_count: number | null;
};

export default async function Home() {
  const db = getDb();

  // One query rather than a card grid of empty descriptions: the landing page
  // should show the data, not an invitation to go looking for it.
  const tanks = db
    .prepare(
      `SELECT e.id, e.name, e.slug, e.lean,
              (SELECT SUM(d.amount) FROM donors d WHERE d.entity_id = e.id AND (d.provenance IS NULL OR d.provenance != 'seeded_demo'))  AS donor_total,
              (SELECT COUNT(*)      FROM donors d WHERE d.entity_id = e.id AND (d.provenance IS NULL OR d.provenance != 'seeded_demo'))  AS donor_count,
              (SELECT COUNT(*)      FROM policy_papers p WHERE p.entity_id = e.id) AS paper_count,
              (SELECT COUNT(*) FROM influence_links il
                 WHERE il.source_type = 'policy_paper' AND (il.provenance IS NULL OR il.provenance NOT IN ('seeded_demo', 'ai_generated'))
                   AND il.source_id IN (SELECT id FROM policy_papers WHERE entity_id = e.id)) AS link_count
         FROM entities e
        WHERE e.type = 'think_tank'
        ORDER BY donor_total DESC`
    )
    .all() as Row[];

  return (
    <Page>
      <PageHeader
        title="Think Tank Influence Tracker"
        description="Tracing funding, policy output and legislation across six US think tanks and two media commentators. A student research prototype — much of the data below is demonstration data, labelled throughout."
      />

      <div className="max-w-xl">
        <SearchBar />
      </div>

      <Section
        title="Tracked organizations"
        description="Donation totals are demonstration data. Paper and legislation counts come from the database."
      >
        <div className="overflow-x-auto border border-border rounded-md bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th scope="col" className="font-medium px-4 py-2.5">Organization</th>
                <th scope="col" className="font-medium px-4 py-2.5">Lean</th>
                <th scope="col" className="font-medium px-4 py-2.5 text-right">Tracked donations</th>
                <th scope="col" className="font-medium px-4 py-2.5 text-right">Donors</th>
                <th scope="col" className="font-medium px-4 py-2.5 text-right">Papers</th>
                <th scope="col" className="font-medium px-4 py-2.5 text-right">Bill links</th>
              </tr>
            </thead>
            <tbody>
              {tanks.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <A href={`/think-tanks/${t.slug}`} className="font-medium">
                      {t.name}
                    </A>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.lean ? <Badge>{t.lean}</Badge> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum">{formatDollar(t.donor_total)}</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{t.donor_count ?? 0}</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{t.paper_count ?? 0}</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{t.link_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Media amplifiers">
        <p className="text-sm text-muted">
          Two commentators are tracked alongside the organizations.{" "}
          <A href="/amplifiers">See amplifiers</A>.
        </p>
      </Section>
    </Page>
  );
}
