import TopicPageClient from './TopicPageClient';

interface TopicPageProps {
  params: Promise<{
    topic: string;
  }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const resolvedParams = await params;
  return <TopicPageClient topicId={resolvedParams.topic} />;
}
