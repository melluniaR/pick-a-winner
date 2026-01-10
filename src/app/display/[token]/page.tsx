import DisplayClient from "./DisplayClient";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DisplayClient token={token} />;
}
