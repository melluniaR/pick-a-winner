import HostClient from "./HostClient";

export default async function HostPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return <HostClient gameId={gameId} />;
}
