import DemoWorkspace from "./DemoWorkspace";

interface DemoPageProps {
  searchParams: Promise<{
    sample?: string | string[];
  }>;
}

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const params = await searchParams;
  const sample = Array.isArray(params.sample) ? params.sample[0] : params.sample;

  return <DemoWorkspace initialSample={sample === "crm"} />;
}
