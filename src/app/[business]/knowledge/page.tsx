import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { formatNumber, timeAgo, titleCase } from "@/lib/utils";
import {
  FileText,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  ShieldCheck,
  Package,
  Image as ImageIcon,
  Upload,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const SOURCE_ICON: Record<string, LucideIcon> = {
  PDF: FileText,
  DOCX: FileText,
  XLSX: FileSpreadsheet,
  WEBSITE: Globe,
  FAQ: HelpCircle,
  POLICY: ShieldCheck,
  CATALOG: Package,
  IMAGE: ImageIcon,
  TEXT: FileText,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function KnowledgePage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const [documents, chunkCount] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { businessId: business.id },
      include: { uploadedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.knowledgeChunk.count({ where: { businessId: business.id } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Knowledge Base"
        description="Documents your AI agents use to answer accurately — grounded, with sources"
      >
        <button className="btn btn-primary" disabled title="Upload flow connects to document processing pipeline">
          <Upload size={16} /> Upload Document
        </button>
      </PageHeading>

      {/* RAG explainer */}
      <Card className="flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-softer text-primary"><BookOpen size={18} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{documents.length}</p><p className="text-xs text-text-muted">Documents</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-soft text-purple"><Sparkles size={18} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{formatNumber(chunkCount)}</p><p className="text-xs text-text-muted">Indexed passages</p></div>
        </div>
        <p className="flex-1 text-xs leading-relaxed text-text-secondary">
          When a customer asks a question, the Knowledge Agent retrieves the most relevant passages from these
          documents and answers strictly from them — citing the source. Upload PDFs, catalogs, FAQs, policies or a
          website and the AI learns instantly, no coding required.
        </p>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen size={22} />} title="No documents yet" description="Upload your first document to train your AI agents." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const Icon = SOURCE_ICON[doc.sourceType] ?? FileText;
            return (
              <Card key={doc.id} className="card-hover p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-inset text-text-secondary">
                    <Icon size={20} />
                  </div>
                  <Badge tone={doc.status === "READY" ? "success" : doc.status === "PROCESSING" ? "warning" : "danger"}>
                    {titleCase(doc.status)}
                  </Badge>
                </div>
                <h3 className="mt-3 text-[14px] font-semibold leading-snug text-text">{doc.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                  <span>{titleCase(doc.sourceType)}</span>
                  <span>·</span>
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  <span>·</span>
                  <span>{doc.chunkCount} passages</span>
                </div>
                <p className="mt-3 border-t border-border pt-2 text-[11px] text-text-muted">
                  {doc.uploadedBy ? `Uploaded by ${doc.uploadedBy.name.split(" ")[0]}` : "Uploaded"} · {timeAgo(doc.createdAt)}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
